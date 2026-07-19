# ccmm — Claude Code Model Manager

> Switch models **mid-session** in Claude Code, watch **usage / cache-hit / real cost** live in the status line, and **route requests to any provider** — all from one tiny CLI.

```
┌──────────────┐   ANTHROPIC_BASE_URL    ┌──────────────┐        ┌─────────────────────┐
│  Claude Code │ ───────────────────────▶│  ccmm proxy  │───────▶│ Anthropic / relay / │
│    (CLI)     │◀─────────────────────── │  (localhost) │◀───────│ OpenAI-compat / local│
└──────────────┘                         └──────┬───────┘        └─────────────────────┘
        ▲  status line                          │ rewrites `model`, meters usage, prices it
        └──────────── reads live metrics ───────┘  ~/.ccmm/ (config · route · metrics)
```

> ⚠️ **Status: early design / pre-release.** The architecture below is settled; v1 code is on the way. Command names and config keys may still shift slightly before `0.1.0`.

---

## Why ccmm?

Claude Code ships with a few gaps for people who care about **which model** they run and **what it costs**:

- Switching models means the built-in `/model` command (breaks your flow) or editing settings and restarting.
- There's no at-a-glance view of **cache-hit rate**, **token usage**, or **spend**.
- If you use a **relay / proxy API** with your own pricing, Claude's built-in cost number is wrong — it always assumes Anthropic list prices for the model name *it* sent.

ccmm closes all three with a single lightweight **localhost proxy** that sits between Claude Code and your provider. Because every request flows through it, the proxy is one choke point that handles **routing** *and* **metering** at the same time.

## Features

| | |
|---|---|
| 🔀 **Live model switching** | `!ccmm use opus` inside Claude Code → takes effect on the *next message*. No restart, no patching. |
| 📊 **Real-time status line** | Active model · thinking tier · tokens in/out · cache-hit % · session & today cost · budget remaining. |
| 🌐 **Any provider** | Route different models to Anthropic, relays/proxies (`ANTHROPIC_BASE_URL`-style), OpenAI-compatible endpoints, or local servers. |
| 💵 **Your prices, your cost** | Per-model price tables (input / output / cache-write / cache-read) so cost is accurate even behind a relay. |
| 🗂 **Profiles** | Named presets like `fast`, `smart`, `code` — one word to switch a whole model+provider combo. |
| 🚦 **Budgets & alerts** | Daily/session spend caps; status line turns red as you approach the limit. |
| 🧩 **Claude Code plugin** | Auto-registers the status line and a `/ccmm` command on install. |
| 🧪 **Native picker (experimental)** | Opt-in patch that adds models to Claude Code's own `/model` menu / a hotkey (see [Experimental](#experimental-native-in-ui-picker)). |

## Install

```bash
npm install -g ccmm
ccmm init          # points Claude Code at the proxy + registers the status line
```

`ccmm init` is idempotent and backs up any file it touches. It:

1. writes a default `~/.ccmm/config.json`,
2. sets `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` for Claude Code (via its settings `env`),
3. registers the `ccmm statusline` command in Claude Code's `statusLine` setting,
4. starts the proxy.

## Quickstart

```bash
ccmm init                 # one-time setup
ccmm price set claude-opus-4-1 --input 15 --output 75 --cache-read 1.5 --cache-write 18.75
ccmm profile add smart --model claude-opus-4-1 --provider anthropic
ccmm profile add fast  --model claude-haiku-3-5 --provider anthropic
ccmm use smart            # switch (also works live as `!ccmm use smart` inside Claude)
ccmm stats today          # what did I spend?
```

Inside Claude Code, switching is just a bang-command in the prompt box:

```
!ccmm use fast
```

The proxy hot-reloads; the very next message runs on the new model.

## Commands

| Command | What it does |
|---|---|
| `ccmm init` | Set up config, point Claude Code at the proxy, register status line |
| `ccmm start` / `ccmm stop` | Manage the proxy daemon |
| `ccmm use <profile\|model>` | Switch the active route (live, hot-reloaded) |
| `ccmm current` | Show the active model / provider / profile |
| `ccmm models` | List configured models, profiles, and providers |
| `ccmm profile add\|edit\|rm` | Manage profiles |
| `ccmm provider add\|edit\|rm` | Manage providers (base URL + auth) |
| `ccmm price set <model> …` | Set per-model unit prices |
| `ccmm stats [today\|week\|session\|project]` | Usage & cost report |
| `ccmm statusline` | (internal) renders the Claude Code status line |
| `ccmm doctor` | Diagnose: proxy up? base URL set? auth present? |
| `ccmm mod install\|remove\|status` | **Experimental** native in-UI picker |

## Configuration

Everything lives in `~/.ccmm/config.json` (runtime route + metrics are stored alongside it). Example:

```jsonc
{
  "proxy":   { "host": "127.0.0.1", "port": 8787 },
  "defaultProfile": "smart",
  "profiles": {
    "fast":  { "model": "claude-haiku-3-5", "provider": "anthropic" },
    "smart": { "model": "claude-opus-4-1",  "provider": "anthropic" },
    "code":  { "model": "gpt-oss-120b",     "provider": "local" }
  },
  "providers": {
    "anthropic": { "baseUrl": "https://api.anthropic.com", "apiKeyEnv": "ANTHROPIC_API_KEY" },
    "relay":     { "baseUrl": "https://my-relay.example.com", "apiKeyEnv": "RELAY_KEY" },
    "local":     { "baseUrl": "http://127.0.0.1:1234/v1", "apiKeyEnv": "" }
  },
  "prices": {
    "claude-opus-4-1": { "input": 15, "output": 75, "cacheWrite": 18.75, "cacheRead": 1.5 }
  },
  "budget": { "dailyUsd": 20, "alert": true }
}
```

Prices are **USD per 1M tokens** by default. Because ccmm meters the *actual* model it forwarded to (not the name Claude Code thinks it sent), cost stays correct even when a relay remaps models.

## Status line

The status line reads live proxy metrics and renders one line, e.g.:

```
🧠 opus-4.1 · think:high · ▲12.4k ▼3.1k · cache 87% · $0.42 today · $19.58 left
```

Thinking tier, cache-hit %, and cost all come from the proxy's per-request `usage` records — the same fields Claude Code writes to its transcripts (`input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`), captured at the source.

## Experimental: native in-UI picker

The proxy + `!cccm use` covers ~90% of "switch models in the UI" with **zero** modification to Claude Code. For the last 10% — a real hotkey or models listed inside Claude Code's own `/model` menu — ccmm ships an **opt-in** patcher inspired by [tweakcc](https://github.com/Piebald-AI/tweakcc):

```bash
ccmm mod install    # patches the installed @anthropic-ai/claude-code bundle
```

> ⚠️ **Read before using.** This modifies a third-party, minified, frequently-updated bundle. It can break on any Claude Code release, is pinned to known-good versions, makes a backup before patching, and is **entirely at your own risk**. It may also fall outside Anthropic's terms of service. The rest of ccmm works perfectly without it.

## Roadmap

- **v0.1** — proxy core, CLI, profiles, providers, prices, status line, `stats`, plugin packaging
- **v0.2** — budgets/alerts in the status line, `doctor`, per-project model rules (`.ccmm.json`)
- **v0.3** — experimental `mod` (native picker/hotkey), usage history export (CSV/JSON)
- **later** — interactive TUI dashboard, model recommendations, Bedrock/Vertex providers

## Prior art & credits

ccmm stands on ideas proven by others — thank you:

- [tweakcc](https://github.com/Piebald-AI/tweakcc) — patching `cli.js` for custom models/themes (inspiration for the experimental mod)
- [claude-code-router](https://github.com/musistudio/claude-code-router) & [LiteLLM](https://github.com/BerriAI/litellm) — `ANTHROPIC_BASE_URL` routing proxies
- [How I built a hot-swappable backend proxy for Claude Code](https://hackernoon.com/how-i-built-a-hot-swappable-backend-proxy-for-claude-code)
- Anthropic's [LLM gateway docs](https://code.claude.com/docs/en/llm-gateway-connect)

ccmm's angle is bundling routing + metering + pricing + profiles + status line into **one** install-and-go tool.

## Disclaimer

ccmm is an independent, unofficial project — **not affiliated with or endorsed by Anthropic**. The experimental `mod` modifies third-party software; use it at your own risk and only where your terms of service allow it. API keys you configure are stored locally in `~/.ccmm/` and sent only to the providers you specify.

## License

MIT (see [LICENSE](./LICENSE)).
