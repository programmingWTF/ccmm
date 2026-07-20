import type { Command } from "commander";
import { loadState } from "../store/state.js";
import { loadConfig } from "../store/config.js";
import { t } from "../i18n/index.js";
import pc from "picocolors";

export function registerCurrent(program: Command) {
  program
    .command("current")
    .description("显示当前活跃方案 / Show active route")
    .action(() => {
      const state = loadState();
      const L = loadConfig().language ?? "zh-CN";
      console.log(pc.bold(t("current.title", L)));
      console.log(t("current.provider", L), pc.bold(state.provider));
      console.log(t("current.model", L), state.model);
      console.log(t("current.updated", L), state.updatedAt);
    });
}
