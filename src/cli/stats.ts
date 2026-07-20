import type { Command } from "commander";
import { listMetrics, getAggregate } from "../store/metrics.js";
import { loadConfig } from "../store/config.js";
import { formatTokens, formatUsd } from "../util/format.js";
import { t } from "../i18n/index.js";
import pc from "picocolors";

export function registerStats(program: Command) {
  program.command("stats").argument("[range]", "today, session, week, or all")
    .description("用量与费用统计 / Usage & cost stats")
    .action((range = "today") => {
      const L = loadConfig().language ?? "zh-CN";
      const metrics = listMetrics(range);
      const agg = getAggregate();
      const cost = range === "session" ? agg.sessionCost : agg.todayCost;
      const tin = range === "session" ? agg.sessionInput : agg.todayInput;
      const tout = range === "session" ? agg.sessionOutput : agg.todayOutput;
      console.log(pc.bold(t("stats.title", L) + range));
      console.log(t("stats.requests", L), metrics.length);
      console.log(t("stats.tokensIn", L), formatTokens(tin), t("stats.tokensOut", L), formatTokens(tout));
      console.log(t("stats.cost", L), pc.bold(formatUsd(cost)));
      if (metrics.length > 0) {
        const byModel: Record<string, number> = {};
        for (const m of metrics) { byModel[m.effectiveModel] = (byModel[m.effectiveModel] || 0) + m.costUsd; }
        console.log(t("stats.byModel", L));
        for (const [model, c] of Object.entries(byModel)) { console.log("  " + model + ": " + formatUsd(c)); }
      }
    });
}
