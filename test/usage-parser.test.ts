import { describe, it, expect } from "vitest";
import { UsageParser } from "../src/proxy/usage-parser.js";

describe("UsageParser", () => {
  it("parses a complete SSE message_start event", () => {
    const parser = new UsageParser();
    const sse = [
      "event: message_start",
      'data: {"type":"message_start","message":{"usage":{"input_tokens":100,"cache_read_input_tokens":500,"cache_creation_input_tokens":50}}}',
      "",
      "",
    ].join("\n");
    parser.feed(sse);
    const usage = parser.getUsage();
    expect(usage.inputTokens).toBe(100);
    expect(usage.cacheReadTokens).toBe(500);
    expect(usage.cacheWriteTokens).toBe(50);
    expect(usage.outputTokens).toBe(0);
  });

  it("parses message_delta for output tokens", () => {
    const parser = new UsageParser();
    const sse = [
      "event: message_start",
      'data: {"type":"message_start","message":{"usage":{"input_tokens":10}}}',
      "",
      "event: message_delta",
      'data: {"type":"message_delta","usage":{"output_tokens":250}}',
      "",
      "event: message_stop",
      'data: {"type":"message_stop"}',
      "",
      "",
    ].join("\n");
    parser.feed(sse);
    const usage = parser.getUsage();
    expect(usage.inputTokens).toBe(10);
    expect(usage.outputTokens).toBe(250);
    expect(parser.isComplete).toBe(true);
  });

  it("handles multi-chunk input", () => {
    const parser = new UsageParser();
    parser.feed(
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":50}}}\n\n',
    );
    parser.feed(
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    );
    expect(parser.getUsage().inputTokens).toBe(50);
    expect(parser.isComplete).toBe(true);
  });

  it("handles empty input gracefully", () => {
    const parser = new UsageParser();
    parser.feed("");
    const usage = parser.getUsage();
    expect(usage.inputTokens).toBe(0);
    expect(parser.isComplete).toBe(false);
  });

  it("resets state for new requests", () => {
    const parser = new UsageParser();
    parser.feed(
      'event: message_start\ndata: {"type":"message_start","message":{"usage":{"input_tokens":42}}}\n\n',
    );
    parser.feed('event: message_stop\ndata: {"type":"message_stop"}\n\n');
    expect(parser.isComplete).toBe(true);
    parser.reset();
    expect(parser.isComplete).toBe(false);
    expect(parser.getUsage().inputTokens).toBe(0);
  });
});
