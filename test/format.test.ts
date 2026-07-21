import { describe, it, expect } from "vitest";
import {
  formatTokens,
  formatUsd,
  formatPercent,
  shortModelName,
  todayKey,
  generateSessionId,
  nowISO,
} from "../src/util/format.js";

// ── formatTokens ───────────────────────────────────────────────

describe("formatTokens", () => {
  it("returns plain number for values under 1k", () => {
    expect(formatTokens(0)).toBe("0");
    expect(formatTokens(1)).toBe("1");
    expect(formatTokens(999)).toBe("999");
  });

  it('formats 1k–999k with "k" suffix', () => {
    expect(formatTokens(1000)).toBe("1k");
    expect(formatTokens(1500)).toBe("1.5k");
    expect(formatTokens(10000)).toBe("10k");
    expect(formatTokens(999999)).toBe("1000k");
  });

  it('formats ≥1M with "M" suffix', () => {
    expect(formatTokens(1_000_000)).toBe("1M");
    expect(formatTokens(2_500_000)).toBe("2.5M");
    expect(formatTokens(10_000_000)).toBe("10M");
  });

  it("drops .0 for round numbers", () => {
    expect(formatTokens(2000)).toBe("2k");
    expect(formatTokens(3_000_000)).toBe("3M");
  });
});

// ── formatUsd ──────────────────────────────────────────────────

describe("formatUsd", () => {
  it("prefixes with $ and rounds to 2 decimals", () => {
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(1.5)).toBe("$1.50");
    expect(formatUsd(0.001)).toBe("$0.00");
    expect(formatUsd(123.456)).toBe("$123.46");
  });
});

// ── formatPercent ──────────────────────────────────────────────

describe("formatPercent", () => {
  it("converts rate 0–1 to integer percentage string", () => {
    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(0.875)).toBe("88%"); // Math.round
    expect(formatPercent(1)).toBe("100%");
  });
});

// ── shortModelName ─────────────────────────────────────────────

describe("shortModelName", () => {
  it("strips leading claude- prefix and compacts version numbers", () => {
    expect(shortModelName("claude-sonnet-4-20250514")).toBe("sonnet-4.20250514");
  });

  it("compacts multi-part version numbers with dots", () => {
    expect(shortModelName("claude-haiku-4-5-20251001")).toBe("haiku-4.5.20251001");
  });

  it("returns the name as-is if no numeric version parts found", () => {
    expect(shortModelName("gpt-4")).toBe("gpt-4");
  });

  it("only compacts segments that start with a digit", () => {
    // "v4" starts with 'v', not a digit — treated as non-version, whole string returned
    expect(shortModelName("deepseek-v4-pro")).toBe("deepseek-v4-pro");
    // "4" is a digit version → compacted; "turbo" is not a version → dropped
    expect(shortModelName("gpt-4-turbo")).toBe("gpt-4");
  });
});

// ── todayKey ────────────────────────────────────────────────────

describe("todayKey", () => {
  it("matches YYYY-MM-DD format", () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("equals the current date", () => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const expected = `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
    expect(todayKey()).toBe(expected);
  });
});

// ── nowISO ──────────────────────────────────────────────────────

describe("nowISO", () => {
  it("returns an ISO-8601 UTC string", () => {
    expect(nowISO()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });
});

// ── generateSessionId ───────────────────────────────────────────

describe("generateSessionId", () => {
  it("returns a non-empty alphanumeric string", () => {
    const id = generateSessionId();
    expect(id.length).toBeGreaterThan(0);
    expect(id).toMatch(/^[a-z0-9]+$/);
  });

  it("produces different values across calls", () => {
    const ids = new Set(Array.from({ length: 20 }, () => generateSessionId()));
    expect(ids.size).toBeGreaterThan(1);
  });
});
