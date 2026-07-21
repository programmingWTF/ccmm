import { Command } from "commander";
import { registerInit } from "./cli/init.js";
import { registerUse } from "./cli/use.js";
import { registerStart } from "./cli/start.js";
import { registerStatusline } from "./cli/statusline.js";
import { registerStats } from "./cli/stats.js";
import { registerDoctor } from "./cli/doctor.js";
import { registerProvider } from "./cli/provider.js";
import { registerPrice } from "./cli/price.js";
import { registerModels } from "./cli/models.js";
import { registerCurrent } from "./cli/current.js";
import { registerSetup } from "./cli/setup.js";
import { registerConfig } from "./cli/config.js";
import { startProxy } from "./proxy/server.js";

const VERSION = "0.1.5";

async function main(): Promise<void> {
  if (process.argv[2] === "_daemon") {
    const { appendFileSync, mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const { homedir } = await import("node:os");
    const ccmmDir = join(homedir(), ".ccmm");
    try {
      mkdirSync(ccmmDir, { recursive: true });
      await startProxy();
    } catch (err: unknown) {
      const msg = err instanceof Error ? (err.stack || err.message) : String(err);
      try {
        mkdirSync(ccmmDir, { recursive: true });
        appendFileSync(join(ccmmDir, "proxy.log"), "[FATAL] daemon crashed before logging: " + msg + "\n");
      } catch { /* can't even write log — nothing we can do */ }
      process.exit(1);
    }
    return;
  }

  // -v shorthand for version (commander only registers -V/--version)
  if (process.argv.includes("-v") && !process.argv.includes("--version")) {
    console.log(VERSION);
    process.exit(0);
  }

  const program = new Command();
  program.name("ccmm").description("Claude Code 模型方案管理器 / Claude Code Model Manager").version(VERSION);
  registerInit(program);
  registerUse(program);
  registerStart(program);
  registerStatusline(program);
  registerStats(program);
  registerDoctor(program);
  registerProvider(program);
  registerPrice(program);
  registerModels(program);
  registerCurrent(program);
  registerSetup(program);
  registerConfig(program);
  program.parse();
}

main().catch((err: Error) => {
  console.error("ccmm error:", err.message);
  process.exit(1);
});
