import type { Command } from 'commander';
import { readSummary } from "../store/metrics.js";
import { formatTokens, formatUsd, formatPercent } from "../util/format.js";
import type { StdinPayload } from "../schemas/metrics.js";

export function registerStatusline(program: import("commander").Command): void {
  program.command("statusline").description("(内部) 渲染状态栏 / (internal) render status line").action(async () => {
    const output = await renderStatusLine();
    process.stdout.write(output);
    process.exit(0);
  });
}

async function renderStatusLine(): Promise<string> {
  const stdinJson = await readStdin(250);
  let payload: Partial<StdinPayload> = {};
  try { payload = JSON.parse(stdinJson || "{}"); } catch { /* ok */ }
  const summary = readSummary();
  if (summary) return renderFromSummary(summary);
  if (payload.model?.display_name) {
    const cost = payload.cost?.total_cost_usd;
    const name = payload.model.display_name.replace(/^claude-/, "").replace(/-202d+$/, "");
    return cost !== undefined ? name + " · " + formatUsd(cost) : name;
  }
  return "ccmm: waiting for request";
}

function renderFromSummary(summary: import("../schemas/metrics.js").LiveSummary): string {
  const parts: string[] = [];
  const agg = summary.aggregates;
  parts.push(summary.activeModel);
  if (agg.todayInput > 0 || agg.todayOutput > 0) {
    parts.push("▲" + formatTokens(agg.todayInput) + " ▼" + formatTokens(agg.todayOutput));
  }
  const ti = agg.todayCacheRead + agg.todayCacheWrite + agg.todayInput;
  if (ti > 0) parts.push("cache " + formatPercent(agg.todayCacheRead / ti));
  if (agg.todayCost > 0) parts.push(formatUsd(agg.todayCost) + " today");
  if (summary.budgetDailyUsd && summary.budgetDailyUsd > 0) {
    parts.push(formatUsd(Math.max(0, summary.budgetDailyUsd - agg.todayCost)) + " left");
  }
  return parts.join(" · ");
}

function readStdin(timeoutMs: number): Promise<string> {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) { resolve(""); return; }
    const timer = setTimeout(() => resolve(""), timeoutMs);
    let data = "";
    process.stdin.on("data", (chunk: string) => { data += chunk; });
    process.stdin.on("end", () => { clearTimeout(timer); resolve(data); });
    process.stdin.resume();
  });
}