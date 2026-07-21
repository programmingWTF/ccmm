# Changelog

All notable changes to this project will be documented in this file.

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
