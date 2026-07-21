import type { Command } from 'commander';
import { loadConfig, saveConfig, getPrices, setPrices } from "../store/config.js";
import { currencySymbol } from "../util/format.js";
import pc from "picocolors";
export function registerPrice(program: Command) {
  const cmd = program.command("price").description("管理模型定价 / Manage model pricing");
  cmd.command("set").argument("<model>").requiredOption("--input <price>","Input price/1M").requiredOption("--output <price>","Output price/1M").option("--cache-read <price>").option("--cache-write <price>").description("Set price for a model").action((model, opts) => {
    const config = loadConfig();
    const prices = getPrices(config);
    prices[model] = { input: parseFloat(opts.input), output: parseFloat(opts.output), cacheRead: opts.cacheRead ? parseFloat(opts.cacheRead) : 0, cacheWrite: opts.cacheWrite ? parseFloat(opts.cacheWrite) : 0 };
    setPrices(config, prices);
    saveConfig(config);
    console.log(pc.green("✓"), "Price set for:", pc.bold(model));
  });
  cmd.command("rm").argument("<model>").description("Remove price").action((model) => {
    const config = loadConfig(); const prices = getPrices(config); delete prices[model]; setPrices(config, prices); saveConfig(config);
    console.log(pc.green("✓"), "Price removed for:", model);
  });
  cmd.command("list").description("List prices").action(() => {
    const config = loadConfig();
    const sym = currencySymbol(config.currency ?? "USD");
    const prices = getPrices(config);
    for (const [model, price] of Object.entries(prices)) {
      console.log(model + ": in=" + sym + price.input + " out=" + sym + price.output + " per 1M");
    }
  });
}