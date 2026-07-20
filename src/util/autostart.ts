import { homedir, platform } from "node:os";
import { join } from "node:path";
import { existsSync, writeFileSync, unlinkSync, mkdirSync } from "node:fs";

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
  try { if (existsSync(startScriptPath())) unlinkSync(startScriptPath()); }
  catch { /* already gone */ }
}

// ── Windows: Startup folder .bat ─────────────────────────

function enableAutoStartWindows(): void {
  const bat = `@echo off\r\ncd /d "${process.cwd()}"\r\nstart /B "" "${process.execPath}" "${join(process.cwd(), "dist", "index.js")}" _daemon\r\n`;
  writeFileSync(startScriptPath(), bat, "utf-8");
}

// ── macOS: launchd plist ─────────────────────────────────

function enableAutoStartMacOS(): void {
  const label = "com.ccmm.proxy";
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${process.execPath}</string>
        <string>${join(process.cwd(), "dist", "index.js")}</string>
        <string>_daemon</string>
    </array>
    <key>WorkingDirectory</key>
    <string>${process.cwd()}</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <false/>
    <key>StandardOutPath</key>
    <string>${join(homedir(), ".ccmm", "proxy.log")}</string>
    <key>StandardErrorPath</key>
    <string>${join(homedir(), ".ccmm", "proxy.log")}</string>
</dict>
</plist>`;
  const dir = join(homedir(), "Library", "LaunchAgents");
  mkdirSync(dir, { recursive: true });
  writeFileSync(startScriptPath(), plist, "utf-8");
}

// ── Linux: XDG autostart .desktop ────────────────────────

function enableAutoStartLinux(): void {
  const desktop = `[Desktop Entry]
Type=Application
Name=ccmm Proxy
Comment=Claude Code Model Manager Proxy
Exec=${process.execPath} ${join(process.cwd(), "dist", "index.js")} _daemon
Path=${process.cwd()}
StartupNotify=false
Terminal=false
X-GNOME-Autostart-enabled=true`;
  const dir = join(homedir(), ".config", "autostart");
  mkdirSync(dir, { recursive: true });
  writeFileSync(startScriptPath(), desktop, "utf-8");
}
