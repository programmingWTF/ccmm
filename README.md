# ccmm — Claude Code Model Manager

> **The fastest way to switch Claude Code's model.** Define your own model plans — map each thinking depth (auto / high / medium / low / subagent) to whatever model you want, across any provider. Then `!ccmm use deepseek` switches all 5 slots at once. Live, mid-session, no restart.
>
> Bonus: real-time cost metering, cache-hit tracking, budget alerts — all in the status line.

< [English](./README.md) | [简体中文](./README.zh.md) >

```
┌──────────────┐   ANTHROPIC_BASE_URL    ┌──────────────┐        ┌─────────────────────┐
│  Claude Code │ ───────────────────────▶│  ccmm proxy  │───────▶│ Anthropic / relay / │
│    (CLI)     │◀─────────────────────── │  (localhost) │◀───────│ OpenAI-compat / local│
└──────────────┘                         └──────┬───────┘        └─────────────────────┘
        ▲  status line                          │ rewrites `model`, meters usage, prices it
        └──────────── reads live metrics ───────┘  ~/.ccmm/ (config · route · metrics)
```

---

## Why ccmm?

Claude Code has gaps for people who care about **which model** they run and **what it costs**:

- Switching models requires `/model` (breaks flow) or editing settings and restarting.
- No at-a-glance view of **cache-hit rate**, **token usage**, or **spend**.
- If you use a **relay / proxy API**, Claude's built-in cost is wrong — it uses Anthropic list prices for the model name *it* sent.

ccmm closes all three with a single **localhost proxy** that sits between Claude Code and your provider — one choke point for **routing** AND **metering**.

## Features

| | |
|---|---|
| 🔀 **Live switching** | `!ccmm use deepseek` inside Claude Code — next message uses the new provider, no restart. |
| 📊 **Real-time status line** | Active model · tokens in/out · cache-hit % · today cost · budget remaining. |
| 🌐 **Any provider** | Anthropic, DeepSeek, OpenRouter, Vercel AI, Moonshot, or any Anthropic-compatible endpoint. |
| 🗂 **Named provider plans** | One `ccmm use <name>` switches an entire 5-slot model mapping at once. |
| 💵 **Your prices** | Per-model price tables so cost is accurate even behind a relay. |
| 🚦 **Budgets & alerts** | Daily spend caps visible in the status line. |
| 🎛 **Interactive config** | `ccmm config` — menu-driven editor for all settings. |
| 🌍 **Bilingual** | 中文 / English — choose on `ccmm setup`, switch anytime in `ccmm config`. |
| 🚀 **Auto-start** | Optional: auto-launch the proxy daemon on system login. |
| 🧩 **Plugin** | Auto-registers status line and MCP tools on install. |

## Install

```bash
npm install -g ccmm
ccmm init          # points Claude Code at the proxy + registers the status line
```

`ccmm init` is idempotent and backs up every file it touches.

## Quickstart

```bash
ccmm setup                # interactive wizard: choose language → add providers → 5-slot model map
ccmm use deepseek         # switch to DeepSeek (`!ccmm use deepseek` inside Claude)
ccmm config               # interactive config editor
ccmm stats today          # what did I spend?
```

## Commands

| Command | |
|---|---|
| `ccmm setup` | Interactive wizard — add providers, 5-slot model mapping, budget, auto-start |
| `ccmm config` | Interactive editor — browse/modify all settings |
| `ccmm start` / `stop` / `logs` | Proxy daemon lifecycle |
| `ccmm use <name>` | Switch active provider/方案 (live, hot-reloaded) |
| `ccmm current` | Show active provider and model |
| `ccmm models` | List all providers and priced models |
| `ccmm provider add\|rm\|list` | Manage providers via CLI |
| `ccmm price set\|rm\|list` | Manage per-model prices |
| `ccmm stats [today\|session\|week\|all]` | Usage & cost report |
| `ccmm statusline` | (internal) renders the status line |
| `ccmm doctor` | Diagnose setup |
| `ccmm init` | Initialize and register with Claude Code |

## Configuration

`~/.ccmm/config.json`:

```jsonc
{
  "proxy":   { "host": "127.0.0.1", "port": 8787 },
  "defaultProvider": "deepseek",
  "language": "zh-CN",
  "providers": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com/anthropic",
      "apiKeyEnv": "DEEPSEEK_API_KEY",
      "wire": "anthropic",
      "modelMap": {
        "ANTHROPIC_MODEL": "deepseek-v4-pro",
        "ANTHROPIC_DEFAULT_OPUS_MODEL": "deepseek-v4-pro",
        "ANTHROPIC_DEFAULT_SONNET_MODEL": "deepseek-v4-flash",
        "ANTHROPIC_DEFAULT_HAIKU_MODEL": "deepseek-v4-flash",
        "CLAUDE_CODE_SUBAGENT_MODEL": "deepseek-v4-flash"
      }
    }
  },
  "prices": {
    "deepseek-v4-pro": { "input": 2.0, "output": 8.0, "cacheRead": 0.2, "cacheWrite": 3.0 }
  },
  "budget": { "dailyUsd": 20, "alert": true }
}
```

- **Provider/方案** — a named config (endpoint + API key + 5-slot `modelMap`). One `ccmm use <name>` switches the entire plan.
- **`modelMap`** — maps Claude Code's 5 thinking-depth placeholders to real upstream model IDs.
- **Prices** — USD per 1M tokens. Cost is computed from the *forwarded* model, not the requested one.
- **`language`** — `"zh-CN"` or `"en"`.

## How it works

1. `ccmm init` sets `ANTHROPIC_BASE_URL=http://127.0.0.1:8787`.
2. All Claude Code API requests go through the ccmm proxy.
3. The proxy checks the active provider's `modelMap` → rewrites `body.model` → forwards.
4. Response streams back transparently; `usage` is captured from SSE events for metering.
5. **Prompt caching is preserved** — only `body.model` and auth headers are touched.

## Status line

```
🧠 deepseek-v4-pro · ▲12.4k ▼3.1k · cache 87% · $0.42 today · $19.58 left
```

Auto-degrades to parsing Claude Code's transcript JSONL when the proxy isn't running.

## Roadmap

Interactive TUI dashboard, model recommendations, Bedrock/Vertex providers, OpenAI-compatible wire translation.

## Credits

- [tweakcc](https://github.com/Piebald-AI/tweakcc) · [claude-code-router](https://github.com/musistudio/claude-code-router) · [LiteLLM](https://github.com/BerriAI/litellm)
- [How I built a hot-swappable backend proxy for Claude Code](https://hackernoon.com/how-i-built-a-hot-swappable-backend-proxy-for-claude-code)
- Anthropic's [LLM gateway docs](https://code.claude.com/docs/en/llm-gateway-connect)

## Disclaimer

ccmm is an independent project — **not affiliated with Anthropic**. API keys are stored locally in `~/.ccmm/` and sent only to the providers you specify.

## License

MIT ([LICENSE](./LICENSE)).
