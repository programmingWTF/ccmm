import type { Command } from "commander";
import { existsSync } from "node:fs";
import { ccmmDir } from "../util/paths.js";
import { loadConfig } from "../store/config.js";
import { loadState } from "../store/state.js";
import { isProxyRunning } from "../proxy/server.js";
import { t } from "../i18n/index.js";
import pc from "picocolors";

const CONFLICT_KEYS = ["ANTHROPIC_BASE_URL", "ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_MODEL"];

export function registerDoctor(program: Command): void {
  program.command("doctor")
    .description("诊断配置 / Diagnose ccmm setup")
    .action(() => {
      const L = loadConfig().language ?? "zh-CN";
      console.log(pc.bold(t("doctor.title", L)));
      const ck = (label: string, ok: boolean, detail?: string) => {
        const icon = ok ? pc.green("PASS") : pc.red("FAIL");
        console.log(icon + " " + label + (detail ? ": " + detail : ""));
      };

      ck(t("doctor.dir", L), existsSync(ccmmDir()), ccmmDir());

      try {
        const c = loadConfig();
        ck(t("doctor.config", L), true, Object.keys(c.providers).length + (L === "zh-CN" ? " 个方案" : " providers"));
      } catch (e: unknown) {
        ck(t("doctor.config", L), false, (e as Error).message);
      }

      try { loadState(); ck(t("doctor.state", L), true); }
      catch (e: unknown) { ck(t("doctor.state", L), false, (e as Error).message); }

      ck(t("doctor.proxy", L), isProxyRunning());

      const conflicts: string[] = [];
      for (const key of CONFLICT_KEYS) {
        if (process.env[key]) conflicts.push(key + "=" + process.env[key]);
      }
      if (conflicts.length > 0) {
        console.log("");
        console.log(pc.red("  WARNING: System env vars override settings.json!"));
        for (const c of conflicts) {
          const short = c.length > 70 ? c.slice(0, 70) + "..." : c;
          console.log(pc.dim("    " + short));
        }
        console.log("");
        console.log(pc.yellow("  These env vars take priority over Claude Code settings."));
        console.log(pc.yellow("  If ANTHROPIC_BASE_URL points elsewhere, requests bypass ccmm."));
        console.log("");
        console.log(pc.bold("  To fix:"));
        console.log(pc.dim("    PowerShell: Remove-Item Env:ANTHROPIC_BASE_URL"));
        console.log(pc.dim("    CMD:        set ANTHROPIC_BASE_URL="));
      } else {
        ck(
          L === "zh-CN" ? "无冲突环境变量" : "No conflicting env vars",
          true
        );
      }

      try {
        const config = loadConfig();
        for (const [name] of Object.entries(config.providers)) {
          ck(L === "zh-CN" ? "方案 " + name : "Provider " + name, true);
        }
      } catch { /* ok */ }
    });
}
