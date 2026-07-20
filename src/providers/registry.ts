import type { Config, Provider, Profile } from "../schemas/config.js";

export interface ProviderTemplate {
  id: string;
  name: string;
  description: string;
  baseUrl: string;
  apiKeyEnv: string;
  authTokenEnv?: string;
  models: { fast: string; balanced: string; deep: string };
  prices?: {
    fast: { input: number; output: number };
    balanced: { input: number; output: number };
    deep: { input: number; output: number };
  };
}

export const PROVIDER_TEMPLATES: ProviderTemplate[] = [
  {
    id: "anthropic",
    name: "Anthropic Official",
    description: "Direct Anthropic API — best latency, full feature support",
    baseUrl: "https://api.anthropic.com",
    apiKeyEnv: "ANTHROPIC_API_KEY",
    models: {
      fast: "claude-haiku-4-5-20251001",
      balanced: "claude-sonnet-4-20250514",
      deep: "claude-opus-4-1-20250805",
    },
    prices: {
      fast: { input: 1.0, output: 5.0 },
      balanced: { input: 3.0, output: 15.0 },
      deep: { input: 15.0, output: 75.0 },
    },
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    description: "Multi-provider gateway — 300+ models, small markup",
    baseUrl: "https://openrouter.ai/api",
    apiKeyEnv: "OPENROUTER_API_KEY",
    authTokenEnv: "ANTHROPIC_AUTH_TOKEN",
    models: {
      fast: "anthropic/claude-haiku-4-5",
      balanced: "anthropic/claude-sonnet-4",
      deep: "anthropic/claude-opus-4-1",
    },
  },
  {
    id: "deepseek",
    name: "DeepSeek (Anthropic-compat)",
    description: "DeepSeek v4 models with Anthropic protocol",
    baseUrl: "https://api.deepseek.com/anthropic",
    apiKeyEnv: "DEEPSEEK_API_KEY",
    models: {
      fast: "deepseek-v4-flash",
      balanced: "deepseek-v4-pro",
      deep: "deepseek-v4-pro",
    },
  },
  {
    id: "vercel",
    name: "Vercel AI Gateway",
    description: "Vercel unified AI gateway, Anthropic-compatible",
    baseUrl: "https://ai-gateway.vercel.sh",
    apiKeyEnv: "VERCEL_AI_GATEWAY_KEY",
    models: {
      fast: "claude-haiku-4-5",
      balanced: "claude-sonnet-4",
      deep: "claude-opus-4-1",
    },
  },
  {
    id: "moonshot",
    name: "Moonshot AI",
    description: "Moonshot API, Anthropic-compatible",
    baseUrl: "https://api.moonshot.ai/anthropic",
    apiKeyEnv: "MOONSHOT_API_KEY",
    models: {
      fast: "moonshot-v1-8k",
      balanced: "moonshot-v1-32k",
      deep: "moonshot-v1-128k",
    },
  },
];

export function buildConfigFromTemplate(
  template: ProviderTemplate,
  apiKeyValue: string,
  overrides?: { fast?: string; balanced?: string; deep?: string },
): { config: Partial<Config>; envVars: Record<string, string> } {
  const providerId = template.id;
  const profiles: Record<string, Profile> = {};

  profiles.fast = { model: overrides?.fast ?? template.models.fast, provider: providerId };
  profiles.balanced = { model: overrides?.balanced ?? template.models.balanced, provider: providerId };
  profiles.deep = { model: overrides?.deep ?? template.models.deep, provider: providerId };

  const provider: Provider = {
    baseUrl: template.baseUrl,
    apiKeyEnv: template.apiKeyEnv,
    wire: "anthropic" as const,
  };

  const envVars: Record<string, string> = { [template.apiKeyEnv]: apiKeyValue };
  if (template.authTokenEnv) envVars[template.authTokenEnv] = apiKeyValue;

  return {
    config: {
      defaultProfile: "balanced",
      profiles,
      providers: { [providerId]: provider },
      prices: {},
      budget: { dailyUsd: 20, alert: true },
    },
    envVars,
  };
}
