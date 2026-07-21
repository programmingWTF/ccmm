import { z } from "zod";

export const UsageRecordSchema = z.object({
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheWriteTokens: z.number().int().nonnegative().default(0),
});
export type UsageRecord = z.infer<typeof UsageRecordSchema>;

export const MetricEntrySchema = z.object({
  ts: z.string().datetime(),
  sessionId: z.string(),
  project: z.string().optional(),
  provider: z.string(),
  requestedModel: z.string(),
  effectiveModel: z.string(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  cacheReadTokens: z.number().int().nonnegative().default(0),
  cacheWriteTokens: z.number().int().nonnegative().default(0),
  costUsd: z.number().nonnegative(),
  status: z.number().int(),
  latencyMs: z.number().int().nonnegative(),
});
export type MetricEntry = z.infer<typeof MetricEntrySchema>;

export interface MetricsAggregate {
  sessionCost: number;
  todayCost: number;
  sessionInput: number;
  sessionOutput: number;
  sessionCacheRead: number;
  sessionCacheWrite: number;
  todayInput: number;
  todayOutput: number;
  todayCacheRead: number;
  todayCacheWrite: number;
  requestCount: number;
}

export const EMPTY_AGGREGATE: MetricsAggregate = {
  sessionCost: 0, todayCost: 0,
  sessionInput: 0, sessionOutput: 0, sessionCacheRead: 0, sessionCacheWrite: 0,
  todayInput: 0, todayOutput: 0, todayCacheRead: 0, todayCacheWrite: 0,
  requestCount: 0,
};

export interface StdinPayload {
  model?: { id?: string; display_name?: string };
  session_id?: string;
  workspace?: { current_dir?: string };
  transcript_path?: string;
  cost?: { total_cost_usd?: number; total_duration_ms?: number; total_lines_added?: number; total_lines_removed?: number };
}

export interface LiveSummary {
  activeModel: string;
  activeProvider: string;
  thinkingBudget?: number;
  budgetDaily?: number;
  aggregates: MetricsAggregate;
  updatedAt: string;
}
