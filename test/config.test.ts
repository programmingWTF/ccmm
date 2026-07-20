import { describe, it, expect } from 'vitest';
import { ConfigSchema, DEFAULT_CONFIG } from '../src/schemas/config.js';

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
  });

  it('accepts a fully populated config', () => {
    const data = {
      proxy: { host: '0.0.0.0', port: 9999 },
      defaultProvider: 'anthropic',
      providers: { anthropic: { baseUrl: 'https://api.anthropic.com', wire: 'anthropic' } },
      prices: { haiku: { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 } },
    };
    const result = ConfigSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.defaultProvider).toBe('anthropic');
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

  it('allows empty price record', () => {
    const result = ConfigSchema.safeParse({ prices: {} });
    expect(result.success).toBe(true);
  });
});
