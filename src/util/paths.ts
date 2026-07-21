import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { execSync } from "node:child_process";

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

/** Check whether the Claude Code binary is present.
 *  Resolves via PATH/shim first (most reliable), then falls back to
 *  guessing npm global prefixes.  On Windows this also catches the
 *  common case where Windows Defender quarantined claude.exe. */
export function checkClaudeBinary(): { ok: boolean; path: string; fixHint: string } {
  const isWin = process.platform === "win32";
  const binName = isWin ? "claude.exe" : "claude";
  const fixHint = "npm install -g @anthropic-ai/claude-code --force";

  // ── 1. Resolve from PATH / npm shim ──────────────────
  const pathBin = resolveFromPath(binName);
  if (pathBin) return { ok: true, path: pathBin, fixHint };

  // ── 2. Guess npm global prefixes ─────────────────────
  const prefixes: string[] = [];

  if (isWin) {
    prefixes.push(join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "npm"));
  } else {
    // Try to get the real npm global prefix
    try {
      const npmPrefix = execSync("npm config get prefix", { encoding: "utf-8", timeout: 2000 }).trim();
      if (npmPrefix && !npmPrefix.startsWith("undefined")) {
        prefixes.push(join(npmPrefix, "lib"));
      }
    } catch { /* npm not available */ }

    // Fallback candidates
    prefixes.push(
      "/usr/local/lib",                                  // macOS brew + many Linux
      "/usr/lib",                                        // Linux system install
      join(homedir(), ".npm-global", "lib"),             // alt user prefix
      join(homedir(), "npm", "lib"),                     // user prefix
    );
    // NVM
    try {
      const nvmPrefix = execSync("npm config get prefix", { encoding: "utf-8", timeout: 2000 }).trim();
      if (nvmPrefix && nvmPrefix.includes(".nvm")) {
        prefixes.unshift(join(nvmPrefix, "lib")); // prioritise NVM
      }
    } catch { /* ignore */ }
  }

  for (const prefix of prefixes) {
    const binPath = join(prefix, "node_modules", "@anthropic-ai", "claude-code", "bin", binName);
    if (existsSync(binPath)) return { ok: true, path: binPath, fixHint };
  }

  // Not found — build a useful expected path for diagnostics
  const expectedPath = join(prefixes[0] ?? "/usr/lib", "node_modules", "@anthropic-ai", "claude-code", "bin", binName);
  return { ok: false, path: expectedPath, fixHint };
}

/** Resolve a command name to its real binary path via PATH / shims,
 *  returning null if not found. */
function resolveFromPath(binName: string): string | null {
  const isWin = process.platform === "win32";

  try {
    // which/where — cross-platform
    const whichCmd = isWin ? "where" : "which";
    const stdout = execSync(whichCmd + " " + binName, { encoding: "utf-8", timeout: 2000 });
    const firstLine = stdout.split("\n")[0]?.trim();
    if (!firstLine) return null;

    // On Windows, claude.ps1 points to the real exe — parse it
    if (isWin && firstLine.endsWith(".ps1")) {
      try {
        const ps1Content = readFileSync(firstLine, "utf-8");
        const m = ps1Content.match(/["'](.+?claude\.exe)["']/);
        if (m?.[1] && existsSync(m[1])) return m[1];
      } catch { /* can't read shim, fall through */ }
    }

    // On Linux/macOS the symlink might point to the actual binary
    if (existsSync(firstLine)) return firstLine;

    // Resolve symlinks
    try {
      const real = execSync("realpath " + JSON.stringify(firstLine), { encoding: "utf-8", timeout: 2000 }).trim();
      if (real && existsSync(real)) return real;
    } catch { /* realpath not available or failed */ }
  } catch { /* which/where failed, fall back to prefix guessing */ }

  return null;
}
