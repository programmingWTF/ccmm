import { mkdirSync, readFileSync, writeFileSync, watch } from "node:fs";
import { statePath, ccmmDir } from "../util/paths.js";
import { RouteStateSchema, createDefaultState, type RouteState } from "../schemas/state.js";
import { nowISO } from "../util/format.js";
import { loadConfig, type Config } from "./config.js";

export function loadState(): RouteState {
  try {
    const raw = readFileSync(statePath(), "utf-8");
    const parsed = JSON.parse(raw);
    return RouteStateSchema.parse(parsed);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as any).code === "ENOENT") {
      const config = loadConfig();
      const pvKeys = Object.keys(config.providers);
      const dp = config.defaultProvider ?? (pvKeys.length > 0 ? pvKeys[0] : undefined);
      if (dp && config.providers[dp]) {
        const pv = config.providers[dp]!;
        const firstModel = pv.modelMap ? Object.values(pv.modelMap)[0] : dp;
        return createDefaultState(dp, firstModel ?? "claude-sonnet-4-20250514");
      }
      return createDefaultState("anthropic", "claude-sonnet-4-20250514");
    }
    throw err;
  }
}

export function saveState(state: RouteState): void {
  mkdirSync(ccmmDir(), { recursive: true });
  const validated = RouteStateSchema.parse({ ...state, updatedAt: nowISO() });
  writeFileSync(statePath(), JSON.stringify(validated, null, 2) + "\n", "utf-8");
}

export function setActiveRoute(providerName: string, config?: Config): RouteState {
  const cfg = config ?? loadConfig();
  let state: RouteState;

  if (cfg.providers[providerName]) {
    // Direct provider/方案 match — activate the entire slot configuration
    const pv = cfg.providers[providerName]!;
    let model = providerName;
    if (pv.modelMap) {
      const firstKey = Object.keys(pv.modelMap)[0];
      if (firstKey) model = pv.modelMap[firstKey]!;
    }
    state = { provider: providerName, model, updatedAt: nowISO() };
  } else {
    // Fallback: treat as a raw model name, use first available provider
    const pkeys = Object.keys(cfg.providers);
    const provider = pkeys.length > 0 ? pkeys[0]! : "anthropic";
    state = { provider, model: providerName, updatedAt: nowISO() };
  }

  saveState(state);
  return state;
}

export function resolveActiveRoute(config: Config, state: RouteState): { provider: string; effectiveModel: string } {
  // Ensure the provider still exists in config (might have been deleted)
  if (!config.providers[state.provider]) {
    const keys = Object.keys(config.providers);
    if (keys.length === 0) return { provider: "anthropic", effectiveModel: state.model };
    return { provider: keys[0]!, effectiveModel: state.model };
  }
  return { provider: state.provider, effectiveModel: state.model };
}

export type StateWatcher = { close(): void };

export function watchState(onChange: (state: RouteState) => void): StateWatcher {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const watcher = watch(statePath(), function() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(function() {
      try { const s = loadState(); onChange(s); } catch { /* ignore */ }
    }, 100);
  });
  return { close: function() { if (timer) clearTimeout(timer); watcher.close(); } };
}
