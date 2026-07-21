import { homedir, platform } from "node:os";
import { join, dirname } from "node:path";
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// ── Per-platform paths ───────────────────────────────────

function startScriptPath(): string {
  const p = platform();
  if (p === "win32") {
    return join(homedir(), "AppData", "Roaming", "Microsoft", "Windows", "Start Menu", "Programs", "Startup", "ccmm-proxy.bat");
  }
  if (p === "darwin") {
    return join(homedir(), "Library", "LaunchAgents", "com.ccmm.proxy.plist");
  }
  // Linux
  return join(homedir(), ".config", "autostart", "ccmm-proxy.desktop");
}

// ── Platform helpers ─────────────────────────────────────

function isWindows(): boolean { return platform() === "win32"; }
function isMacOS(): boolean { return platform() === "darwin"; }

/**
 * Resolve the absolute path to the ccmm entry script.
 * Uses process.argv[1] (set by the bin shim to the real dist/index.js),
 * with a fallback derived from this source file's location on disk.
 */
function resolveCcmmEntry(): string {
  // process.argv[1] is the most reliable — the bin shim resolves
  // it to the actual dist/index.js path before Node starts.
  const fromArgv = process.argv[1];
  if (fromArgv && existsSync(fromArgv)) return fromArgv;

  // Fallback: derive from this source file (src/util/autostart.ts →
  // dist/util/autostart.js).  Works even when argv[1] is empty (e.g. REPL).
  try {
    const thisFile = fileURLToPath(import.meta.url);
    const rootDir = dirname(dirname(dirname(thisFile))); // autostart.ts → util → src → ccmm root
    const candidate = join(rootDir, "dist", "index.js");
    if (existsSync(candidate)) return candidate;
  } catch { /* ESM-only; ignore in CJS contexts */ }

  // Desperate fallback — may not exist, but we tried
  return join(process.cwd(), "dist", "index.js");
}

// ── Public API ───────────────────────────────────────────

export function isAutoStartEnabled(): boolean {
  try { return existsSync(startScriptPath()); }
  catch { return false; }
}

export function enableAutoStart(): void {
  if (isWindows()) enableAutoStartWindows();
  else if (isMacOS()) enableAutoStartMacOS();
  else enableAutoStartLinux();
}

export function disableAutoStart(): void {
  const sp = startScriptPath();
  try {
    if (existsSync(sp)) {
      // macOS: unload the launchd job before removing the plist,
      // otherwise launchd keeps the stale job reference.
      if (isMacOS()) {
        try { execSync("launchctl unload " + JSON.stringify(sp), { stdio: "ignore", timeout: 3000 }); }
        catch { /* already unloaded or never loaded */ }
      }
      unlinkSync(sp);
    }
  }
  catch { /* already gone */ }
}

// ── Windows: Startup folder .bat ─────────────────────────

function enableAutoStartWindows(): void {
  const scriptPath = resolveCcmmEntry();
  // start /B = no new console window; use absolute node + script path
  // so it works regardless of cwd at boot time
  const bat = `@echo off\r\nstart /B "" "${process.execPath}" "${scriptPath}" _daemon\r\n`;
  const dir = dirname(startScriptPath());
  mkdirSync(dir, { recursive: true });
  writeFileSync(startScriptPath(), bat, "utf-8");
}

// ── macOS: launchd plist ─────────────────────────────────

function enableAutoStartMacOS(): void {
  const scriptPath = resolveCcmmEntry();
  const label = "com.ccmm.proxy";
  const logPath = join(homedir(), ".ccmm", "proxy.log");
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${process.execPath}</string>
        <string>${scriptPath}</string>
        <string>_daemon</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${dirname(scriptPath)}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${logPath}</string>
    <key>StandardErrorPath</key>
    <string>${logPath}</string>
</dict>
</plist>`;
  const dir = join(homedir(), "Library", "LaunchAgents");
  mkdirSync(dir, { recursive: true });
  writeFileSync(startScriptPath(), plist, "utf-8");

  // Register with launchd so it takes effect on next login
  try {
    execSync("launchctl load " + JSON.stringify(startScriptPath()), { stdio: "ignore", timeout: 3000 });
  } catch {
    // launchctl may fail if not in a GUI session (e.g. over SSH) —
    // the plist is still on disk and will be picked up on next login.
  }
}

// ── Linux: XDG autostart .desktop ────────────────────────

function enableAutoStartLinux(): void {
  const scriptPath = resolveCcmmEntry();
  const desktop = `[Desktop Entry]
Type=Application
Name=ccmm Proxy
Comment=Claude Code Model Manager Proxy
Exec=${process.execPath} ${scriptPath} _daemon
StartupNotify=false
Terminal=false
X-GNOME-Autostart-enabled=true`;
  const dir = join(homedir(), ".config", "autostart");
  mkdirSync(dir, { recursive: true });
  writeFileSync(startScriptPath(), desktop, "utf-8");
}
