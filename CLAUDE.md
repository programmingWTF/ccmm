# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**ccmm — Claude Code Model Manager.** A TypeScript CLI + localhost proxy that lets users switch Claude Code's active model **mid-session**, route requests to configurable providers, and show live usage / cache-hit / real cost in Claude Code's status line, priced by user-defined unit prices.

## Status

Pre-release. Design docs exist (`README.md`, `docs/ARCHITECTURE.md`); **v1 code is not written yet**. When scaffolding code, follow `docs/ARCHITECTURE.md` exactly — components, data schemas, and tech stack are settled there.

## Intended commands (once code exists)

```bash
npm install
npm run build          # tsup → dist/cli.js (bin: ccmm)
npm run dev            # watch build
npm test               # vitest
npx vitest run test/cost.test.ts -t "cache hit"   # single test
npm run lint
npm link               # try the CLI locally as `ccmm`
```

## Architecture (big picture)

- **The proxy is the core choke point.** Claude Code → (`ANTHROPIC_BASE_URL`) → ccmm proxy → provider. The proxy rewrites `body.model` to the active route and captures `usage` from the streamed response for pricing. Routing and metering share this one code path.
- **State lives in `~/.ccmm/`**: `config.json` (user-editable: profiles, providers, prices, budget), `state.json` (active route — hot-reloaded by the proxy via `fs.watch`), `metrics.jsonl` (append-only per-request records).
- **Switching is live**: `ccmm use <profile|model>` writes `state.json` → the *next* request uses the new model, mid-session, no restart. Inside Claude Code: `!ccmm use fast`. OAuth/subscription users get a `settings.json` fallback only (§5.3 / §11 of ARCHITECTURE.md).
- **Status line** (`ccmm statusline`): reads Claude Code's stdin JSON + a cached metrics summary; must render in **< 300 ms**. Prefers proxy metrics; degrades to parsing `~/.claude/projects/**/*.jsonl` transcripts.
- **Plugin**: registers the statusLine + an MCP server (`ccmm_switch`, `ccmm_current`, `ccmm_stats`, `ccmm_profiles`).
- **Experimental `ccmm mod`**: patches the installed Claude Code `cli.js` (tweakcc-inspired). Opt-in, version-pinned, backs up before patching, fully reversible — **high risk; don't work on it unless explicitly asked**.

## Conventions

- TypeScript (ESM), Node ≥ 18. Keep runtime dependencies minimal — the proxy is a daemon running on user machines.
- **Never store API keys in config files** — reference them by env-var name (`apiKeyEnv`).
- Timestamps are ISO 8601 UTC. Prices are USD per 1M tokens.
- v1 wire protocol: **Anthropic Messages only** (Anthropic + relays speaking it). No OpenAI-compatible translation yet.
- `.remember/` is Claude tooling state (session logs), git-ignored — not project code; never import or document it as such.

## Caveats

- The experimental mod may fall outside Anthropic's ToS — always keep it opt-in with loud warnings; **everything must work without it**.
- Cost must be computed from the **effective** (forwarded) model + user prices, never from Claude Code's own cost number (it's wrong behind relays).
- Windows is a first-class platform (author develops on it): no `SIGHUP` — use file-watch reload + pidfile.
