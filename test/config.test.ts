import { describe, it, expect } from 'vitest';
import { ConfigSchema, DEFAULT_CONFIG } from '../src/schemas/config.js';
import { getPrices, setPrices } from '../src/store/config.js';
import type { Config } from '../src/schemas/config.js';

describe('ConfigSchema', () => {
  it('accepts a minimal valid config', () => {
    const result = ConfigSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('fills defaults for missing fields', () => {
    const result = ConfigSchema.parse({});
    expect(result.proxy.host).toBe('127.0.0.1');
    expect(result.proxy.port).toBe(8787);
    expect(result.providers).toEqual({});
    expect(result.pricesUSD).toEqual({});
    expect(result.pricesCNY).toEqual({});
  });

  it('accepts a fully populated config', () => {
    const data = {
      proxy: { host: '0.0.0.0', port: 9999 },
      defaultProvider: 'anthropic',
      providers: { anthropic: { baseUrl: 'https://api.anthropic.com', wire: 'anthropic' } },
      pricesUSD: { haiku: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 } },
      pricesCNY: { haiku: { input: 7, output: 35, cacheRead: 0.7, cacheWrite: 8.75 } },
    };
    const result = ConfigSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultProvider).toBe('anthropic');
      expect(result.data.pricesUSD.haiku.input).toBe(1);
      expect(result.data.pricesCNY.haiku.input).toBe(7);
    }
  });

  it('rejects invalid port', () => {
    const result = ConfigSchema.safeParse({ proxy: { port: 99999 } });
    expect(result.success).toBe(false);
  });

  it('rejects invalid wire protocol', () => {
    const result = ConfigSchema.safeParse({
      providers: { test: { baseUrl: 'https://example.com', wire: 'openai' } },
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing baseUrl in provider', () => {
    const result = ConfigSchema.safeParse({
      providers: { test: { wire: 'anthropic' } },
    });
    expect(result.success).toBe(false);
  });

  it('allows empty price records', () => {
    const result = ConfigSchema.safeParse({ pricesUSD: {}, pricesCNY: {} });
    expect(result.success).toBe(true);
  });
});

// ── getPrices / setPrices ──────────────────────────────────────

describe('getPrices / setPrices', () => {
  function makeConfig(currency: 'USD' | 'CNY'): Config {
    return ConfigSchema.parse({ currency, pricesUSD: { 'model-a': { input: 3, output: 15 } }, pricesCNY: { 'model-b': { input: 20, output: 100 } } });
  }

  it('getPrices returns pricesUSD when currency is USD', () => {
    const c = makeConfig('USD');
    const prices = getPrices(c);
    expect(prices['model-a']).toBeDefined();
    expect(prices['model-b']).toBeUndefined();
  });

  it('getPrices returns pricesCNY when currency is CNY', () => {
    const c = makeConfig('CNY');
    const prices = getPrices(c);
    expect(prices['model-b']).toBeDefined();
    expect(prices['model-a']).toBeUndefined();
  });

  it('setPrices writes to pricesUSD when currency is USD', () => {
    const c = makeConfig('USD');
    setPrices(c, { 'new-model': { input: 1, output: 2, cacheRead: 0, cacheWrite: 0 } });
    expect(c.pricesUSD['new-model']).toBeDefined();
    expect(c.pricesCNY['new-model']).toBeUndefined();
  });

  it('setPrices writes to pricesCNY when currency is CNY', () => {
    const c = makeConfig('CNY');
    setPrices(c, { 'new-model': { input: 7, output: 14, cacheRead: 0, cacheWrite: 0 } });
    expect(c.pricesCNY['new-model']).toBeDefined();
    expect(c.pricesUSD['new-model']).toBeUndefined();
  });

  it('prices are independent between currencies', () => {
    const c = makeConfig('USD');
    setPrices(c, { x: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 } });
    c.currency = 'CNY';
    const cnyPrices = getPrices(c);
    expect(cnyPrices['x']).toBeUndefined();
    expect(cnyPrices['model-b']).toBeDefined();
  });
});

// ── Backward compat: old "prices" field migration ──────────────

describe('config backward compat', () => {
  it('ConfigSchema ignores unknown "prices" field gracefully', () => {
    // Old configs may still have "prices" — zod strips unknown keys by default
    const result = ConfigSchema.safeParse({ prices: { m: { input: 1, output: 2 } } });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.pricesUSD).toEqual({});
    }
  });
});
