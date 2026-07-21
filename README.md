# ccmm — Claude Code Model Manager

> **The fastest way to switch Claude Code's model.** Define your own model plans — map each thinking depth (auto / high / medium / low / subagent) to whatever model you want, across any provider. Then `!ccmm use deepseek` switches all 5 slots at once. Live, mid-session, no restart.
>
> Bonus: real-time cost metering, cache-hit tracking, budget alerts — all in the status line.

< English | [简体中文](./README.zh.md) >

<p align="center">
  <a href="https://www.npmjs.com/package/@pgwtf/ccmm"><img src="https://img.shields.io/npm/v/@pgwtf/ccmm?color=blue" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/npm/l/@pgwtf/ccmm" alt="license" /></a>
  <img src="https://img.shields.io/node/v/@pgwtf/ccmm" alt="node version" />
</p>

```
┌──────────────┐   ANTHROPIC_BASE_URL    ┌──────────────┐        ┌─────────────────────┐
│  Claude Code │ ───────────────────────▶│  ccmm proxy  │───────▶│ Anthropic / relay / │
│    (CLI)     │◀─────────────────────── │  (localhost) │◀───────│ OpenAI-compat / local│
└──────────────┘                         └──────┬───────┘        └─────────────────────┘
        ▲  status line                          │ rewrites `model`, meters usage, prices it
        └──────────── reads live metrics ───────┘  ~/.ccmm/ (config · route · metrics)
```

---

## ❓ Why ccmm?

Claude Code picks models automatically based on thinking depth, but it doesn't let you **choose which models those are** — and it sure doesn't let you **switch all five at once**.

ccmm flips that: you define a **方案 (plan)** — a named set of five model slots mapping each thinking depth (auto / high / medium / low / subagent) to whatever model you want, on whatever provider you trust. Then one command swaps the entire plan. Live. Mid-session. No restart.

> **v1 is Anthropic Messages API only.** Your provider must speak the Anthropic wire protocol. OpenAI-compatible translation is on the roadmap.

Beyond switching:

- **Your cost, not Anthropic's** — if you route through a different provider, Claude's built-in cost number is wrong. ccmm meters at the proxy on the *actual* forwarded model with your own price table.
- **Cache-hit visibility** — ccmm tracks `cache_read_input_tokens` and `cache_creation_input_tokens` from SSE events and shows the real cache-hit percentage in the status line. You can see whether your provider is giving you the caching you're paying for.
- **No workflow interruption** — `!ccmm use my-model` in the Claude Code prompt box. Hot-reloaded. Instant.

## ✨ Features

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
| 🔄 **Auto-update** | `ccmm update` checks npm for new versions; auto-notifies on `start`/`config`/`setup`. |
| 🧩 **Plugin** | Auto-registers status line and MCP tools on install. |

## 📋 Prerequisites

- Node.js >= 18.0.0
- Claude Code installed (`@anthropic-ai/claude-code`)

## 📦 Install

```bash
npm install -g @pgwtf/ccmm
ccmm setup         # interactive wizard: language → providers → 5-slot model map → done
```

`ccmm setup` handles everything (init, provider config, settings sync). It's idempotent and backs up every file it touches.

## 🚀 Quickstart

```bash
ccmm setup                # first-time wizard (skip if already configured)
ccmm config               # interactive editor — tweak providers, prices, budget anytime
ccmm start                # start the proxy daemon
ccmm use deepseek         # switch to DeepSeek (`!ccmm use deepseek` inside Claude)
ccmm stats today          # what did I spend?
ccmm update               # check & install updates
```

## 📟 Commands

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
| `ccmm update` | Check for updates and install the latest version |
| `ccmm init` | Quick non-interactive init (prefer `ccmm setup`) |

## ⚙️ Configuration

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
  "pricesUSD": {
    "deepseek-v4-pro": { "input": 2.0, "output": 8.0, "cacheRead": 0.2, "cacheWrite": 3.0 }
  },
  "pricesCNY": {},
  "budget": { "daily": 20, "alert": true }
}
```

- **Provider/方案** — a named config (endpoint + API key + 5-slot `modelMap`). One `ccmm use <name>` switches the entire plan.
- **`modelMap`** — maps Claude Code's 5 thinking-depth placeholders to real upstream model IDs.
- **Prices** — per 1M tokens, stored per currency (`pricesUSD` / `pricesCNY`). Cost is computed from the *forwarded* model, not the requested one.
- **`currency`** — `"USD"` or `"CNY"`. Determines which price table and symbol (`$`/`¥`) is used.
- **`language`** — `"zh-CN"` or `"en"`.

## 🔧 How it works

1. `ccmm setup` writes `ANTHROPIC_BASE_URL=http://127.0.0.1:8787` into Claude Code settings.
2. All Claude Code API requests go through the ccmm proxy.
3. The proxy checks the active provider's `modelMap` → rewrites `body.model` → forwards.
4. Response streams back transparently; `usage` is captured from SSE events for metering.
5. **Prompt caching is preserved** — only `body.model` and auth headers are touched.

## 📊 Status line

```
🧠 deepseek-v4-pro · ▲12.4k ▼3.1k · cache 87% · $0.42 today · $19.58 left
```

Auto-degrades to parsing Claude Code's transcript JSONL when the proxy isn't running.

## 🗺️ Roadmap

Interactive TUI dashboard, model recommendations, Bedrock/Vertex providers, OpenAI-compatible wire translation.

## 🙏 Credits

- [tweakcc](https://github.com/Piebald-AI/tweakcc) · [claude-code-router](https://github.com/musistudio/claude-code-router) · [LiteLLM](https://github.com/BerriAI/litellm)
- [How I built a hot-swappable backend proxy for Claude Code](https://hackernoon.com/how-i-built-a-hot-swappable-backend-proxy-for-claude-code)
- Anthropic's [LLM gateway docs](https://code.claude.com/docs/en/llm-gateway-connect)

## ⚖️ Disclaimer

ccmm is an independent project — **not affiliated with Anthropic**. API keys are stored locally in `~/.ccmm/` and sent only to the providers you specify.

## 📄 License

MIT ([LICENSE](./LICENSE)).
