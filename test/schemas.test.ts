import { describe, it, expect } from "vitest";
import { RouteStateSchema, createDefaultState } from "../src/schemas/state.js";
import {
  UsageRecordSchema,
  MetricEntrySchema,
  EMPTY_AGGREGATE,
} from "../src/schemas/metrics.js";
import { ConfigSchema } from "../src/schemas/config.js";

// ── RouteStateSchema ───────────────────────────────────────────

describe("RouteStateSchema", () => {
  it("accepts a valid route state", () => {
    const result = RouteStateSchema.safeParse({
      provider: "anthropic",
      model: "claude-sonnet-4-20250514",
      updatedAt: "2026-07-21T10:00:00.000Z",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty provider", () => {
    const result = RouteStateSchema.safeParse({
      provider: "",
      model: "some-model",
      updatedAt: "2026-07-21T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty model", () => {
    const result = RouteStateSchema.safeParse({
      provider: "anthropic",
      model: "",
      updatedAt: "2026-07-21T10:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-ISO datetime for updatedAt", () => {
    const result = RouteStateSchema.safeParse({
      provider: "anthropic",
      model: "claude-sonnet",
      updatedAt: "yesterday",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = RouteStateSchema.safeParse({ provider: "a" });
    expect(result.success).toBe(false);
  });
});

// ── createDefaultState ─────────────────────────────────────────

describe("createDefaultState", () => {
  it("returns a valid route state with the given provider and model", () => {
    const state = createDefaultState("deepseek", "deepseek-v4-pro");
    expect(state.provider).toBe("deepseek");
    expect(state.model).toBe("deepseek-v4-pro");
  });

  it("sets updatedAt to a current ISO timestamp", () => {
    const before = new Date().toISOString();
    const state = createDefaultState("a", "b");
    const after = new Date().toISOString();
    expect(state.updatedAt >= before).toBe(true);
    expect(state.updatedAt <= after).toBe(true);
  });

  it("passes RouteStateSchema validation", () => {
    const state = createDefaultState("anthropic", "claude-opus-4-1-20250805");
    expect(RouteStateSchema.safeParse(state).success).toBe(true);
  });
});

// ── UsageRecordSchema ──────────────────────────────────────────

describe("UsageRecordSchema", () => {
  it("accepts minimal valid usage", () => {
    const result = UsageRecordSchema.safeParse({ inputTokens: 0, outputTokens: 0 });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cacheReadTokens).toBe(0);
      expect(result.data.cacheWriteTokens).toBe(0);
    }
  });

  it("rejects negative inputTokens", () => {
    const result = UsageRecordSchema.safeParse({ inputTokens: -1, outputTokens: 10 });
    expect(result.success).toBe(false);
  });

  it("rejects floating-point token counts", () => {
    const result = UsageRecordSchema.safeParse({ inputTokens: 1.5, outputTokens: 10 });
    expect(result.success).toBe(false);
  });

  it("accepts cache token fields", () => {
    const result = UsageRecordSchema.safeParse({
      inputTokens: 5000,
      outputTokens: 800,
      cacheReadTokens: 2000,
      cacheWriteTokens: 1000,
    });
    expect(result.success).toBe(true);
  });
});

// ── MetricEntrySchema ──────────────────────────────────────────

describe("MetricEntrySchema", () => {
  const validEntry = {
    ts: "2026-07-21T12:00:00.000Z",
    sessionId: "abc12345",
    provider: "anthropic",
    requestedModel: "claude-sonnet-4-20250514",
    effectiveModel: "claude-opus-4-1-20250805",
    inputTokens: 2000,
    outputTokens: 500,
    cacheReadTokens: 1000,
    cacheWriteTokens: 0,
    costUsd: 0.015,
    status: 200,
    latencyMs: 1200,
  };

  it("accepts a complete valid metric entry", () => {
    const result = MetricEntrySchema.safeParse(validEntry);
    expect(result.success).toBe(true);
  });

  it("defaults cache tokens to 0 when omitted", () => {
    const { cacheReadTokens, cacheWriteTokens, ...rest } = validEntry;
    const result = MetricEntrySchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cacheReadTokens).toBe(0);
      expect(result.data.cacheWriteTokens).toBe(0);
    }
  });

  it("rejects negative cost", () => {
    const result = MetricEntrySchema.safeParse({ ...validEntry, costUsd: -0.01 });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer status", () => {
    const result = MetricEntrySchema.safeParse({ ...validEntry, status: 200.5 });
    expect(result.success).toBe(false);
  });

  it("rejects negative latency", () => {
    const result = MetricEntrySchema.safeParse({ ...validEntry, latencyMs: -1 });
    expect(result.success).toBe(false);
  });

  it("rejects invalid ts format", () => {
    const result = MetricEntrySchema.safeParse({ ...validEntry, ts: "2026/07/21" });
    expect(result.success).toBe(false);
  });
});

// ── EMPTY_AGGREGATE ────────────────────────────────────────────

describe("EMPTY_AGGREGATE", () => {
  it("has all numeric fields initialized to 0", () => {
    expect(EMPTY_AGGREGATE.sessionCost).toBe(0);
    expect(EMPTY_AGGREGATE.todayCost).toBe(0);
    expect(EMPTY_AGGREGATE.sessionInput).toBe(0);
    expect(EMPTY_AGGREGATE.sessionOutput).toBe(0);
    expect(EMPTY_AGGREGATE.sessionCacheRead).toBe(0);
    expect(EMPTY_AGGREGATE.sessionCacheWrite).toBe(0);
    expect(EMPTY_AGGREGATE.todayInput).toBe(0);
    expect(EMPTY_AGGREGATE.todayOutput).toBe(0);
    expect(EMPTY_AGGREGATE.todayCacheRead).toBe(0);
    expect(EMPTY_AGGREGATE.todayCacheWrite).toBe(0);
    expect(EMPTY_AGGREGATE.requestCount).toBe(0);
  });
});

// ── ConfigSchema currency ───────────────────────────────────────

describe("ConfigSchema currency", () => {
  it("defaults currency to USD", () => {
    const result = ConfigSchema.parse({});
    expect(result.currency).toBe("USD");
  });

  it("accepts CNY currency", () => {
    const result = ConfigSchema.parse({ currency: "CNY" });
    expect(result.currency).toBe("CNY");
  });

  it("accepts USD currency", () => {
    const result = ConfigSchema.parse({ currency: "USD" });
    expect(result.currency).toBe("USD");
  });

  it("rejects invalid currency", () => {
    const result = ConfigSchema.safeParse({ currency: "EUR" });
    expect(result.success).toBe(false);
  });
});
