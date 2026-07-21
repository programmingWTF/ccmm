import { existsSync } from "node:fs";
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

/** Check whether the Claude Code binary is present in the npm global install.
 *  On Windows this is the most common cause of "claude.exe not recognized"
 *  after Windows Defender quarantines the binary. */
export function checkClaudeBinary(): { ok: boolean; path: string; fixHint: string } {
  const isWin = process.platform === "win32";
  const prefix = isWin
    ? join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "npm")
    : "/usr/local/lib";

  const binName = isWin ? "claude.exe" : "claude";
  const binPath = join(prefix, "node_modules", "@anthropic-ai", "claude-code", "bin", binName);
  const fixHint = "npm install -g @anthropic-ai/claude-code --force";

  return { ok: existsSync(binPath), path: binPath, fixHint };
}
