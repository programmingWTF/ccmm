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
  const binName = isWin ? "claude.exe" : "claude";
  const fixHint = "npm install -g @anthropic-ai/claude-code --force";

  // Collect candidate npm global prefixes for this platform
  const prefixes: string[] = [];

  if (isWin) {
    prefixes.push(join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "npm"));
  } else {
    // macOS (brew, system), Linux (apt/yum/dnf), user-local prefix
    prefixes.push(
      "/usr/local/lib",                                  // macOS brew + some Linux
      "/usr/lib",                                        // Linux system install
      join(homedir(), "npm/lib"),                        // Linux user prefix (npm config set prefix ~/npm)
      join(homedir(), ".npm-global/lib"),                // alternative user prefix
    );
    // NVM if present
    const nvmDir = process.env.NVM_DIR || join(homedir(), ".nvm");
    const nvmVer = process.env.NVM_BIN ? process.env.NVM_BIN.split("/").filter(Boolean).slice(-2, -1)[0] : "";
    if (nvmVer) {
      prefixes.push(join(nvmDir, "versions", "node", nvmVer, "lib"));
    }
  }

  for (const prefix of prefixes) {
    const binPath = join(prefix, "node_modules", "@anthropic-ai", "claude-code", "bin", binName);
    if (existsSync(binPath)) return { ok: true, path: binPath, fixHint };
  }

  // Not found — return first candidate as the expected path for diagnostics
  const expectedPath = join(prefixes[0]!, "node_modules", "@anthropic-ai", "claude-code", "bin", binName);
  return { ok: false, path: expectedPath, fixHint };
}
