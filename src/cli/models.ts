import type { Command } from "commander";
import { loadConfig, getPrices } from "../store/config.js";
import { currencySymbol } from "../util/format.js";
import { t } from "../i18n/index.js";
import pc from "picocolors";

export function registerModels(program: Command) {
  program
    .command("models")
    .description("列出已配置方案 / List configured providers")
    .action(() => {
      const config = loadConfig();
      const L = config.language ?? "zh-CN";
      console.log(pc.bold(t("models.title", L)));
      for (const [name, pv] of Object.entries(config.providers)) {
        const slots = pv.modelMap ? Object.keys(pv.modelMap).length : 0;
        const marker = name === config.defaultProvider ? " *" : "";
        console.log("  " + (name === config.defaultProvider ? pc.bold(name) : name) + pc.dim(marker + " → " + pv.baseUrl + (slots > 0 ? " (" + slots + ")" : "")));
      }
      if (config.defaultProvider) {
        console.log(pc.dim("  " + t("models.default", L)));
      }
      const prices = getPrices(config);
      if (Object.keys(prices).length > 0) {
        const sym = currencySymbol(config.currency ?? "USD");
        console.log(pc.bold("\n" + t("models.prices", L)));
        for (const [model, price] of Object.entries(prices)) {
          console.log("  " + model + ": " + sym + price.input + "/" + sym + price.output + " per 1M");
        }
      }
    });
}
