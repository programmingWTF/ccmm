# ccmm Architecture

Design document for **ccmm — Claude Code Model Manager**. Target audience: contributors and future maintainers. For user-facing docs see [README.md](../README.md).

---

## 1. Goals & non-goals

**Goals**
- Switch the active model **live, mid-session**, without restarting Claude Code and without requiring any modification to it.
- Show accurate **usage / cache-hit / cost** in Claude Code's status line, priced by a user-configurable table (so it stays correct behind relays).
- Route different models to different **providers** (Anthropic, relays/proxies, local).
- Install-and-go: one `npm i -g @pgwtf/ccmm && ccmm setup`.

**Non-goals (v1)**
- Translating between wire protocols (OpenAI-compatible ↔ Anthropic). v1 speaks the **Anthropic Messages protocol** only (Anthropic + relays that speak it). Translation is a later milestone.
- Bedrock / Vertex providers (later).
- Cracking or bypassing Claude Code auth. Subscription (OAuth) users get a reduced, non-proxy path (see §11).

## 2. High-level architecture

```
                          ┌───────────────────────────── ccmm ─────────────────────────────┐
                          │                                                                 │
 Claude Code ──HTTP/SSE──▶│  Proxy (node:http) ──▶ Router ──▶ Rewriter ──▶ Upstream client │──▶ provider
   ▲                      │                                    │                            │
   │ status line          │                                    ▼                            │
   └── ccmm statusline ◀──│  Metrics store ◀── Usage parser ◀──┘                            │
                          │       │                                                         │
                          │       ▼            Config store (~/.ccmm/config.json)           │
                          │  ~/.ccmm/metrics.jsonl   Route state (~/.ccmm/state.json)       │
                          │                                                                 │
                          │  CLI (commander)  ── reads/writes config+state, controls proxy  │
                          │  Plugin (MCP server + statusLine registration)                  │
                          │  Mod layer (experimental, opt-in cli.js patcher)                │
                          └─────────────────────────────────────────────────────────────────┘
```

The **proxy is the single choke point**: every request Claude Code makes flows through it, so routing and metering share one code path and one source of truth.

## 3. Components

| Component | Responsibility | Deps |
|---|---|---|
| **Proxy server** | Accept Claude Code requests, route/rewrite, forward, stream back, capture usage | `node:http` (no heavy framework) |
| **Router** | Resolve the active route (profile → provider + effective model); hot-reloadable | config + state stores |
| **Rewriter** | Set `body.model` to the effective model; set upstream auth header | provider config |
| **Usage parser** | Extract token usage from the streamed response (final SSE events) | — |
| **Metrics store** | Append per-request records; serve in-memory aggregates for the status line | `metrics.jsonl` |
| **Cost engine** | Apply the price table to a usage record → USD | price config |
| **Config store** | Load/validate/save `config.json`; watch for changes | `zod` |
| **Route state** | Persist the active route; the proxy watches it for hot-reload | `state.json` |
| **CLI** | `commander` commands that operate on the above | `commander`, `@inquirer/prompts`, `picocolors` |
| **Status line** | Read stdin JSON + metrics, print one line (fast, <300ms) | metrics store |
| **Plugin** | Register status line + expose an MCP server with switch/stats tools | Claude Code plugin manifest |
| **Mod layer** | Experimental `cli.js` patcher for a native picker/hotkey | — |

## 4. Request lifecycle

1. Claude Code issues `POST /v1/messages` to `http://127.0.0.1:<port>` (because `ANTHROPIC_BASE_URL` points there).
2. Proxy buffers the JSON body; records `requestedModel = body.model`.
3. **Router** resolves the active route from `state.json` (kept in memory, refreshed on file change) → `{ provider, effectiveModel }`.
4. **Rewriter** sets `body.model = effectiveModel` and replaces the auth header with the provider's key (read from the env var named in `providers[*].apiKeyEnv`).
5. Upstream client forwards to `providers[provider].baseUrl + /v1/messages`, **streaming SSE** back to Claude Code unchanged.
6. **Usage parser** reads the usage block from the stream (the `message_start`/`message_delta` events carry `usage` incl. `cache_read_input_tokens` / `cache_creation_input_tokens`).
7. **Cost engine** prices it; a record is appended to `metrics.jsonl` and folded into in-memory aggregates (session / today).
8. Response bytes pass through untouched — Claude Code never knows the model was swapped.

**Non-`/v1/messages` paths** (e.g. `count_tokens`, health) are passed through as-is. The small/fast background model (if a provider distinguishes it) is routed via a separate `smallFastModel` config key.

## 5. Model switching

Three layers, most-robust first:

1. **Live switch via proxy (primary).** `ccmm use <profile|model>` writes `state.json`. The proxy watches the file (via `fs.watch`) and reloads the route immediately. The **next** request uses the new model — no restart, mid-session. Inside Claude Code, the same CLI is invoked with the bang escape: `!ccmm use fast`.
2. **MCP tool (in-agent).** The plugin's MCP server exposes `ccmm_switch(profile)`; the user can simply say "switch to fast" and the tool performs the same write.
3. **Settings fallback (no proxy / OAuth subscription).** Write `model` into Claude Code's `settings.json`; the change applies on next launch or via the built-in `/model`. This is the only path for Pro/Max OAuth users (§11).

Hot-reload is file-watch based (not signals) because Windows lacks `SIGHUP`; this also keeps CLI→proxy coordination dependency-free.

## 6. Cost engine & cache math

Per completed request we capture a usage record. Formulas:

```
cacheHitRate = cacheRead / (cacheRead + cacheWrite + input)

costUsd = (input      * price.input
         + output     * price.output
         + cacheRead  * price.cacheRead
         + cacheWrite * price.cacheWrite) / 1_000_000
```

Prices are stored **per currency** (`pricesUSD` / `pricesCNY`) as **per 1M tokens**. The active `currency` field (`"USD"` | `"CNY"`) determines which table is used. Because metering happens at the proxy on the *effective* model, cost is correct even when the requested and effective models differ. If the proxy isn't running, the status line can degrade to parsing Claude Code's transcript JSONL (`~/.claude/projects/**/*.jsonl`), which carries the same usage fields.

## 7. Data storage & schemas

All under `~/.ccmm/`. Timestamps are **ISO 8601 UTC** (`YYYY-MM-DDTHH:mm:ss.sssZ`).

### `config.json` (user-editable)
```jsonc
{
  "proxy":   { "host": "127.0.0.1", "port": 8787 },
  "defaultProvider": "deepseek",
  "language": "zh-CN",
  "smallFastModel": { "model": "claude-haiku-4-5-20251001", "provider": "anthropic" },
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
    },
    "anthropic": { "baseUrl": "https://api.anthropic.com", "apiKeyEnv": "ANTHROPIC_API_KEY", "wire": "anthropic" }
  },
  "pricesUSD": {
    "deepseek-v4-pro": { "input": 2.0, "output": 8.0, "cacheRead": 0.2, "cacheWrite": 3.0 }
  },
  "pricesCNY": {},
  "budget": { "daily": 20, "alert": true }
}
```
Validated with a `zod` schema on load; invalid config → clear error + non-zero exit.

### `state.json` (runtime, written by CLI, watched by proxy)
```jsonc
{
  "activeProvider": "deepseek",
  "model": "deepseek-v4-pro",
  "updatedAt": "2026-07-20T12:34:56.000Z"
}
```

### `metrics.jsonl` (append-only, one JSON object per line)
```jsonc
{
  "ts": "2026-07-20T12:35:01.123Z",
  "sessionId": "9f2c…",
  "project": "ccmm",
  "provider": "anthropic",
  "requestedModel": "claude-sonnet-4-5",
  "effectiveModel": "claude-opus-4-1",
  "inputTokens": 120,
  "outputTokens": 340,
  "cacheReadTokens": 9800,
  "cacheWriteTokens": 1500,
  "costUsd": 0.0312,
  "status": 200,
  "latencyMs": 2100
}
```
Aggregates (session/today) are computed in memory at proxy start by scanning `metrics.jsonl`, then updated per request. The file is periodically compacted/rotated (v0.2).

## 8. CLI command spec (summary)

See README for the user table. Internally each command is a thin function over the stores:

- `setup` — interactive wizard: language, providers, 5-slot model map, budget, auto-start, sync settings.json. Supersedes `init`.
- `init` — idempotent quick-start: write default config, register `env.ANTHROPIC_BASE_URL`/`AUTH_TOKEN` + `statusLine` in Claude Code `settings.json` (backup first).
- `config` — interactive menu-driven editor for all settings.
- `use <name>` — resolve provider → write `state.json`.
- `start`/`stop`/`restart` — spawn/terminate/restart the daemon; write `~/.ccmm/proxy.pid`. `config` and `setup` auto-restart the proxy after saving.
- `stats <range>` — read `metrics.jsonl`, group by model/provider/day, print a table.
- `statusline` — read stdin (Claude Code) + metrics, print one line, exit fast.
- `doctor` — check: proxy reachable? base URL set? auth env present? version compatible?
- `update` — check npm registry for new version, optionally install via `npm install -g`.

## 9. Status line protocol

Claude Code invokes the configured `statusLine` command and pipes a JSON object on **stdin**. Fields ccmm relies on (verify against the installed version at build time — observed on 2.1.215):

- `model` `{ id, display_name }`
- `session_id`
- `workspace` `{ current_dir }`
- `transcript_path`
- `cost` `{ total_cost_usd, total_duration_ms, total_lines_added, total_lines_removed }`

ccmm prefers its **own** metrics (effective model + real prices) and falls back to `transcript_path`/`cost` when the proxy isn't running. Render example:

```
🧠 opus-4.1 · think:high · ▲12.4k ▼3.1k · cache 87% · $0.42 today · $19.58 left
```

Latency budget: < 300 ms. Read aggregates from a small cached summary file the proxy maintains, not by re-scanning `metrics.jsonl` on every render.

## 10. Provider abstraction

```ts
type Provider = {
  baseUrl: string;          // e.g. https://api.anthropic.com
  apiKeyEnv?: string;       // env var holding the key (never store the key in config)
  wire: "anthropic";        // v1: anthropic protocol only
  modelMap?: Record<string, string>; // optional rename before sending upstream
};
```

Keys are referenced **by env var name**, not stored, to avoid leaking secrets into config/backups. `modelMap` lets a relay expose one name while the upstream expects another.

## 11. Auth & subscription caveats

- **API key / relay token** (the common case for this tool): clean. The proxy injects the key and forwards.
- **Claude Pro/Max subscription (OAuth login):** the OAuth grant is bound to Anthropic's endpoints; routing it through a third-party base URL is unreliable/unsupported. These users get the **settings-fallback** path (§5.3): ccmm manages `settings.json` model + `/model`, no proxy metering. Document this clearly; do not attempt to proxy subscription OAuth in v1.

## 12. Plugin packaging

Ship as a Claude Code plugin so `init` (or plugin install) can:
- register the `statusLine` command, and
- run a small **MCP server** exposing tools: `ccmm_current`, `ccmm_switch`, `ccmm_profiles`, `ccmm_stats`.

This lets users switch by natural language ("use the fast model") without typing the bang command. A `/ccmm` slash command is also provided as a help entry.

## 13. Experimental mod layer (opt-in)

Inspired by [tweakcc](https://github.com/Piebald-AI/tweakcc), which patches the installed `cli.js`.

- `mod install`: locate the Claude Code install (`npm root -g` → `@anthropic-ai/claude-code/cli.js`, or the native install), **check the version against a supported set**, back up `cli.js` → `cli.js.ccmm-backup`, apply string-anchor patches (inject model entries into the picker / bind a hotkey), write a marker file.
- `mod remove`: restore the backup.
- `mod status`: report patched/clean + version compatibility.

**Hard rules:** version-pinned (refuse on mismatch), always back up, fully reversible, and isolated so the rest of ccmm works when the mod is absent or broken. **Risks:** breaks on Claude Code updates; may violate Anthropic ToS; can brick the CLI if an anchor moves. Surface all of this in `mod install` before proceeding.

## 14. Tech stack

| Concern | Choice | Why |
|---|---|---|
| Language | TypeScript (ESM), Node ≥ 18 | Global `fetch`, `fs.watch`, matches Claude Code's runtime |
| CLI | `commander` | Mature, low ceremony |
| Interactive prompts | `@inquirer/prompts` | Selectors for profiles/models |
| Colors | `picocolors` | Tiny |
| Config validation | `zod` | Schema + nice errors |
| HTTP proxy | `node:http` | Zero-dep streaming passthrough |
| Build | `tsup` | Single-file `dist/cli.js` for the `bin` |
| Test | `vitest` | Fast, ESM-native |

Keep runtime dependencies minimal — this runs on everyone's machine as a daemon.

## 15. Testing strategy

- **Unit:** cost engine, cache-hit formula, config load/validation, router resolution, model rewrite, usage parsing from a canned SSE stream.
- **Integration:** spin up a fake upstream HTTP server + the proxy; assert (a) `model` is rewritten, (b) usage is captured, (c) SSE passes through byte-for-byte, (d) hot-reload changes routing on the next request.
- **Snapshot:** status line output for fixed metrics.

## 16. Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Claude Code changes status line stdin shape | Status line breaks | Verify at build; degrade to transcript; version checks |
| Relay doesn't speak pure Anthropic protocol | Routing fails for that provider | `doctor` probes; document supported providers |
| Daemon on Windows (no SIGHUP) | Reload/stop misbehave | File-watch reload + pidfile + `taskkill` on stop |
| Bundle patch breaks on update (mod) | CLI bricked | Version pin + backup + auto-refuse + reversible |
| ToS concerns (mod) | Account risk | Opt-in, loud warnings, everything works without it |
| Secret leakage | Key exposure | Keys via env var name only; never in config/metrics |

## 17. Open questions

- npm package name `ccmm` availability — fall back to a scoped name if taken.
- Exact status line JSON keys per Claude Code version (lock them when implementing §9).
- Whether to ship a launcher wrapper (`ccmm run claude`) that sets env for a single invocation instead of editing global settings.
- Metrics rotation/compaction policy (v0.2).
- Scope of OpenAI-compatible wire translation (post-v1).
