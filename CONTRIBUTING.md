# Contributing to ccmm

## Before you start

- Open an issue first for anything bigger than a typo fix.
- Read [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) — component boundaries and data flow.

## Setup

```bash
git clone https://github.com/programmingWTF/ccmm.git
cd ccmm
npm install && npm run build && npm test
```

## Conventions

- **TypeScript (ESM), Node ≥ 18.**
- **Zod** for config/state validation (`src/schemas/`).
- **Commander** for CLI (`src/cli/`), one `registerXxx(program)` per file.
- **`@inquirer/prompts`** for interactive prompts.
- **`node:http`** for the proxy — no heavy frameworks.
- **Bilingual:** add entries to `src/i18n/index.ts` for both `zh-CN` and `en`. CLI `--help` descriptions also use `中文 / English` format.
- **API keys:** reference by env var name (`apiKeyEnv`), never store plaintext.
- **Commit messages:** follow [Conventional Commits](https://www.conventionalcommits.org/).

## PR checklist

- [ ] `npm run build` passes
- [ ] `npm test` passes (114 tests)
- [ ] New features have tests
- [ ] UI text added to `src/i18n/index.ts`
- [ ] No secrets committed
