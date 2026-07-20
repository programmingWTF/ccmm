import type { Command } from "commander";
import { mkdirSync, readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { dirname } from "node:path";
import { ensureConfigExists, loadConfig } from "../store/config.js";
import { loadState, saveState } from "../store/state.js";
import { ccmmDir, claudeSettingsPaths, statePath } from "../util/paths.js";
import { t } from "../i18n/index.js";
import pc from "picocolors";

export function registerInit(program: Command) {
  program.command("init")
    .description("初始化 ccmm / Initialize ccmm")
    .action(async () => {
      const c = ensureConfigExists();
      const L = c.language ?? "zh-CN";
      console.log(pc.bold(t("init.title", L)));
      mkdirSync(ccmmDir(), { recursive: true });
      console.log(pc.green("✓"), t("init.config", L), ccmmDir() + "/config.json");
      const state = loadState();
      saveState(state);
      console.log(pc.green("✓"), t("init.state", L), statePath());

      let ok = false;
      for (const sp of claudeSettingsPaths()) {
        try {
          let s: Record<string, unknown> = {};
          if (existsSync(sp)) {
            s = JSON.parse(readFileSync(sp, "utf-8"));
            const bk = sp + ".ccmm-backup";
            if (!existsSync(bk)) copyFileSync(sp, bk);
          }
          const env = (s.env as Record<string, string>) || {};
          env.ANTHROPIC_BASE_URL = "http://" + c.proxy.host + ":" + c.proxy.port;
          env.ANTHROPIC_AUTH_TOKEN = env.ANTHROPIC_AUTH_TOKEN || "ccmm-proxy";
          s.env = env;
          s.statusLine = { type: "command", command: "ccmm statusline" };
          mkdirSync(dirname(sp), { recursive: true });
          writeFileSync(sp, JSON.stringify(s, null, 2) + "\n", "utf-8");
          ok = true;
          console.log(pc.green("✓"), t("init.settings", L), sp);
          break;
        } catch { /* try next path */ }
      }
      if (!ok) {
        console.log(pc.yellow(t("init.settingsFail", L)));
        console.log(t("init.settingsHint", L));
      }
      console.log(pc.green("\n" + t("init.done", L) + " "), pc.bold("ccmm start"), pc.green(" " + t("init.done2", L)));
    });
}
