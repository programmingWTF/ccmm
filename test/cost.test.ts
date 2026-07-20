import { describe, it, expect } from 'vitest';
import { computeCost, computeCacheHitRate, getPrice } from '../src/engine/cost.js';
import type { UsageRecord } from '../src/schemas/metrics.js';
import type { Price } from '../src/schemas/config.js';

describe('computeCost', () => {
  const price: Price = { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 };

  it('returns 0 for zero tokens', () => {
    const usage: UsageRecord = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(computeCost(usage, price)).toBe(0);
  });

  it('computes input cost correctly', () => {
    const usage: UsageRecord = { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(computeCost(usage, price)).toBe(15);
  });

  it('computes output cost correctly', () => {
    const usage: UsageRecord = { inputTokens: 0, outputTokens: 1_000_000, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(computeCost(usage, price)).toBe(75);
  });

  it('computes cache read/write cost', () => {
    const usage: UsageRecord = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 1_000_000, cacheWriteTokens: 1_000_000 };
    expect(computeCost(usage, price)).toBe(1.5 + 18.75);
  });

  it('sums all token types proportionally', () => {
    const usage: UsageRecord = { inputTokens: 1000, outputTokens: 1000, cacheReadTokens: 1000, cacheWriteTokens: 1000 };
    const expected = (1000*15 + 1000*75 + 1000*1.5 + 1000*18.75) / 1_000_000;
    expect(computeCost(usage, price)).toBeCloseTo(expected, 10);
  });

  it('defaults cache prices to 0 when not set', () => {
    const priceNoCache: Price = { input: 10, output: 50, cacheRead: 0, cacheWrite: 0 };
    const usage: UsageRecord = { inputTokens: 10000, outputTokens: 5000, cacheReadTokens: 50000, cacheWriteTokens: 10000 };
    expect(computeCost(usage, priceNoCache)).toBe((10000*10 + 5000*50) / 1_000_000);
  });
});

describe('computeCacheHitRate', () => {
  it('returns 0 when total is 0', () => {
    const usage: UsageRecord = { inputTokens: 0, outputTokens: 100, cacheReadTokens: 0, cacheWriteTokens: 0 };
    expect(computeCacheHitRate(usage)).toBe(0);
  });

  it('returns 1 when all input is cache read', () => {
    const usage: UsageRecord = { inputTokens: 0, outputTokens: 100, cacheReadTokens: 50000, cacheWriteTokens: 0 };
    expect(computeCacheHitRate(usage)).toBe(1);
  });

  it('computes partial hit rate', () => {
    const usage: UsageRecord = { inputTokens: 1000, outputTokens: 500, cacheReadTokens: 9000, cacheWriteTokens: 0 };
    expect(computeCacheHitRate(usage)).toBeCloseTo(0.9, 5);
  });
});

describe('getPrice', () => {
  const prices: Record<string, Price> = {
    opus: { input: 15, output: 75, cacheRead: 1.5, cacheWrite: 18.75 },
  };

  it('returns price for known model', () => {
    expect(getPrice('opus', prices)).toEqual(prices['opus']);
  });

  it('returns zero price for unknown model', () => {
    const zero = getPrice('unknown', prices);
    expect(zero.input).toBe(0);
    expect(zero.output).toBe(0);
  });
});
