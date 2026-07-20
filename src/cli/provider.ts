import type { Command } from "commander";
import { loadConfig, saveConfig } from "../store/config.js";
import { t } from "../i18n/index.js";
import pc from "picocolors";

export function registerProvider(program: Command) {
  const cmd = program.command("provider").description("管理方案 / Manage providers");

  cmd.command("add").argument("<name>").argument("<baseUrl>").option("--key-env <env>", "API key env var")
    .description("添加方案 / Add a provider")
    .action((name, baseUrl, opts) => {
      const config = loadConfig();
      config.providers[name] = { baseUrl, apiKeyEnv: opts.keyEnv, wire: "anthropic" };
      saveConfig(config);
      console.log(pc.green("✓"), "方案已添加:", pc.bold(name));
    });

  cmd.command("rm").argument("<name>")
    .description("移除方案 / Remove a provider")
    .action((name) => {
      const config = loadConfig();
      delete config.providers[name];
      if (config.defaultProvider === name) config.defaultProvider = undefined;
      saveConfig(config);
      console.log(pc.green("✓"), "方案已移除:", name);
    });

  cmd.command("list")
    .description("列出方案 / List providers")
    .action(() => {
      const config = loadConfig();
      for (const [name, p] of Object.entries(config.providers)) {
        console.log(name + " → " + p.baseUrl + (p.apiKeyEnv ? " (key: " + p.apiKeyEnv + ")" : ""));
      }
    });
}
