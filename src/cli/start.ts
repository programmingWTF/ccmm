import type { Command } from "commander";
import { spawn } from "node:child_process";
import { readFileSync, existsSync, openSync } from "node:fs";
import { pidPath, ccmmDir } from "../util/paths.js";
import { isProxyRunning, stopProxy } from "../proxy/server.js";
import pc from "picocolors";

const LOG_PATH = ccmmDir() + "/proxy.log";

export function registerStart(program: Command): void {
  program.command("start")
    .description("启动代理守护进程 / Start the proxy daemon")
    .action(async () => {
      if (isProxyRunning()) {
        const pid = readFileSync(pidPath(), "utf-8").trim();
        console.log(pc.yellow("代理已在运行 (PID: " + pid + ") / Proxy is already running (PID: " + pid + ")"));
        return;
      }
      const execPath = process.execPath;
      const scriptPath = process.argv[1] ?? "";
      const logFd = openSync(LOG_PATH, "a");
      const child = spawn(execPath, [scriptPath, "_daemon"], {
        detached: true,
        stdio: ["ignore", "ignore", logFd],
      });
      child.unref();
      await new Promise(r => setTimeout(r, 1000));
      if (isProxyRunning()) {
        const pid = readFileSync(pidPath(), "utf-8").trim();
        console.log(pc.green("Proxy started (PID: " + pid + ")"));
        console.log(pc.dim("  Logs: " + LOG_PATH));
      } else {
        console.log(pc.red("Failed to start proxy. Last log lines:"));
        try {
          const tail = readFileSync(LOG_PATH, "utf-8").split("\n").slice(-5).join("\n");
          console.log(pc.dim(tail));
        } catch { /* no log */ }
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
