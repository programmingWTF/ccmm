import type { Price } from "../schemas/config.js";
import type { UsageRecord } from "../schemas/metrics.js";

/**
 * Compute cost in USD from token usage and per-1M-token prices.
 * Formula: (input*inputPrice + output*outputPrice + cacheRead*cacheReadPrice + cacheWrite*cacheWritePrice) / 1_000_000
 */
export function computeCost(usage: UsageRecord, price: Price): number {
  return (
    usage.inputTokens * price.input +
    usage.outputTokens * price.output +
    usage.cacheReadTokens * (price.cacheRead ?? 0) +
    usage.cacheWriteTokens * (price.cacheWrite ?? 0)
  ) / 1_000_000;
}

/**
 * Compute cache hit rate: ratio of cache-read tokens to total input-side tokens.
 * cacheHitRate = cacheRead / (cacheRead + cacheWrite + input)
 * Returns 0 if total is 0.
 */
export function computeCacheHitRate(usage: UsageRecord): number {
  const total = usage.cacheReadTokens + usage.cacheWriteTokens + usage.inputTokens;
  if (total === 0) return 0;
  return usage.cacheReadTokens / total;
}

/**
 * Look up the price for a model. Falls back to zero prices if model not configured.
 */
export function getPrice(model: string, prices: Record<string, Price>): Price {
  return prices[model] ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
}
