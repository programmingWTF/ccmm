import { homedir } from "node:os";
import { join } from "node:path";

const CCMM_DIR_NAME = ".ccmm";

export function ccmmDir(): string { return join(homedir(), CCMM_DIR_NAME); }
export function configPath(): string { return join(ccmmDir(), "config.json"); }
export function statePath(): string { return join(ccmmDir(), "state.json"); }
export function metricsPath(): string { return join(ccmmDir(), "metrics.jsonl"); }
export function pidPath(): string { return join(ccmmDir(), "proxy.pid"); }
export function summaryPath(): string { return join(ccmmDir(), "summary.json"); }

export function claudeSettingsPaths(): string[] {
  const home = homedir();
  return [
    join(home, ".claude", "settings.json"),
    join(home, "AppData", "Roaming", "Claude", "claude_code", "settings.json"),
  ];
}

export function isWindows(): boolean { return process.platform === "win32"; }
