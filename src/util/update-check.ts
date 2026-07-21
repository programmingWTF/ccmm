import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { ccmmDir } from "./paths.js";

const PACKAGE_NAME = "@pgwtf/ccmm";
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface UpdateCache {
  lastCheck: number;
  latestVersion: string;
}

function cachePath(): string {
  return join(ccmmDir(), "update-check.json");
}

/** Get the current installed version from package.json (injected at build or read from VERSION constant). */
export function getCurrentVersion(): string {
  // This is kept in sync with src/index.ts VERSION constant
  try {
    const pkg = JSON.parse(readFileSync(join(ccmmDir(), "..", "package.json"), "utf-8"));
    if (pkg.name === PACKAGE_NAME) return pkg.version;
  } catch { /* ignore */ }
  // Fallback: try to get from npm
  try {
    const v = execSync(`npm list -g ${PACKAGE_NAME} --depth=0`, { encoding: "utf-8", timeout: 5000 });
    const m = v.match(/@pgwtf\/ccmm@([\d.]+)/);
    if (m?.[1]) return m[1];
  } catch { /* ignore */ }
  return "0.0.0";
}

/** Fetch the latest version from npm registry. Returns null on failure. */
export function fetchLatestVersion(): string | null {
  try {
    const result = execSync(`npm view ${PACKAGE_NAME} version`, {
      encoding: "utf-8",
      timeout: 10000,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const version = result.trim();
    return version || null;
  } catch {
    return null;
  }
}

/** Compare semver strings. Returns true if a > b. */
export function isNewerVersion(a: string, b: string): boolean {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] ?? 0;
    const nb = pb[i] ?? 0;
    if (na > nb) return true;
    if (na < nb) return false;
  }
  return false;
}

/** Read cached update info. */
function readCache(): UpdateCache | null {
  try {
    if (!existsSync(cachePath())) return null;
    return JSON.parse(readFileSync(cachePath(), "utf-8")) as UpdateCache;
  } catch {
    return null;
  }
}

/** Write update cache. */
function writeCache(data: UpdateCache): void {
  try {
    mkdirSync(ccmmDir(), { recursive: true });
    writeFileSync(cachePath(), JSON.stringify(data, null, 2), "utf-8");
  } catch { /* ignore write errors */ }
}

export interface UpdateInfo {
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
}

/**
 * Check for updates. Uses cache to avoid hitting npm every time.
 * Set force=true to bypass cache.
 */
export function checkForUpdate(currentVersion: string, force = false): UpdateInfo | null {
  const cache = readCache();

  // Use cache if fresh enough
  if (!force && cache && (Date.now() - cache.lastCheck < CHECK_INTERVAL_MS)) {
    return {
      hasUpdate: isNewerVersion(cache.latestVersion, currentVersion),
      currentVersion,
      latestVersion: cache.latestVersion,
    };
  }

  // Fetch from npm
  const latest = fetchLatestVersion();
  if (!latest) {
    // Network failure — use stale cache if available
    if (cache) {
      return {
        hasUpdate: isNewerVersion(cache.latestVersion, currentVersion),
        currentVersion,
        latestVersion: cache.latestVersion,
      };
    }
    return null;
  }

  writeCache({ lastCheck: Date.now(), latestVersion: latest });

  return {
    hasUpdate: isNewerVersion(latest, currentVersion),
    currentVersion,
    latestVersion: latest,
  };
}

/** Perform the actual update via npm install -g. Returns true on success. */
export function performUpdate(): boolean {
  try {
    execSync(`npm install -g ${PACKAGE_NAME}@latest`, {
      encoding: "utf-8",
      timeout: 120000,
      stdio: "inherit",
    });
    return true;
  } catch {
    return false;
  }
}
