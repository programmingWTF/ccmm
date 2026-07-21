import * as fs from "node:fs";
import { dirname } from "node:path";
import { confirm, select, input, password } from "@inquirer/prompts";
import pc from "picocolors";
import type { Command } from "commander";

import { ccmmDir, claudeSettingsPaths, configPath, pidPath, checkClaudeBinary } from "../util/paths.js";
import { loadConfig, saveConfig } from "../store/config.js";
import { setActiveRoute } from "../store/state.js";
import { PROVIDER_TEMPLATES } from "../providers/registry.js";
import { isProxyRunning, stopProxy } from "../proxy/server.js";
import { t, type Lang } from "../i18n/index.js";
import { enableAutoStart } from "../util/autostart.js";
import { checkForUpdate } from "../util/update-check.js";

const { existsSync, readFileSync, writeFileSync, copyFileSync, mkdirSync } = fs;

// ── Slot definitions ────────────────────────────────────

const SLOTS = [
  { key: "ANTHROPIC_MODEL",              labelDef: "Default (auto)",           labelZh: "Default（自动）" },
  { key: "ANTHROPIC_DEFAULT_OPUS_MODEL",  labelDef: "High / XHigh / Max / Ultracode", labelZh: "High / XHigh / Max / Ultracode" },
  { key: "ANTHROPIC_DEFAULT_SONNET_MODEL", labelDef: "Medium",                  labelZh: "Medium" },
  { key: "ANTHROPIC_DEFAULT_HAIKU_MODEL", labelDef: "Low",                      labelZh: "Low" },
  { key: "CLAUDE_CODE_SUBAGENT_MODEL",    labelDef: "Subagent",                 labelZh: "Subagent" },
];

// ── Helpers ──────────────────────────────────────────────

function ts(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "-" + p(d.getHours()) + p(d.getMinutes());
}

function backupSettings(sp: string): string {
  const bak = sp + "." + ts() + ".bak";
  if (existsSync(sp)) copyFileSync(sp, bak);
  return bak;
}

function findSettingsPath(): string {
  for (const sp of claudeSettingsPaths()) {
    if (existsSync(sp)) return sp;
  }
  return claudeSettingsPaths()[0] ?? "";
}

// ── Registration ─────────────────────────────────────────

export function registerSetup(program: Command): void {
  program.command("setup")
    .description("交互式配置向导 / Interactive setup wizard")
    .action(async () => {
      // Auto-check for updates (non-blocking notification)
      notifyUpdate();

      console.log("");
      console.log(pc.bold(pc.cyan("  ccmm setup wizard")));
      console.log(pc.dim("  " + t("setup.subtitle", "zh-CN")));
      console.log("");
      await runSetup();
    });
}

async function runSetup(): Promise<void> {
  const c = loadConfig();

  // ── Language ─────────────────────────────────────────
  console.log("");
  const lang = await select({
    message: t("setup.langMsg", "zh-CN"),
    choices: [
      { value: "zh-CN", name: t("setup.lang.zh", "zh-CN") },
      { value: "en", name: t("setup.lang.en", "zh-CN") },
    ],
  }) as Lang;
  c.language = lang;
  saveConfig(c);
  console.log("");

  // ── Detect existing ccmm config ────────────────────
  const existingProviders = Object.entries(c.providers).filter(
    ([, p]) => p.modelMap && Object.keys(p.modelMap).length > 0
  );

  if (existingProviders.length > 0) {
    console.log(pc.yellow("  " + t("setup.existing", lang)));
    for (const [name, p] of existingProviders) {
      console.log(pc.dim("    " + name + " → " + p.baseUrl + " (" + Object.keys(p.modelMap!).length + " slots)"));
    }
    console.log("");

    const action = await select({
      message: t("setup.what", lang),
      choices: [
        { value: "use", name: pc.green(t("setup.use", lang)), description: t("setup.useDesc", lang) },
        { value: "preview", name: pc.cyan(t("setup.preview", lang)), description: t("setup.previewDesc", lang) },
        { value: "reset", name: pc.red(t("setup.reset", lang)), description: t("setup.resetDesc", lang) },
      ],
    });

    if (action === "use") {
      console.log("");
      console.log(pc.green(t("setup.using", lang)));
      await syncSettings(c);
      await finish(c, lang);
      return;
    }

    if (action === "preview") {
      console.log("");
      console.log(pc.bold(t("setup.current", lang)));
      for (const [pName, pCfg] of Object.entries(c.providers)) {
        if (!pCfg.modelMap) continue;
        console.log("");
        console.log(pc.cyan("  " + pName) + " → " + pCfg.baseUrl);
        for (const [from, to] of Object.entries(pCfg.modelMap)) {
          console.log(pc.dim("    " + from + " → " + to));
        }
        console.log(pc.dim("    apiKey: " + (pCfg.apiKey ? "***" + pCfg.apiKey.slice(-4) : "(not set)")));
      }
      console.log("");
      const afterPreview = await select({
        message: t("setup.nowWhat", lang),
        choices: [
          { value: "use", name: t("setup.useExisting", lang) },
          { value: "add", name: t("setup.addMore", lang) },
          { value: "reset", name: t("setup.reset", lang) },
        ],
      });

      if (afterPreview === "use") {
        console.log(pc.green(t("setup.keeping", lang)));
        await syncSettings(c);
        await finish(c, lang);
        return;
      }
      if (afterPreview === "reset") {
        c.providers = {};
        saveConfig(c);
        console.log(pc.yellow(t("setup.cleared", lang)));
        console.log("");
      }
    }

    if (action === "reset") {
      c.providers = {};
      saveConfig(c);
      console.log(pc.yellow(t("setup.cleared", lang)));
      console.log("");
    }
  }

  // ── Loop: add providers ────────────────────────────
  let addMore = true;
  const addedProviders: string[] = [];

  while (addMore) {
    await configureOneProvider(c, addedProviders.length > 0, lang);
    addedProviders.push("_");

    console.log("");
    addMore = await confirm({
      message: t("setup.addAnother", lang),
      default: false,
    });
    if (addMore) console.log("");
  }

  // ── Pick default ───────────────────────────────────
  const pNames = Object.keys(c.providers);
  if (pNames.length > 1) {
    console.log("");
    const choice = await select({
      message: t("setup.default", lang),
      choices: pNames.map(n => ({ value: n, name: n + " — " + c.providers[n]!.baseUrl })),
      default: pNames[0],
    });
    c.defaultProvider = choice;
  } else if (pNames.length === 1) {
    c.defaultProvider = pNames[0]!;
  }
  saveConfig(c);

  // ── Budget ─────────────────────────────────────────
  console.log("");
  if (await confirm({ message: t("setup.budget", lang), default: true })) {
    const b = await input({
      message: t("setup.budgetAmt", lang),
      default: "20",
      validate: (v: string) => !isNaN(parseFloat(v)) && parseFloat(v) > 0 ? true : "Invalid",
    });
    c.budget = { dailyUsd: parseFloat(b), alert: true };
    saveConfig(c);
  }

  // ── Auto-start ─────────────────────────────────────
  console.log("");
  if (await confirm({ message: t("setup.autoStart", lang), default: true })) {
    enableAutoStart();
    console.log(pc.green("  ✓ " + (lang === "zh-CN" ? "已启用自启动" : "Auto-start enabled")));
  }

  // ── Sync settings.json ─────────────────────────────
  await syncSettings(c);
  await finish(c, lang);
}

// ── Sync settings.json ────────────────────────────────────

async function syncSettings(c: ReturnType<typeof loadConfig>): Promise<void> {
  const lang = c.language ?? "zh-CN";
  const zh = lang === "zh-CN";
  console.log("");
  console.log(pc.bold(zh ? "应用设置到 Claude Code" : "Apply to Claude Code settings"));
  console.log("");
  const envConflicts = ["ANTHROPIC_BASE_URL","ANTHROPIC_API_KEY","ANTHROPIC_AUTH_TOKEN"];
  const found = envConflicts.filter(k => process.env[k]);
  if (found.length > 0) {
    console.log(pc.red(zh ? "  ⚠ 系统环境变量会覆盖 settings.json:" : "  WARNING: System env vars override settings.json:"));
    for (const k of found) console.log(pc.dim("    " + k + "=" + (process.env[k]||"").slice(0,60)));
    console.log(pc.yellow(zh ? "  这些变量优先级高于 Claude Code 设置。请移除：" : "  These take priority over Claude Code settings. Remove them:"));
    console.log(pc.dim("    PowerShell: Remove-Item Env:" + found[0]));
    console.log("");
  }

  const sp = findSettingsPath();
  if (!sp || !existsSync(sp)) {
    console.log(pc.yellow(zh ? "⚠ 未找到 settings.json。" : "⚠ No settings.json found."));
    console.log(pc.dim(zh ? "  请在 " + claudeSettingsPaths()[0] + " 创建一个" : "  Create one at " + claudeSettingsPaths()[0]));
    return;
  }

  const bak = backupSettings(sp);
  console.log(pc.dim(zh ? "  已备份: " : "  Backed up: ") + bak);

  let settings: Record<string, unknown> = {};
  try {
    settings = JSON.parse(readFileSync(sp, "utf-8"));
  } catch {
    console.log(pc.yellow(zh ? "警告: JSON 格式错误，使用默认值" : "Warning: bad JSON, using defaults"));
  }

  const oldEnv = (settings.env as Record<string, string>) || {};
  const knownKeys = [
    "ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL", "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "CLAUDE_CODE_SUBAGENT_MODEL",
    "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_API_KEY",
  ];
  const foundOld = knownKeys.filter(k => k in oldEnv);

  if (foundOld.length > 0) {
    console.log("");
    console.log(pc.yellow(zh ? "  发现已有模型环境变量:" : "  Found existing model env vars:"));
    for (const k of foundOld) {
      const v = oldEnv[k]!;
      console.log(pc.dim("    " + k + "=" + (v.length > 50 ? v.slice(0, 50) + "..." : v)));
    }
    console.log("");

    const action = await select({
      message: zh ? "如何处理这些？/ How to handle these?" : "How to handle these? / 如何处理这些？",
      choices: [
        { value: "replace", name: zh ? "替换 — ccmm 管理" : "Replace — ccmm manages them", description: zh ? "旧值已备份到 .bak 文件" : "Old values are safe in the backup file" },
        { value: "keep", name: zh ? "保留 — 不做更改" : "Keep — leave as-is", description: zh ? "你将手动管理它们" : "You will manage them manually" },
      ],
    });
    if (action === "replace") {
      for (const k of foundOld) delete oldEnv[k];
    }
  }

  const newEnv: Record<string, string> = { ...oldEnv };
  newEnv.ANTHROPIC_BASE_URL = "http://127.0.0.1:" + c.proxy.port;

  for (const slot of SLOTS) {
    newEnv[slot.key] = slot.key;
  }

  if (!newEnv.ANTHROPIC_AUTH_TOKEN) {
    newEnv.ANTHROPIC_AUTH_TOKEN = "ccmm-proxy";
  }

  settings.env = newEnv;

  // Check existing statusLine — ask if it's not ours
  const currentSL = (settings.statusLine as { command?: string })?.command;
  const isOurs = currentSL === "ccmm statusline";
  let shouldSetSL = true;

  if (currentSL && !isOurs) {
    console.log("");
    console.log(pc.yellow(zh ? "  检测到已有状态栏配置:" : "  Existing statusLine detected:") + " " + pc.bold(currentSL));
    const action = await select({
      message: zh ? "如何处理？/ How to handle?" : "How to handle? / 如何处理？",
      choices: [
        { value: "overwrite", name: zh ? "覆盖 — 使用 ccmm 状态栏" : "Overwrite — use ccmm statusLine" },
        { value: "keep", name: zh ? "保留 — 不做更改" : "Keep — leave as-is" },
      ],
    });
    shouldSetSL = action === "overwrite";
  }

  if (shouldSetSL) {
    settings.statusLine = { type: "command" as const, command: "ccmm statusline" };
  }

  mkdirSync(dirname(sp), { recursive: true });
  writeFileSync(sp, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  console.log(pc.green(zh ? "✓ 设置已更新: " : "✓ Settings updated: ") + sp);
}

// ── Configure one provider ───────────────────────────────

async function configureOneProvider(c: ReturnType<typeof loadConfig>, isSecond: boolean, lang: Lang): Promise<void> {
  if (!isSecond) {
    console.log(pc.bold(t("setup.chooseProv", lang)));
    console.log("");
  } else {
    console.log(pc.bold(t("setup.addMore", lang)));
    console.log("");
  }

  const provChoices = [
    ...PROVIDER_TEMPLATES.map(pt => ({
      value: pt.id,
      name: pc.bold(pt.name) + pc.dim("  — " + pt.baseUrl),
      description: pt.description,
    })),
    { value: "__custom__", name: pc.bold(t("prov.custom", lang)) + pc.dim("  — enter URL"), description: t("prov.customDesc", lang) },
  ];

  const provChoice = await select({
    message: t("prov.type", lang),
    choices: provChoices,
    pageSize: 10,
  });

  let baseUrl: string;
  let apiKeyEnv: string;

  if (provChoice === "__custom__") {
    baseUrl = await input({
      message: t("prov.baseUrl", lang),
      validate: (v: string) => v.length > 0 ? true : "Required",
      default: "https://api.deepseek.com/anthropic",
    });
    apiKeyEnv = await input({
      message: t("prov.envName", lang),
      default: "CUSTOM_API_KEY",
    });
  } else {
    const tmpl = PROVIDER_TEMPLATES.find(p => p.id === provChoice);
    baseUrl = tmpl?.baseUrl ?? "";
    apiKeyEnv = tmpl?.apiKeyEnv ?? "";
  }

  console.log("");
  const apiKey = await password({
    mask: "*",
    message: t("prov.apiKey", lang),
    validate: (v: string) => v.length > 0 ? true : "Required",
  });

  // ── 5 model slots ──────────────────────────────────
  console.log("");
  console.log(pc.bold(
    lang === "zh-CN" ? "为每个思维深度配置实际模型 ID:" : "Configure actual model IDs for each thinking depth:"
  ));
  console.log(pc.dim(
    lang === "zh-CN" ? "  ccmm 在 settings.json 中使用占位符名称，在此处将其映射到真实模型。" : "  ccmm uses placeholder names in settings.json and maps them to real models here."
  ));
  console.log("");

  const modelMap: Record<string, string> = {};
  const defaultSet = (provChoice === "deepseek")
    ? ["deepseek-v4-pro", "deepseek-v4-pro", "deepseek-v4-pro", "deepseek-v4-flash", "deepseek-v4-flash"]
    : ["claude-sonnet-4-20250514", "claude-opus-4-1-20250805", "claude-sonnet-4-20250514", "claude-haiku-4-5-20251001", "claude-haiku-4-5-20251001"];

  for (let i = 0; i < SLOTS.length; i++) {
    const slot = SLOTS[i]!;
    const label = lang === "zh-CN" ? slot.labelZh : slot.labelDef;
    const modelId = await input({
      message: label + pc.dim(" — " + slot.key) + ":",
      default: defaultSet[i] || "",
      validate: (v: string) => v.trim().length > 0 ? true : "Required",
    });
    modelMap[slot.key] = modelId.trim().replace(/\[\d+[km]\]$/i, "");
  }

  // ── Name this configuration ──────────────────────
  console.log("");
  const existingCount = Object.keys(c.providers).filter(function(k) { return k.startsWith(provChoice); }).length;
  const defaultName = provChoice + (existingCount > 0 ? "-" + (existingCount + 1) : "");

  const configName = await input({
    message: t("prov.nameMsg", lang),
    default: defaultName,
    validate: function(v: string) {
      if (!v.trim()) return "Required";
      if (c.providers[v.trim()]) return t("prov.nameExists", lang);
      return true;
    },
  });

  const name = configName.trim();
  c.providers[name] = { baseUrl, apiKeyEnv, wire: "anthropic" as const, modelMap, apiKey };
  saveConfig(c);

  console.log(pc.green("  ✓ API key saved to ccmm config"));
  console.log(pc.dim("  " + (lang === "zh-CN" ? "可直接编辑 " : "You can edit directly at ") + configPath()));
}

// ── Finish ───────────────────────────────────────────────

async function finish(c: ReturnType<typeof loadConfig>, lang: Lang): Promise<void> {
  console.log("");
  if (!await confirm({ message: t("setup.apply", lang), default: true })) {
    console.log(pc.yellow(t("setup.skip", lang)));
    return;
  }

  const dp = c.defaultProvider ?? Object.keys(c.providers)[0];
  if (dp) setActiveRoute(dp, c);

  console.log(pc.green(t("setup.saved", lang) + configPath()));
  console.log("");
  console.log(pc.yellow(pc.bold("  " + t("setup.restart", lang))));
  console.log(pc.dim("  " + t("setup.restartHint", lang)));

  const wasRunning = isProxyRunning();
  if (wasRunning) {
    console.log("");
    console.log(pc.dim("  " + t("setup.proxyRestart", lang)));
    try { await stopProxy(); } catch { /* may already be stopped */ }
    await new Promise(r => setTimeout(r, 500));
    const { spawn } = await import("node:child_process");
    const child = spawn(process.execPath, [process.argv[1] ?? "", "_daemon"], {
      detached: true,
      stdio: "ignore" as const,
    });
    child.unref();
    await new Promise(r => setTimeout(r, 1000));
    if (isProxyRunning()) {
      console.log(pc.green(t("setup.proxyRestarted", lang)));
    }
  }

  // ── Verify Claude Code installation ──────────────────
  const cb = checkClaudeBinary();
  if (!cb.ok) {
    console.log("");
    console.log(pc.red(pc.bold("  " + t("setup.claudeMissing", lang))));
    console.log(pc.yellow("  " + t("setup.claudeMissingFix", lang)));
    const platformHint = process.platform === "win32"
      ? (lang === "zh-CN" ? "（Windows Defender 可能隔离了 claude.exe）" : "(Windows Defender may have quarantined claude.exe)")
      : (lang === "zh-CN" ? "（请检查 npm 全局安装路径）" : "(Check your npm global install path)");
    console.log(pc.dim("  " + platformHint));
  }

  console.log("");
  console.log(pc.bold(t("setup.next", lang)));
  if (!wasRunning) {
    console.log("  " + pc.cyan("ccmm start") + t("setup.nextStart", lang));
  }
  console.log("  " + pc.cyan("ccmm use <name>") + t("setup.nextUse", lang));
  console.log("  " + pc.cyan("ccmm current") + t("setup.nextCurrent", lang));
  console.log("  " + pc.cyan("ccmm stats today") + t("setup.nextStats", lang));
  if (wasRunning) {
    console.log("");
    console.log(pc.green(t("setup.proxyRunning", lang)));
  }
  console.log("");
}

// ── Update notification helper ─────────────────────────

const VERSION = "0.1.7";

function notifyUpdate(): void {
  try {
    const c = loadConfig();
    const L = c.language ?? "zh-CN";
    const info = checkForUpdate(VERSION);
    if (info?.hasUpdate) {
      console.log(pc.yellow("  ⚡ " + t("update.notify", L) + info.latestVersion + t("update.notifyHint", L)));
    }
  } catch { /* silent — never block the user */ }
}
