import type { Provider } from "../schemas/config.js";
import { readApiKey } from "../util/env.js";

export function rewriteBody(
  body: Record<string, unknown>,
  effectiveModel: string
): Record<string, unknown> {
  return { ...body, model: effectiveModel };
}

export function buildUpstreamHeaders(
  incomingHeaders: Record<string, string | string[] | undefined>,
  provider: Provider
): Record<string, string> {
  const headers: Record<string, string> = {};

  const forwardKeys = ["content-type", "accept", "anthropic-version", "anthropic-beta"];
  for (const key of forwardKeys) {
    const val = incomingHeaders[key];
    if (val) {
      headers[key] = Array.isArray(val) ? val[0] ?? "" : val;
    }
  }

  // API key: prefer config file, fall back to env var
  let apiKey: string | undefined = provider.apiKey;

  // If no key in config, try the env var (for backward compat)
  if (!apiKey && provider.apiKeyEnv) {
    apiKey = readApiKey(provider.apiKeyEnv);
  }

  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  return headers;
}

export function buildUpstreamUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/+$/, "");
  const p = path.startsWith("/") ? path : "/" + path;
  return base + p;
}
