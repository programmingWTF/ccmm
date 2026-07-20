import type { UsageRecord } from "../schemas/metrics.js";

interface ParserState {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  complete: boolean;
}

export class UsageParser {
  private state: ParserState = {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
    complete: false,
  };
  private buffer = "";

  feed(chunk: string): void {
    this.buffer += chunk;
    this.processEvents();
  }

  get isComplete(): boolean {
    return this.state.complete;
  }

  getUsage(): UsageRecord {
    return {
      inputTokens: this.state.inputTokens,
      outputTokens: this.state.outputTokens,
      cacheReadTokens: this.state.cacheReadTokens,
      cacheWriteTokens: this.state.cacheWriteTokens,
    };
  }

  reset(): void {
    this.state = {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      complete: false,
    };
    this.buffer = "";
  }

  private processEvents(): void {
    // SSE events are separated by double newlines
    const parts = this.buffer.split("\n\n");
    // Keep the last potentially incomplete part in buffer
    this.buffer = parts.pop() ?? "";

    for (const part of parts) {
      if (!part.trim()) continue;
      this.processEvent(part);
    }
  }

  private processEvent(event: string): void {
    const lines = event.split("\n");
    let eventType = "";
    let data = "";

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        eventType = line.slice(7).trim();
      } else if (line.startsWith("data: ")) {
        data = line.slice(6);
      }
    }

    if (!data) return;

    try {
      const parsed = JSON.parse(data);

      switch (eventType) {
        case "message_start": {
          const usage = parsed?.message?.usage;
          if (usage) {
            this.state.inputTokens = usage.input_tokens ?? 0;
            this.state.cacheReadTokens = usage.cache_read_input_tokens ?? 0;
            this.state.cacheWriteTokens = usage.cache_creation_input_tokens ?? 0;
          }
          break;
        }
        case "message_delta": {
          const usage = parsed?.usage;
          if (usage) {
            this.state.outputTokens = usage.output_tokens ?? 0;
          }
          break;
        }
        case "message_stop": {
          this.state.complete = true;
          break;
        }
      }
    } catch {
      // skip unparseable data
    }
  }
}
