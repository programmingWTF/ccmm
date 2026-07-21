import { z } from "zod";

export const ProviderSchema = z.object({
  baseUrl: z.string().url("Provider baseUrl must be a valid URL"),
  apiKeyEnv: z.string().optional(),
  apiKey: z.string().optional(),
  wire: z.literal("anthropic"),
  modelMap: z.record(z.string()).optional(),
});
export type Provider = z.infer<typeof ProviderSchema>;

export const PriceSchema = z.object({
  input: z.number().nonnegative("Price input must be >= 0"),
  output: z.number().nonnegative("Price output must be >= 0"),
  cacheWrite: z.number().nonnegative("Price cacheWrite must be >= 0").default(0),
  cacheRead: z.number().nonnegative("Price cacheRead must be >= 0").default(0),
});
export type Price = z.infer<typeof PriceSchema>;

export const ProxyConfigSchema = z.object({
  host: z.string().default("127.0.0.1"),
  port: z.number().int().min(1).max(65535).default(8787),
});
export type ProxyConfig = z.infer<typeof ProxyConfigSchema>;

export const BudgetSchema = z.object({
  dailyUsd: z.number().nonnegative().optional(),
  alert: z.boolean().optional(),
});
export type Budget = z.infer<typeof BudgetSchema>;

export const SmallFastModelSchema = z.object({
  model: z.string(),
  provider: z.string(),
});

export const ConfigSchema = z.object({
  proxy: ProxyConfigSchema.default({ host: "127.0.0.1", port: 8787 }),
  defaultProvider: z.string().optional(),
  language: z.enum(["zh-CN", "en"]).default("zh-CN"),
  currency: z.enum(["USD", "CNY"]).default("USD"),
  smallFastModel: SmallFastModelSchema.optional(),
  providers: z.record(ProviderSchema).default({}),
  prices: z.record(PriceSchema).default({}),
  budget: BudgetSchema.optional(),
});
export type Config = z.infer<typeof ConfigSchema>;
export type Currency = "USD" | "CNY";

export const DEFAULT_CONFIG: Config = {
  proxy: { host: "127.0.0.1", port: 8787 },
  defaultProvider: "anthropic",
  providers: {
    anthropic: {
      baseUrl: "https://api.anthropic.com",
      apiKeyEnv: "ANTHROPIC_API_KEY",
      wire: "anthropic" as const,
    },
  },
  prices: {},
};

export function validateConfig(data: unknown): Config {
  return ConfigSchema.parse(data);
}
