import type { Command } from "commander";
import { setActiveRoute } from "../store/state.js";
import { loadConfig } from "../store/config.js";
import { t } from "../i18n/index.js";
import pc from "picocolors";

export function registerUse(program: Command) {
  program
    .command("use")
    .argument("<name>", "方案名 / provider name")
    .description("切换活跃方案 / Switch the active provider")
    .action(async (target) => {
      const state = setActiveRoute(target);
      const L = loadConfig().language ?? "zh-CN";
      console.log(pc.green(t("use.switched", L)), pc.bold(state.provider));
      console.log(pc.dim(t("use.defaultModel", L)), state.model);
      console.log(pc.dim(t("use.nextReq", L)));
    });
}
