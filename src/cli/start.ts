import type { Command } from "commander";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, openSync, mkdirSync } from "node:fs";
import { pidPath, ccmmDir } from "../util/paths.js";
import { isProxyRunning, stopProxy } from "../proxy/server.js";
import { loadConfig } from "../store/config.js";
import { checkForUpdate } from "../util/update-check.js";
import { t } from "../i18n/index.js";
import pc from "picocolors";

const LOG_PATH = ccmmDir() + "/proxy.log";

export function registerStart(program: Command): void {
  program.command("start")
    .description("启动代理守护进程 / Start the proxy daemon")
    .action(async () => {
      // Auto-check for updates (non-blocking notification)
      notifyUpdate();

      if (isProxyRunning()) {
        const pid = readFileSync(pidPath(), "utf-8").trim();
        console.log(pc.yellow("代理已在运行 (PID: " + pid + ") / Proxy is already running (PID: " + pid + ")"));
        return;
      }

      // Ensure ccmm directory exists before opening log file
      mkdirSync(ccmmDir(), { recursive: true });

      const execPath = process.execPath;
      const scriptPath = process.argv[1] ?? "";
      const logFd = openSync(LOG_PATH, "a");
      const child = spawn(execPath, [scriptPath, "_daemon"], {
        detached: true,
        stdio: ["ignore", "ignore", logFd],
      });
      child.unref();
      await new Promise(r => setTimeout(r, 1500));
      if (isProxyRunning()) {
        const pid = readFileSync(pidPath(), "utf-8").trim();
        console.log(pc.green("Proxy started (PID: " + pid + ")"));
        console.log(pc.dim("  Logs: " + LOG_PATH));
      } else {
        console.log(pc.red("Failed to start proxy. Last log lines:"));
        try {
          const tail = readFileSync(LOG_PATH, "utf-8").split("\n").slice(-10).join("\n");
          console.log(pc.dim(tail || "(no output — daemon likely crashed on startup)"));
        } catch {
          console.log(pc.dim("(unable to read log at " + LOG_PATH + ")"));
        }
        // Helpful hint for common causes
        console.log(pc.yellow("\n  Common causes:"));
        console.log(pc.dim("  • Port " + loadConfig().proxy.port + " may already be in use"));
        console.log(pc.dim("  • Check proxy log: cat " + LOG_PATH));
        console.log(pc.dim("  • Run 'ccmm doctor' to diagnose"));
      }
    });

  program.command("stop")
    .description("停止代理守护进程 / Stop the proxy daemon")
    .action(async () => {
      if (!isProxyRunning()) {
        console.log(pc.yellow("Proxy is not running."));
        return;
      }
      await stopProxy();
      console.log(pc.green("Proxy stopped"));
    });

  program.command("logs")
    .description("查看代理日志 / View proxy logs")
    .action(() => {
      if (!existsSync(LOG_PATH)) {
        console.log(pc.yellow("No log file yet. Start the proxy first: ccmm start"));
        return;
      }
      const content = readFileSync(LOG_PATH, "utf-8");
      console.log(content || "(empty)");
    });
}

// ── Update notification helper ─────────────────────────

const VERSION = "0.2.0";

function notifyUpdate(): void {
  try {
    const c = loadConfig();
    const L = c.language ?? "zh-CN";
    const info = checkForUpdate(VERSION);
    if (info?.hasUpdate) {
      console.log(pc.yellow("  ⚡ " + t("update.notify", L) + info.latestVersion + t("update.notifyHint", L)));
      console.log("");
    }
  } catch { /* silent — never block the user */ }
}
