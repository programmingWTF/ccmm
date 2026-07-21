import { mkdirSync, readFileSync, writeFileSync, watch } from "node:fs";
import { ConfigSchema, DEFAULT_CONFIG, type Config, type Price, type Currency } from "../schemas/config.js";

export type { Config };
import { configPath, ccmmDir } from "../util/paths.js";

/** Strip [Nk]/[Nm] thinking-budget suffixes from model IDs — some APIs reject them */
const CLEAN_SUFFIX_RE = /\[\d+[km]\]$/i;

function normalizeConfig(c: Config): Config {
  // Clean modelMap values
  for (const pv of Object.values(c.providers)) {
    if (!pv.modelMap) continue;
    for (const [key, val] of Object.entries(pv.modelMap)) {
      pv.modelMap[key] = val.replace(CLEAN_SUFFIX_RE, "");
    }
  }
  return c;
}

export function loadConfig(): Config {
  try {
    const raw = readFileSync(configPath(), "utf-8");
    const parsed = JSON.parse(raw);
    // Backward compat: migrate old "prices" field to pricesUSD
    if (parsed.prices && !parsed.pricesUSD) {
      parsed.pricesUSD = parsed.prices;
      delete parsed.prices;
    }
    const result = ConfigSchema.safeParse(parsed);
    if (!result.success) {
      throw new Error(
        "Invalid config at " + configPath() + ":\n" +
        result.error.issues.map(function(i) { return "  - " + i.path.join(".") + ": " + i.message; }).join("\n")
      );
    }
    return normalizeConfig(result.data);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as any).code === "ENOENT") {
      return normalizeConfig({ ...DEFAULT_CONFIG });
    }
    throw err;
  }
}

export function saveConfig(config: Config): void {
  mkdirSync(ccmmDir(), { recursive: true });
  const validated = ConfigSchema.parse(normalizeConfig(config));
  writeFileSync(configPath(), JSON.stringify(validated, null, 2) + "\n", "utf-8");
}

export function ensureConfigExists(): Config {
  mkdirSync(ccmmDir(), { recursive: true });
  let config: Config;
  try {
    config = loadConfig();
  } catch {
    config = { ...DEFAULT_CONFIG };
  }
  saveConfig(config);
  return config;
}

/** Get the prices record for the config's active currency. */
export function getPrices(config: Config): Record<string, Price> {
  return config.currency === "CNY" ? config.pricesCNY : config.pricesUSD;
}

/** Set the prices record for the config's active currency (mutates config). */
export function setPrices(config: Config, prices: Record<string, Price>): void {
  if (config.currency === "CNY") {
    config.pricesCNY = prices;
  } else {
    config.pricesUSD = prices;
  }
}

export type ConfigWatcher = { close(): void };

export function watchConfig(onChange: (config: Config) => void): ConfigWatcher {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const watcher = watch(configPath(), function() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      try {
        const config = loadConfig();
        onChange(config);
      } catch {
        // keep old config on parse error
      }
    }, 100);
  });
  return { close: function() { if (timer) clearTimeout(timer); watcher.close(); } };
}
