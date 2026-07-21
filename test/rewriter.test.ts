import { describe, it, expect } from "vitest";
import {
  rewriteBody,
  buildUpstreamUrl,
  buildUpstreamHeaders,
} from "../src/proxy/rewriter.js";
import type { Provider } from "../src/schemas/config.js";

// ── rewriteBody ────────────────────────────────────────────────

describe("rewriteBody", () => {
  it("replaces the model field with the effective model", () => {
    const body = { model: "claude-sonnet-4-20250514", max_tokens: 1024 };
    const result = rewriteBody(body, "claude-opus-4-1-20250805");
    expect(result.model).toBe("claude-opus-4-1-20250805");
    expect(result.max_tokens).toBe(1024);
  });

  it("preserves all other fields", () => {
    const body = {
      model: "old-model",
      messages: [{ role: "user", content: "hello" }],
      temperature: 0.7,
      stream: true,
      thinking: { budget_tokens: 8000 },
    };
    const result = rewriteBody(body, "new-model");
    expect(result.model).toBe("new-model");
    expect(result.messages).toEqual(body.messages);
    expect(result.temperature).toBe(0.7);
    expect(result.stream).toBe(true);
    expect(result.thinking).toEqual(body.thinking);
  });

  it("adds model when body has no model field", () => {
    const body: Record<string, unknown> = { max_tokens: 100 };
    const result = rewriteBody(body, "claude-haiku-4-5-20251001");
    expect(result.model).toBe("claude-haiku-4-5-20251001");
    expect(result.max_tokens).toBe(100);
  });

  it("does not mutate the original object", () => {
    const body = { model: "original", x: 1 };
    const result = rewriteBody(body, "changed");
    expect(body.model).toBe("original");
    expect(result.model).toBe("changed");
  });
});

// ── buildUpstreamUrl ───────────────────────────────────────────

describe("buildUpstreamUrl", () => {
  it("joins base URL and path with a single slash", () => {
    expect(buildUpstreamUrl("https://api.anthropic.com", "/v1/messages")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("strips trailing slash from base URL", () => {
    expect(buildUpstreamUrl("https://api.anthropic.com/", "/v1/messages")).toBe(
      "https://api.anthropic.com/v1/messages",
    );
  });

  it("adds leading slash to path when missing", () => {
    expect(buildUpstreamUrl("https://example.com", "v1/messages")).toBe(
      "https://example.com/v1/messages",
    );
  });

  it("strips multiple trailing slashes", () => {
    expect(buildUpstreamUrl("https://example.com///", "/api")).toBe(
      "https://example.com/api",
    );
  });

  it("handles base URL with subpath", () => {
    expect(buildUpstreamUrl("https://api.deepseek.com/anthropic", "/v1/messages")).toBe(
      "https://api.deepseek.com/anthropic/v1/messages",
    );
  });
});

// ── buildUpstreamHeaders ───────────────────────────────────────

const makeProvider = (overrides?: Partial<Provider>): Provider => ({
  baseUrl: "https://api.example.com",
  wire: "anthropic",
  ...overrides,
});

describe("buildUpstreamHeaders", () => {
  it("forwards content-type, accept, anthropic-version, anthropic-beta", () => {
    const incoming: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json",
      "anthropic-version": "2023-06-01",
      "anthropic-beta": "message-batches-2024-09-24",
    };
    const headers = buildUpstreamHeaders(incoming, makeProvider());
    expect(headers["content-type"]).toBe("application/json");
    expect(headers["accept"]).toBe("application/json");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["anthropic-beta"]).toBe("message-batches-2024-09-24");
  });

  it("unwraps array header values to first element", () => {
    const incoming: Record<string, string | string[]> = {
      "content-type": ["application/json", "text/plain"],
    };
    const headers = buildUpstreamHeaders(incoming, makeProvider());
    expect(headers["content-type"]).toBe("application/json");
  });

  it("omits headers not in the forward-allowlist", () => {
    const incoming: Record<string, string> = {
      "x-custom": "secret",
      authorization: "Bearer token123",
      host: "evil.com",
    };
    const headers = buildUpstreamHeaders(incoming, makeProvider());
    expect(headers["x-custom"]).toBeUndefined();
    expect(headers["authorization"]).toBeUndefined();
    expect(headers["host"]).toBeUndefined();
  });

  it("sets x-api-key from provider.apiKey", () => {
    const provider = makeProvider({ apiKey: "sk-test-key" });
    const headers = buildUpstreamHeaders({}, provider);
    expect(headers["x-api-key"]).toBe("sk-test-key");
  });

  it("falls back to env var when provider.apiKey is not set", () => {
    const provider = makeProvider({ apiKeyEnv: "CCMM_TEST_KEY" });
    process.env.CCMM_TEST_KEY = "env-fallback-key";
    try {
      const headers = buildUpstreamHeaders({}, provider);
      expect(headers["x-api-key"]).toBe("env-fallback-key");
    } finally {
      delete process.env.CCMM_TEST_KEY;
    }
  });

  it("prefers config apiKey over env var", () => {
    const provider = makeProvider({ apiKey: "config-key", apiKeyEnv: "CCMM_TEST_KEY2" });
    process.env.CCMM_TEST_KEY2 = "env-key";
    try {
      const headers = buildUpstreamHeaders({}, provider);
      expect(headers["x-api-key"]).toBe("config-key");
    } finally {
      delete process.env.CCMM_TEST_KEY2;
    }
  });

  it("does not set x-api-key when neither is available", () => {
    const provider = makeProvider();
    const headers = buildUpstreamHeaders({}, provider);
    expect(headers["x-api-key"]).toBeUndefined();
  });

  it("handles empty incoming headers object", () => {
    const headers = buildUpstreamHeaders({}, makeProvider({ apiKey: "k" }));
    expect(Object.keys(headers).sort()).toEqual(["x-api-key"]);
  });
});
