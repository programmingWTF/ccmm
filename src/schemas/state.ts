import { z } from "zod";

export const RouteStateSchema = z.object({
  provider: z.string().min(1),
  model: z.string().min(1),
  updatedAt: z.string().datetime(),
});

export type RouteState = z.infer<typeof RouteStateSchema>;

export function createDefaultState(provider: string, model: string): RouteState {
  return { provider, model, updatedAt: new Date().toISOString() };
}
