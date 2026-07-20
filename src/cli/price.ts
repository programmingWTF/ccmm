import type { Command } from 'commander';
import { loadConfig, saveConfig } from "../store/config.js";
import pc from "picocolors";
export function registerPrice(program: Command) {
  const cmd = program.command("price").description("管理模型定价 / Manage model pricing");
  cmd.command("set").argument("<model>").requiredOption("--input <usd>","Input price/1M").requiredOption("--output <usd>","Output price/1M").option("--cache-read <usd>").option("--cache-write <usd>").description("Set price for a model").action((model, opts) => {
    const config = loadConfig();
    config.prices[model] = { input: parseFloat(opts.input), output: parseFloat(opts.output), cacheRead: opts.cacheRead ? parseFloat(opts.cacheRead) : 0, cacheWrite: opts.cacheWrite ? parseFloat(opts.cacheWrite) : 0 };
    saveConfig(config);
    console.log(pc.green("✓"), "Price set for:", pc.bold(model));
  });
  cmd.command("rm").argument("<model>").description("Remove price").action((model) => {
    const config = loadConfig(); delete config.prices[model]; saveConfig(config);
    console.log(pc.green("✓"), "Price removed for:", model);
  });
  cmd.command("list").description("List prices").action(() => {
    const config = loadConfig();
    for (const [model, price] of Object.entries(config.prices)) {
      console.log(model + ": in=$" + price.input + " out=$" + price.output + " per 1M");
    }
  });
}