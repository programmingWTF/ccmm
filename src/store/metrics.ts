import { appendFileSync, readFileSync, writeFileSync, createReadStream, mkdirSync, renameSync } from "node:fs";
import { createInterface } from "node:readline";
import { metricsPath, ccmmDir, summaryPath } from "../util/paths.js";
import { nowISO, todayKey, generateSessionId } from "../util/format.js";
import type { MetricEntry, MetricsAggregate, LiveSummary } from "../schemas/metrics.js";
import { EMPTY_AGGREGATE } from "../schemas/metrics.js";

let sessionId = generateSessionId();
let currentDay = todayKey();
let aggregate: MetricsAggregate = { ...EMPTY_AGGREGATE };

export function getSessionId(): string { return sessionId; }

export function resetSession(): void {
  sessionId = generateSessionId();
  aggregate.sessionCost = 0;
  aggregate.sessionInput = 0;
  aggregate.sessionOutput = 0;
  aggregate.sessionCacheRead = 0;
  aggregate.sessionCacheWrite = 0;
}

export function getAggregate(): MetricsAggregate {
  const today = todayKey();
  if (today !== currentDay) {
    aggregate.todayCost = 0;
    aggregate.todayInput = 0;
    aggregate.todayOutput = 0;
    aggregate.todayCacheRead = 0;
    aggregate.todayCacheWrite = 0;
    aggregate.requestCount = 0;
    currentDay = today;
  }
  return { ...aggregate };
}

export function appendMetric(entry: MetricEntry): void {
  mkdirSync(ccmmDir(), { recursive: true });
  const line = JSON.stringify(entry) + "\n";
  appendFileSync(metricsPath(), line, "utf-8");

  const today = todayKey();
  if (today !== currentDay) {
    aggregate.todayCost = 0;
    aggregate.todayInput = 0;
    aggregate.todayOutput = 0;
    aggregate.todayCacheRead = 0;
    aggregate.todayCacheWrite = 0;
    aggregate.requestCount = 0;
    currentDay = today;
  }

  aggregate.sessionCost += entry.costUsd;
  aggregate.todayCost += entry.costUsd;
  aggregate.sessionInput += entry.inputTokens;
  aggregate.sessionOutput += entry.outputTokens;
  aggregate.sessionCacheRead += entry.cacheReadTokens;
  aggregate.sessionCacheWrite += entry.cacheWriteTokens;
  aggregate.todayInput += entry.inputTokens;
  aggregate.todayOutput += entry.outputTokens;
  aggregate.todayCacheRead += entry.cacheReadTokens;
  aggregate.todayCacheWrite += entry.cacheWriteTokens;
  aggregate.requestCount += 1;
}

export function writeSummary(summary: LiveSummary): void {
  mkdirSync(ccmmDir(), { recursive: true });
  const tmp = summaryPath() + ".tmp";
  writeFileSync(tmp, JSON.stringify(summary) + "\n", "utf-8");
  renameSync(tmp, summaryPath());
}

export function readSummary(): LiveSummary | null {
  try {
    const raw = readFileSync(summaryPath(), "utf-8");
    return JSON.parse(raw) as LiveSummary;
  } catch { return null; }
}

export async function loadAggregateFromDisk(): Promise<void> {
  aggregate = { ...EMPTY_AGGREGATE };
  const today = todayKey();
  currentDay = today;

  try {
    const stream = createReadStream(metricsPath(), "utf-8");
    const rl = createInterface({ input: stream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;
      try {
        const entry: MetricEntry = JSON.parse(line);
        const entryDay = entry.ts.slice(0, 10);
        if (entryDay === today) {
          aggregate.todayCost += entry.costUsd;
          aggregate.todayInput += entry.inputTokens;
          aggregate.todayOutput += entry.outputTokens;
          aggregate.todayCacheRead += entry.cacheReadTokens;
          aggregate.todayCacheWrite += entry.cacheWriteTokens;
          aggregate.requestCount += 1;
        }
        if (entry.sessionId === sessionId) {
          aggregate.sessionCost += entry.costUsd;
          aggregate.sessionInput += entry.inputTokens;
          aggregate.sessionOutput += entry.outputTokens;
          aggregate.sessionCacheRead += entry.cacheReadTokens;
          aggregate.sessionCacheWrite += entry.cacheWriteTokens;
        }
      } catch { /* skip invalid lines */ }
    }
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as any).code !== "ENOENT") throw err;
  }
}

export function listMetrics(range: string = "all"): MetricEntry[] {
  const entries: MetricEntry[] = [];
  const today = todayKey();
  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  try {
    const raw = readFileSync(metricsPath(), "utf-8");
    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      try {
        const entry: MetricEntry = JSON.parse(line);
        const entryDay = entry.ts.slice(0, 10);
        if (range === "today" && entryDay !== today) continue;
        if (range === "session" && entry.sessionId !== sessionId) continue;
        if (range === "week" && entryDay < weekAgo) continue;
        entries.push(entry);
      } catch { /* skip */ }
    }
  } catch { /* file not found */ }
  return entries;
}
