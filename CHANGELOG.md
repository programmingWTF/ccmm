# Changelog

All notable changes to this project will be documented in this file.

## [0.2.3] - 2026-07-21

### Added
- **`ccmm restart`** — one-command proxy restart (`ccmm restart`)
- Auto-restart proxy after `ccmm config` and `ccmm setup` save changes

### Changed
- Extracted shared `restartProxyDaemon()` helper (used by restart, config, setup)
- `ccmm config` no longer prints manual "run ccmm start" hint; restarts automatically

### Tests
- New: `restartProxyDaemon` unit tests (+4)
- Total: 118 tests

## [0.2.2] - 2026-07-21

### Changed
- Budget field renamed `dailyUsd` → `daily` (currency-agnostic, follows active currency)
- Budget display uses `$` or `¥` based on current `currency` setting
- Old `budget.dailyUsd` auto-migrates to `budget.daily` on config load
- i18n: removed hardcoded "USD" / "$" from budget prompts

### Tests
- New: `BudgetSchema` validation tests (+4)
- New: backward-compat test for old `dailyUsd` field (+1)
- Total: 114 tests

## [0.2.1] - 2026-07-21

### Added
- **Per-currency price isolation** — `pricesUSD` and `pricesCNY` stored independently
  - Switching currency loads the target currency's price config with a warning
  - Old `prices` field auto-migrates to `pricesUSD` on load
- CLI cancel support — type `q` at any price input prompt to abort (no more Ctrl+C only)

### Changed
- `ccmm update` no longer accepts `--force` (always checks npm registry directly)
- Price prompts now show the active currency symbol (`$` or `¥`)
- Docs updated: `pricesUSD`/`pricesCNY` in config examples, `currency` field explained

### Tests
- New: `getPrices` / `setPrices` / backward-compat tests (+6)
- Total: 109 tests

## [0.2.0] - 2026-07-21

### Added
- `ccmm update` command — check npm for new versions and install updates
- Auto-update notification on `ccmm start`, `ccmm config`, `ccmm setup` (24h cache, non-blocking)
- Currency setting (`"USD"` | `"CNY"`) — choose `$` or `¥` for cost display
  - Available in `ccmm setup` wizard and `ccmm config` editor
  - Applied to statusline, `ccmm stats`, and all cost output
- Bilingual CLI help for `-V/--version`, `-h/--help`, `help [command]`

### Changed
- README quickstart simplified: `ccmm setup` replaces `ccmm init` as the recommended first step
- README headings now include emoji markers
- `docs/ARCHITECTURE.md` updated: removed legacy `profiles` concept, added `setup`/`config`/`update` commands
- `CONTRIBUTING.md` updated: test count, bilingual help convention

### Tests
- New: `test/update-check.test.ts` — 8 tests for semver comparison
- New: `formatCost` / `currencySymbol` tests (+6)
- New: `ConfigSchema.currency` validation tests (+4)
- Total: 103 tests

## [0.1.7] - 2026-07-21

### Added
- Initial release with update check infrastructure
- 5-slot model mapping, live switching, cost metering, statusline
- Interactive setup wizard and config editor
- Provider management, pricing, budget alerts
- Bilingual UI (zh-CN / en)
