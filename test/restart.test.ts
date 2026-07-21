import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock server module before importing start
vi.mock('../src/proxy/server.js', () => ({
  isProxyRunning: vi.fn(),
  stopProxy: vi.fn(),
}));

vi.mock('../src/util/paths.js', () => ({
  pidPath: () => '/tmp/.ccmm/proxy.pid',
  ccmmDir: () => '/tmp/.ccmm',
  configPath: () => '/tmp/.ccmm/config.json',
  claudeSettingsPaths: () => [],
  checkClaudeBinary: () => ({ ok: true }),
}));

vi.mock('../src/store/config.js', () => ({
  loadConfig: () => ({ proxy: { host: '127.0.0.1', port: 8787 }, language: 'zh-CN', providers: {}, pricesUSD: {}, pricesCNY: {} }),
  saveConfig: vi.fn(),
  getPrices: (c: any) => c.pricesUSD,
  setPrices: vi.fn(),
}));

vi.mock('../src/util/update-check.js', () => ({
  checkForUpdate: () => null,
}));

vi.mock('node:fs', () => ({
  readFileSync: vi.fn(() => '12345'),
  existsSync: vi.fn(() => true),
  openSync: vi.fn(() => 3),
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  appendFileSync: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: vi.fn(() => ({ unref: vi.fn() })),
  execSync: vi.fn(),
}));

import { isProxyRunning, stopProxy } from '../src/proxy/server.js';
import { restartProxyDaemon } from '../src/cli/start.js';

describe('restartProxyDaemon', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns false when proxy is not running', async () => {
    vi.mocked(isProxyRunning).mockReturnValue(false);
    const result = await restartProxyDaemon();
    expect(result).toBe(false);
    expect(stopProxy).not.toHaveBeenCalled();
  });

  it('stops and restarts proxy when running', async () => {
    // First call: running (check before stop), then after restart: running
    vi.mocked(isProxyRunning)
      .mockReturnValueOnce(true)   // initial check
      .mockReturnValueOnce(true);  // after restart check
    vi.mocked(stopProxy).mockResolvedValue(undefined);

    const result = await restartProxyDaemon();
    expect(stopProxy).toHaveBeenCalledOnce();
    expect(result).toBe(true);
  });

  it('returns false if proxy fails to restart', async () => {
    vi.mocked(isProxyRunning)
      .mockReturnValueOnce(true)   // initial check
      .mockReturnValueOnce(false); // after restart check — failed
    vi.mocked(stopProxy).mockResolvedValue(undefined);

    const result = await restartProxyDaemon();
    expect(result).toBe(false);
  });

  it('handles stopProxy throwing gracefully', async () => {
    vi.mocked(isProxyRunning)
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(true);
    vi.mocked(stopProxy).mockRejectedValue(new Error('already dead'));

    const result = await restartProxyDaemon();
    expect(result).toBe(true);
  });
});
