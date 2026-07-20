# AGENTS.md

This file provides guidance to AI coding agents (Claude Code, Cursor, Copilot, etc.) when working in this repository.

## Project

**ccmm** — TypeScript CLI + localhost proxy for Claude Code model management. Live model switching, multi-provider routing, usage/cost metering.

## Key rules

- **Read docs/ARCHITECTURE.md first** — component boundaries and data flow.
- **i18n system** — all UI text in `src/i18n/index.ts` as flat key-value table. Always add both `zh-CN` and `en` entries.
- **No profile concept** — the old `Profile` type was removed. Only provider/方案 exists.
- **API keys: never hardcode.** Reference by env var name (`apiKeyEnv`).
- **Zod for validation.** Schemas in `src/schemas/`.
- **Tests required** for new features. Run `npm test`.

## Build & test

```bash
npm install && npm run build && npm test
```

## File map

```
src/index.ts           Entry point
src/schemas/           Zod schemas (config, state, metrics)
src/store/             File I/O for ~/.ccmm/
src/cli/               Commander commands (one per file)
src/proxy/             HTTP proxy (server, router, rewriter, usage-parser)
src/engine/            Cost computation
src/i18n/              Bilingual translation table (zh-CN + en)
src/providers/         Provider template registry
src/util/              Paths, env, formatting, autostart
test/                  Vitest tests
docs/                  Architecture documentation
```
