import { describe, it, expect } from "vitest";
import {
  PROVIDER_TEMPLATES,
  buildConfigFromTemplate,
} from "../src/providers/registry.js";

// ── PROVIDER_TEMPLATES structure ───────────────────────────────

describe("PROVIDER_TEMPLATES", () => {
  it("contains at least the five built-in providers", () => {
    const ids = PROVIDER_TEMPLATES.map((p) => p.id);
    expect(ids).toContain("anthropic");
    expect(ids).toContain("openrouter");
    expect(ids).toContain("deepseek");
    expect(ids).toContain("vercel");
    expect(ids).toContain("moonshot");
  });

  it("every template has required fields and valid baseUrl", () => {
    for (const pt of PROVIDER_TEMPLATES) {
      expect(pt.id).toBeTruthy();
      expect(pt.name).toBeTruthy();
      expect(pt.baseUrl).toMatch(/^https?:\/\//);
      expect(pt.apiKeyEnv).toBeTruthy();
      expect(pt.models.fast).toBeTruthy();
      expect(pt.models.balanced).toBeTruthy();
      expect(pt.models.deep).toBeTruthy();
    }
  });

  it("every provider id is unique", () => {
    const ids = PROVIDER_TEMPLATES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("every baseUrl uses https", () => {
    for (const pt of PROVIDER_TEMPLATES) {
      expect(pt.baseUrl.startsWith("https://")).toBe(true);
    }
  });
});

// ── buildConfigFromTemplate ────────────────────────────────────

describe("buildConfigFromTemplate", () => {
  const anthropicTemplate = PROVIDER_TEMPLATES.find((p) => p.id === "anthropic")!;

  it("creates config with default profile 'balanced'", () => {
    const { config } = buildConfigFromTemplate(anthropicTemplate, "sk-test");
    expect(config.defaultProfile).toBe("balanced");
  });

  it("maps fast/balanced/deep profiles to template models", () => {
    const { config } = buildConfigFromTemplate(anthropicTemplate, "sk-test");
    expect(config.profiles?.fast?.model).toBe(anthropicTemplate.models.fast);
    expect(config.profiles?.balanced?.model).toBe(anthropicTemplate.models.balanced);
    expect(config.profiles?.deep?.model).toBe(anthropicTemplate.models.deep);
  });

  it("sets provider with template baseUrl and apiKeyEnv", () => {
    const { config } = buildConfigFromTemplate(anthropicTemplate, "sk-test");
    const pv = config.providers?.anthropic;
    expect(pv).toBeDefined();
    expect(pv?.baseUrl).toBe(anthropicTemplate.baseUrl);
    expect(pv?.apiKeyEnv).toBe(anthropicTemplate.apiKeyEnv);
    expect(pv?.wire).toBe("anthropic");
  });

  it("sets env var with the API key value", () => {
    const { envVars } = buildConfigFromTemplate(anthropicTemplate, "my-key");
    expect(envVars[anthropicTemplate.apiKeyEnv]).toBe("my-key");
  });

  it("also sets authTokenEnv when template has one (e.g. OpenRouter)", () => {
    const openRouter = PROVIDER_TEMPLATES.find((p) => p.id === "openrouter")!;
    const { envVars } = buildConfigFromTemplate(openRouter, "sk-or");
    expect(envVars[openRouter.authTokenEnv!]).toBe("sk-or");
  });

  it("applies model overrides for specific profiles", () => {
    const { config } = buildConfigFromTemplate(anthropicTemplate, "k", {
      fast: "my-custom-fast",
      balanced: "my-custom-balanced",
    });
    expect(config.profiles?.fast?.model).toBe("my-custom-fast");
    expect(config.profiles?.balanced?.model).toBe("my-custom-balanced");
    // deep not overridden — should remain template default
    expect(config.profiles?.deep?.model).toBe(anthropicTemplate.models.deep);
  });

  it("sets a default budget ($20/day with alert)", () => {
    const { config } = buildConfigFromTemplate(anthropicTemplate, "k");
    expect(config.budget?.daily).toBe(20);
    expect(config.budget?.alert).toBe(true);
  });
});
