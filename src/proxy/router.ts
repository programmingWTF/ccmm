import { loadConfig, watchConfig, type Config } from "../store/config.js";
import { loadState, watchState, resolveActiveRoute, type StateWatcher } from "../store/state.js";
import type { RouteState } from "../schemas/state.js";

export interface ResolvedRoute {
  provider: string;
  effectiveModel: string;
}

export class Router {
  private current: ResolvedRoute;
  private config: Config;
  private stateWatcher: StateWatcher | null = null;
  private configWatcher: ReturnType<typeof watchConfig> | null = null;

  constructor() {
    this.config = loadConfig();
    const state = loadState();
    this.current = resolveActiveRoute(this.config, state);
  }

  getRoute(): ResolvedRoute {
    return { ...this.current };
  }

  getConfig(): Config {
    return this.config;
  }

  refresh(): void {
    try {
      this.config = loadConfig();
      const state = loadState();
      this.current = resolveActiveRoute(this.config, state);
    } catch {
      // keep current route on error
    }
  }

  startWatch(): void {
    this.stateWatcher = watchState(() => {
      this.refresh();
    });
    this.configWatcher = watchConfig((newConfig: Config) => {
      this.config = newConfig;
      const state = loadState();
      this.current = resolveActiveRoute(this.config, state);
    });
  }

  stopWatch(): void {
    this.stateWatcher?.close();
    this.configWatcher?.close();
  }
}
