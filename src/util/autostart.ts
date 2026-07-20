import { homedir } from "node:os";
import { join } from "node:path";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";

export function startupBatPath(): string {
  return join(
    homedir(),
    "AppData", "Roaming", "Microsoft", "Windows",
    "Start Menu", "Programs", "Startup",
    "ccmm-proxy.bat",
  );
}

export function isAutoStartEnabled(): boolean {
  try { return existsSync(startupBatPath()); }
  catch { return false; }
}

export function enableAutoStart(): void {
  const npxPath = process.execPath;
  const ccmmDist = join(process.cwd(), "dist", "index.js");
  const bat = `@echo off\r\ncd /d "${process.cwd()}"\r\nstart /B "" "${npxPath}" "${ccmmDist}" _daemon\r\n`;
  writeFileSync(startupBatPath(), bat, "utf-8");
}

export function disableAutoStart(): void {
  try { if (existsSync(startupBatPath())) unlinkSync(startupBatPath()); }
  catch { /* already gone */ }
}
