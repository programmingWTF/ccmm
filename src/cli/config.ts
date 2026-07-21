import type { Command } from "commander";
import { select, input, confirm, password, Separator } from "@inquirer/prompts";
import pc from "picocolors";
import * as fs from "node:fs";
import { dirname } from "node:path";
import { loadConfig, saveConfig, type Config } from "../store/config.js";
import { PROVIDER_TEMPLATES } from "../providers/registry.js";
import { t, type Lang } from "../i18n/index.js";
import { isAutoStartEnabled, enableAutoStart, disableAutoStart } from "../util/autostart.js";
import { claudeSettingsPaths } from "../util/paths.js";
import { checkForUpdate } from "../util/update-check.js";

export function registerConfig(program: Command): void {
  program
    .command("config")
    .description("交互式配置编辑器 / Interactive config editor")
    .action(async () => {
      const sessionConfig = loadConfig();
      const L = sessionConfig.language ?? "zh-CN";

      // Auto-check for updates (non-blocking notification)
      notifyUpdate(sessionConfig);

      console.log("");
      console.log(pc.bold(pc.cyan("  " + t("config.title", L))));
      console.log(pc.dim("  " + t("config.subtitle", L)));
      console.log("");
      await mainMenu(sessionConfig);
    });
}

// ── Main menu (deferred writes) ──────────────────────────

async function mainMenu(c: Config): Promise<void> {
  let discard = false;
  let save = false;

  while (!save && !discard) {
    const L = c.language ?? "zh-CN";
    const vCount = Object.keys(c.providers).length;
    const priceCount = Object.keys(c.prices).length;
    const autoOn = isAutoStartEnabled();

    const choice = await select({
      message: t("config.prompt", L),
      choices: [
        {
          value: "proxy",
          name: pc.bold(t("config.proxy", L)) + pc.dim("       " + c.proxy.host + ":" + c.proxy.port),
          description: t("config.desc.proxy", L),
        },
        {
          value: "providers",
          name: pc.bold(t("config.providers", L)) + pc.dim("  (" + vCount + (L === "zh-CN" ? " 个" : "") + ")"),
          description: t("config.desc.providers", L),
        },
        {
          value: "prices",
          name: pc.bold(t("config.prices", L)) + pc.dim("    (" + priceCount + (L === "zh-CN" ? " 个" : "") + ")"),
          description: t("config.desc.prices", L),
        },
        {
          value: "budget",
          name: pc.bold(t("config.budget", L)) + pc.dim(
            "      " + (c.budget?.dailyUsd ? "$" + c.budget.dailyUsd + "/" + (L === "zh-CN" ? "天" : "day") : t("config.budgetNotSet", L)) +
            (c.budget?.alert ? t("config.budgetAlertOn", L) : "")
          ),
          description: t("config.desc.budget", L),
        },
        {
          value: "default",
          name: pc.bold(t("config.default", L)) + pc.dim(
            "      " + (c.defaultProvider ?? t("config.budgetNotSet", L))
          ),
          description: t("config.desc.default", L),
        },
        {
          value: "smallFast",
          name: pc.bold(t("config.smallFast", L)) + pc.dim(
            "  " + (c.smallFastModel ? c.smallFastModel.model + " @ " + c.smallFastModel.provider : t("config.smallNotSet", L))
          ),
          description: t("config.desc.smallFast", L),
        },
        {
          value: "language",
          name: pc.bold(t("config.language", L)) + pc.dim("  " + (L === "zh-CN" ? "简体中文" : "English")),
          description: t("config.desc.language", L),
        },
        {
          value: "autostart",
          name: pc.bold(t("config.autostart", L)) + pc.dim(
            "  " + (autoOn ? (L === "zh-CN" ? "已启用" : "Enabled") : (L === "zh-CN" ? "已禁用" : "Disabled"))
          ),
          description: t("config.desc.autostart", L),
        },
        {
          value: "sync",
          name: pc.bold(t("config.sync", L)),
          description: t("config.desc.sync", L),
        },
        new Separator(),
        {
          value: "discard",
          name: pc.red(t("config.discard", L)),
          description: t("config.desc.discard", L),
        },
        {
          value: "done",
          name: pc.green(t("config.done", L)),
          description: t("config.desc.done", L),
        },
      ],
      pageSize: 14,
    });

    if (choice === "done") { save = true; continue; }
    if (choice === "discard") { discard = true; continue; }
    if (choice === "language") { await editLanguage(c); continue; }
    if (choice === "autostart") { await editAutoStart(c); continue; }
    if (choice === "sync") { await editSyncSettings(c); continue; }

    console.log("");
    switch (choice) {
      case "proxy": await editProxy(c); break;
      case "providers": await editProviders(c); break;
      case "prices": await editPrices(c); break;
      case "budget": await editBudget(c); break;
      case "default": await editDefault(c); break;
      case "smallFast": await editSmallFast(c); break;
    }
  }

  if (save) {
    saveConfig(c);
    console.log("");
    const L = c.language ?? "zh-CN";
    console.log(pc.green(t("config.saved", L)) + pc.dim(" ~/.ccmm/config.json"));
    console.log(pc.yellow("  " + t("config.restartHint", L) + " ") + pc.cyan("ccmm start") + pc.yellow(" " + t("config.restartHint2", L)));
    console.log("");
  }
  // discard: just exit without saving
}

// ── Proxy ─────────────────────────────────────────────────

async function editProxy(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  console.log(pc.bold(t("proxy.title", L)));
  console.log("");

  const host = await input({
    message: t("proxy.host", L),
    default: c.proxy.host,
    validate: (v: string) => v.trim().length > 0 ? true : t("proxy.required", L),
  });

  const portStr = await input({
    message: t("proxy.port", L),
    default: String(c.proxy.port),
    validate: (v: string) => {
      const n = parseInt(v, 10);
      if (isNaN(n) || n < 1 || n > 65535) return t("proxy.portErr", L);
      return true;
    },
  });

  c.proxy = { host: host.trim(), port: parseInt(portStr, 10) };
  console.log(pc.green(t("proxy.updated", L)));
  console.log("");
}

// ── Providers ─────────────────────────────────────────────

async function editProviders(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  let back = false;
  while (!back) {
    const names = Object.keys(c.providers);
    const action = await select({
      message: t("prov.title", L),
      choices: [
        ...names.map((n) => {
          const pv = c.providers[n]!;
          const slots = pv.modelMap ? Object.keys(pv.modelMap).length : 0;
          return {
            value: "edit:" + n,
            name: pc.bold(n) + pc.dim(" → " + pv.baseUrl + (slots > 0 ? " (" + slots + ")" : "")),
            description: t("prov.desc", L),
          };
        }),
        { value: "add", name: pc.green(t("prov.add", L)), description: "" },
        new Separator(),
        { value: "back", name: pc.dim(t("prov.back", L)), description: "" },
      ],
      pageSize: 12,
    });

    if (action === "back") { back = true; continue; }
    if (action === "add") { await addProviderInteractive(c); continue; }
    if (action.startsWith("edit:")) { await editOneProvider(action.slice(5)!, c); }
  }
}

async function addProviderInteractive(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  console.log(pc.bold(t("prov.titleAdd", L)));
  console.log("");

  const provChoices = [
    ...PROVIDER_TEMPLATES.map((pt) => ({
      value: pt.id, name: pc.bold(pt.name) + pc.dim("  — " + pt.baseUrl), description: pt.description,
    })),
    { value: "__custom__", name: pc.bold(t("prov.custom", L)) + pc.dim("  — URL"), description: t("prov.customDesc", L) },
  ];

  const provChoice = await select({ message: t("prov.type", L), choices: provChoices, pageSize: 10 });

  let baseUrl: string, apiKeyEnv: string;
  if (provChoice === "__custom__") {
    baseUrl = await input({ message: t("prov.baseUrl", L), validate: (v: string) => v.length > 0 ? true : t("proxy.required", L), default: "https://api.deepseek.com/anthropic" });
    apiKeyEnv = await input({ message: t("prov.envName", L), default: "CUSTOM_API_KEY" });
  } else {
    const tmpl = PROVIDER_TEMPLATES.find((p) => p.id === provChoice);
    baseUrl = tmpl?.baseUrl ?? "";
    apiKeyEnv = tmpl?.apiKeyEnv ?? "";
  }

  console.log("");
  const apiKey = await password({ mask: "*", message: t("prov.apiKey", L), validate: (v: string) => v.length > 0 ? true : t("proxy.required", L) });

  console.log("");
  const existingCount = Object.keys(c.providers).filter((k) => k.startsWith(provChoice)).length;
  const defaultName = provChoice + (existingCount > 0 ? "-" + (existingCount + 1) : "");
  const configName = await input({
    message: t("prov.nameMsg", L), default: defaultName,
    validate: (v: string) => { if (!v.trim()) return t("proxy.required", L); if (c.providers[v.trim()]) return t("prov.nameExists", L); return true; },
  });

  console.log("");
  const addMap = await confirm({ message: t("prov.askModelMap", L), default: false });
  const modelMap: Record<string, string> = {};
  if (addMap) {
    const slots = ["ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL", "ANTHROPIC_DEFAULT_HAIKU_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL"];
    const labels = ["Default", "High/XHigh", "Medium", "Low", "Subagent"];
    console.log("");
    for (let i = 0; i < slots.length; i++) {
      const part = await input({ message: labels[i]! + " — " + slots[i]! + ":", default: "" });
      if (part.trim()) modelMap[slots[i]!] = part.trim().replace(/\[\d+[km]\]$/i, "");
    }
  }

  const name = configName.trim();
  c.providers[name] = { baseUrl, apiKeyEnv, wire: "anthropic" as const, modelMap: Object.keys(modelMap).length > 0 ? modelMap : undefined, apiKey };
  if (Object.keys(c.providers).length === 1) c.defaultProvider = name;
  console.log(pc.green(t("prov.added", L)) + pc.bold(name));
  console.log("");
}

async function editOneProvider(name: string, c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  const pv = c.providers[name];
  if (!pv) return;

  const slots = pv.modelMap ? Object.keys(pv.modelMap).length : 0;
  const action = await select({
    message: t("prov.chooseAction", L) + pc.bold(name) + t("prov.chooseAction2", L),
    choices: [
      { value: "edit", name: t("prov.editUrl", L) },
      { value: "key", name: t("prov.editKey", L) },
      { value: "modelmap", name: t("prov.editMap", L) + slots + ")" },
      { value: "rename", name: t("prov.rename", L), description: t("prov.renameDesc", L) },
      { value: "delete", name: pc.red(t("prov.delete", L)) },
      new Separator(),
      { value: "back", name: pc.dim(t("prov.back", L)) },
    ],
  });

  if (action === "back") return;

  if (action === "rename") {
    console.log("");
    const newName = await input({
      message: pc.bold(name) + t("prov.renameMsg", L), default: name,
      validate: (v: string) => { if (!v.trim()) return t("proxy.required", L); if (v.trim() !== name && c.providers[v.trim()]) return t("prov.nameExists", L); return true; },
    });
    const tname = newName.trim();
    if (tname !== name) {
      c.providers[tname] = pv; delete c.providers[name];
      if (c.defaultProvider === name) c.defaultProvider = tname;
      if (c.smallFastModel?.provider === name) c.smallFastModel.provider = tname;
      console.log(pc.green(t("prov.renamed", L)) + name + pc.dim(" → ") + pc.bold(tname));
    } else { console.log(pc.dim(t("prov.nameUnchanged", L))); }
    console.log("");
    return;
  }

  if (action === "delete") {
    const ok = await confirm({ message: t("prov.confirmDelete", L) + pc.bold(name) + "?", default: false });
    if (ok) {
      delete c.providers[name];
      if (c.defaultProvider === name) c.defaultProvider = undefined;
      if (c.smallFastModel?.provider === name) c.smallFastModel = undefined;
      console.log(pc.green(t("prov.deleted", L)) + name);
    }
    return;
  }

  if (action === "key") {
    const newKey = await password({ mask: "*", message: name + t("prov.newKey", L), validate: (v: string) => v.length > 0 ? true : t("proxy.required", L) });
    c.providers[name] = { ...pv, apiKey: newKey };
    console.log(pc.green("✓" + pc.bold(name) + t("prov.keyUpdated", L)));
    console.log("");
    return;
  }

  if (action === "modelmap") {
    const slotsK = ["ANTHROPIC_MODEL", "ANTHROPIC_DEFAULT_OPUS_MODEL", "ANTHROPIC_DEFAULT_SONNET_MODEL", "ANTHROPIC_DEFAULT_HAIKU_MODEL", "CLAUDE_CODE_SUBAGENT_MODEL"];
    const labels = ["Default", "High/XHigh", "Medium", "Low", "Subagent"];
    const current = pv.modelMap ?? {};
    console.log("");
    console.log(pc.bold(t("prov.editMapTitle", L) + name + t("prov.editMapTitle2", L)));
    console.log(pc.dim(t("prov.editMapHint", L)));
    console.log("");
    const modelMap: Record<string, string> = {};
    for (let i = 0; i < slotsK.length; i++) {
      const part = await input({ message: labels[i]! + " — " + slotsK[i]! + ":", default: current[slotsK[i]!] ?? "" });
      if (part.trim()) modelMap[slotsK[i]!] = part.trim().replace(/\[\d+[km]\]$/i, "");
    }
    c.providers[name] = { ...pv, modelMap: Object.keys(modelMap).length > 0 ? modelMap : undefined };
    console.log(pc.green("✓" + pc.bold(name) + t("prov.mapUpdated", L)));
    console.log("");
    return;
  }

  // Edit baseUrl / key env
  console.log("");
  const baseUrl = await input({ message: t("prov.baseUrl", L), default: pv.baseUrl, validate: (v: string) => v.length > 0 ? true : t("proxy.required", L) });
  const apiKeyEnv = await input({ message: t("prov.envName", L), default: pv.apiKeyEnv ?? "" });
  c.providers[name] = { ...pv, baseUrl: baseUrl.trim(), apiKeyEnv: apiKeyEnv.trim() || undefined };
  console.log(pc.green(t("prov.updated", L)) + pc.bold(name));
  console.log("");
}

// ── Pricing ───────────────────────────────────────────────

async function editPrices(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  let back = false;
  while (!back) {
    const models = Object.keys(c.prices);
    const action = await select({
      message: t("price.title", L),
      choices: [
        ...models.map((m) => {
          const pr = c.prices[m]!;
          return { value: "edit:" + m, name: pc.bold(m) + pc.dim("  $" + pr.input + "/$" + pr.output), description: t("price.desc", L) };
        }),
        { value: "add", name: pc.green(t("price.add", L)) },
        new Separator(),
        { value: "back", name: pc.dim(t("prov.back", L)) },
      ],
      pageSize: 12,
    });
    if (action === "back") { back = true; continue; }
    if (action === "add") { await addPrice(c); continue; }
    if (action.startsWith("edit:")) { await editOnePrice(action.slice(5)!, c); }
  }
}

async function addPrice(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  console.log(pc.bold(t("price.titleAdd", L)));
  console.log("");
  const model = await input({ message: t("price.modelId", L), validate: (v: string) => v.trim().length > 0 ? true : t("proxy.required", L) });
  await inputPriceFields(model.trim(), c);
}

async function editOnePrice(model: string, c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  if (!c.prices[model]) return;
  const action = await select({
    message: pc.bold(model) + t("price.chooseAction", L),
    choices: [
      { value: "edit", name: t("price.edit", L) },
      { value: "delete", name: pc.red(t("price.delete", L)) },
      new Separator(),
      { value: "back", name: pc.dim(t("prov.back", L)) },
    ],
  });
  if (action === "back") return;
  if (action === "delete") {
    const ok = await confirm({ message: t("price.confirmDel", L) + pc.bold(model) + t("price.confirmDel2", L), default: false });
    if (ok) { delete c.prices[model]; console.log(pc.green(t("price.deleted", L)) + model); }
    return;
  }
  await inputPriceFields(model, c);
}

async function inputPriceFields(model: string, c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  console.log("");
  console.log(pc.dim(t("price.unitHint", L)));
  console.log("");
  const ip = await input({ message: t("price.inputP", L), default: "3.00", validate: (v: string) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0 ? true : t("price.mustGe0", L) });
  const op = await input({ message: t("price.outputP", L), default: "15.00", validate: (v: string) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0 ? true : t("price.mustGe0", L) });
  const cr = await input({ message: t("price.cacheReadP", L), default: "0", validate: (v: string) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0 ? true : t("price.mustGe0", L) });
  const cw = await input({ message: t("price.cacheWriteP", L), default: "0", validate: (v: string) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0 ? true : t("price.mustGe0", L) });
  c.prices[model] = { input: parseFloat(ip), output: parseFloat(op), cacheRead: parseFloat(cr), cacheWrite: parseFloat(cw) };
  console.log(pc.green(t("price.set", L)) + pc.bold(model));
  console.log("");
}

// ── Budget ────────────────────────────────────────────────

async function editBudget(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  console.log(pc.bold(t("budget.title", L)));
  console.log("");
  const set = await confirm({ message: t("budget.enable", L), default: !!c.budget?.dailyUsd });
  if (!set) { c.budget = undefined; console.log(pc.green(t("budget.disabled", L))); console.log(""); return; }
  const dailyStr = await input({ message: t("budget.amount", L), default: String(c.budget?.dailyUsd ?? 20), validate: (v: string) => !isNaN(parseFloat(v)) && parseFloat(v) > 0 ? true : t("budget.mustGt0", L) });
  const alert = await confirm({ message: t("budget.alert", L), default: c.budget?.alert ?? true });
  c.budget = { dailyUsd: parseFloat(dailyStr), alert };
  console.log(pc.green(t("budget.updated", L)));
  console.log("");
}

// ── Default provider ──────────────────────────────────────

async function editDefault(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  console.log(pc.bold(t("default.title", L)));
  console.log("");
  const names = Object.keys(c.providers);
  if (names.length === 0) { console.log(pc.yellow("  " + t("default.noProviders", L))); console.log(""); return; }
  const choice = await select({
    message: t("default.msg", L),
    choices: [
      { value: "", name: pc.dim(t("default.none", L)), description: t("default.noneDesc", L) },
      ...names.map((n) => ({ value: n, name: n + " → " + c.providers[n]!.baseUrl })),
    ],
  });
  c.defaultProvider = choice || undefined;
  console.log(pc.green(t("default.updated", L)) + (choice || t("default.none", L)));
  console.log("");
}

// ── Small/Fast ────────────────────────────────────────────

async function editSmallFast(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  console.log(pc.bold(t("sf.title", L)));
  console.log(pc.dim(t("sf.hint", L)));
  console.log("");
  const set = await confirm({ message: t("sf.enable", L), default: !!c.smallFastModel });
  if (!set) { c.smallFastModel = undefined; console.log(pc.green(t("sf.disabled", L))); console.log(""); return; }
  const model = await input({ message: t("sf.model", L), default: c.smallFastModel?.model ?? "claude-haiku-4-5-20251001", validate: (v: string) => v.trim().length > 0 ? true : t("proxy.required", L) });
  const vNames = Object.keys(c.providers);
  const provider = vNames.length === 1 ? vNames[0]! : await input({ message: t("sf.provider", L), default: c.smallFastModel?.provider ?? vNames[0] ?? "anthropic", validate: (v: string) => v.trim().length > 0 ? true : t("proxy.required", L) });
  c.smallFastModel = { model: model.trim(), provider: provider.trim() };
  console.log(pc.green(t("sf.updated", L)) + model.trim() + " @ " + provider.trim());
  console.log("");
}

// ── Language ──────────────────────────────────────────────

async function editLanguage(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  console.log(pc.bold(t("lang.title", L)));
  console.log("");
  const choice = await select({
    message: t("lang.msg", L),
    choices: [
      { value: "zh-CN", name: t("lang.zh", L) },
      { value: "en", name: t("lang.en", L) },
    ],
    default: L,
  });
  c.language = choice as Lang;
  console.log(pc.green(t("lang.updated", L)) + (choice === "zh-CN" ? "简体中文" : "English"));
  console.log("");
}

// ── Auto-start ────────────────────────────────────────────

async function editAutoStart(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  const enabled = isAutoStartEnabled();
  console.log(pc.bold(t("as.title", L)));
  console.log("");
  console.log(pc.dim("  " + (enabled ? t("as.statusOn", L) : t("as.statusOff", L))));
  console.log("");

  const action = await select({
    message: t("as.action", L),
    choices: [
      { value: "enable", name: t("as.enable", L) },
      { value: "disable", name: t("as.disable", L) },
      new Separator(),
      { value: "back", name: pc.dim(t("prov.back", L)) },
    ],
  });

  if (action === "back") { console.log(""); return; }
  if (action === "enable") { enableAutoStart(); console.log(pc.green(t("as.enabled", L))); }
  if (action === "disable") { disableAutoStart(); console.log(pc.green(t("as.disabled2", L))); }
  console.log("");
}

// ── Sync Claude Code settings ──────────────────────────────

async function editSyncSettings(c: Config): Promise<void> {
  const L = c.language ?? "zh-CN";
  console.log(pc.bold(t("sync.title", L)));
  console.log("");

  // Find settings.json
  let sp = "";
  for (const p of claudeSettingsPaths()) {
    if (fs.existsSync(p)) { sp = p; break; }
  }
  if (!sp || !fs.existsSync(sp)) {
    console.log(pc.yellow(t("sync.nosettings", L)));
    console.log("");
    return;
  }

  console.log(pc.dim(t("sync.checking", L)));

  let settings: Record<string, unknown> = {};
  try { settings = JSON.parse(fs.readFileSync(sp, "utf-8")); } catch { /* use empty */ }

  const currentSL = (settings.statusLine as { command?: string })?.command;
  const isOurs = currentSL === "ccmm statusline";
  console.log(t("sync.found", L) + " " + (isOurs ? pc.green(t("sync.ours", L)) : pc.yellow(currentSL || t("sync.other", L))));

  if (!isOurs) {
    console.log("");
    const overwrite = await confirm({
      message: t("sync.overwrite", L),
      default: true,
    });
    if (!overwrite) { console.log(""); return; }
  }

  // Backup
  const bk = sp + "." + new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19) + ".bak";
  fs.copyFileSync(sp, bk);
  console.log(pc.dim((L === "zh-CN" ? "  已备份: " : "  Backed up: ") + bk));

  if (!isOurs && !settings.statusLine) {
    settings.statusLine = { type: "command", command: "ccmm statusline" };
  } else if (!isOurs) {
    const sl = settings.statusLine as Record<string, unknown> || {};
    sl.command = "ccmm statusline";
    sl.type = "command";
    settings.statusLine = sl;
  }

  const env = (settings.env as Record<string, string>) || {};
  env.ANTHROPIC_BASE_URL = "http://" + c.proxy.host + ":" + c.proxy.port;
  env.ANTHROPIC_AUTH_TOKEN = env.ANTHROPIC_AUTH_TOKEN || "ccmm-proxy";
  settings.env = env;

  fs.mkdirSync(dirname(sp), { recursive: true });
  fs.writeFileSync(sp, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  console.log(pc.green(t("synced", L)));
  console.log("");
}

// ── Update notification helper ─────────────────────────

const VERSION = "0.1.7";

function notifyUpdate(c: Config): void {
  try {
    const L = c.language ?? "zh-CN";
    const info = checkForUpdate(VERSION);
    if (info?.hasUpdate) {
      console.log(pc.yellow("  ⚡ " + t("update.notify", L) + info.latestVersion + t("update.notifyHint", L)));
    }
  } catch { /* silent — never block the user */ }
}
