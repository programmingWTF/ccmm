import type { Command } from "commander";
import pc from "picocolors";
import { confirm } from "@inquirer/prompts";
import { checkForUpdate, performUpdate } from "../util/update-check.js";
import { loadConfig } from "../store/config.js";
import { t } from "../i18n/index.js";

export function registerUpdate(program: Command, version: string): void {
  program.command("update")
    .description("检查并更新 ccmm / Check and update ccmm")
    .action(async () => {
      const c = loadConfig();
      const L = c.language ?? "zh-CN";

      console.log("");
      console.log(pc.bold(pc.cyan("  ccmm update")));
      console.log(pc.dim("  " + t("update.checking", L)));
      console.log("");

      const info = checkForUpdate(version, true);

      if (!info) {
        console.log(pc.yellow("  " + t("update.networkFail", L)));
        console.log(pc.dim("  " + t("update.networkHint", L)));
        console.log("");
        return;
      }

      console.log("  " + t("update.current", L) + pc.bold(info.currentVersion));
      console.log("  " + t("update.latest", L) + pc.bold(info.latestVersion));
      console.log("");

      if (!info.hasUpdate) {
        console.log(pc.green("  ✓ " + t("update.upToDate", L)));
        console.log("");
        return;
      }

      console.log(pc.yellow("  " + t("update.available", L)));
      console.log("");

      const ok = await confirm({
        message: t("update.confirm", L),
        default: true,
      });

      if (!ok) {
        console.log(pc.dim("  " + t("update.skipped", L)));
        console.log("");
        return;
      }

      console.log("");
      console.log(pc.dim("  " + t("update.installing", L)));
      console.log("");

      const success = performUpdate();

      if (success) {
        console.log("");
        console.log(pc.green("  ✓ " + t("update.done", L) + " " + info.latestVersion));
        console.log(pc.dim("  " + t("update.doneHint", L)));
      } else {
        console.log("");
        console.log(pc.red("  ✗ " + t("update.failed", L)));
        console.log(pc.dim("  " + t("update.failedHint", L)));
      }
      console.log("");
    });
}
