# Changelog

## [0.7.6] - 2026-03-06 — Tier 6: Stress Test Readiness

### Added
- **F23**: Multi-merchant trip lifecycle tests — verifies `agent_moved_to_new_merchant` resolution, three-merchant chains, merchant fallback search, direct API POST for orphaned tokens, and `onServerClose` behavior
- **F23**: `resetSamplingState` and `getActiveTrip` test helpers exported from `sampling.ts`
- **F24**: Operational logging in `reapStaleTrips()` — logs active trip count and per-trip reap events with truncated token and merchant

### Refs
- MCPDuro_Mar6 Tier 6

## [0.7.5] - 2026-03-06 — Tier 5: Dependency Alignment

### Changed
- **F20**: Zod range widened from `^4.3.6` to `^3.24.0 || ^4.0.0` — matches mcp-server, improves npm deduplication for Zod 3.x consumers
- **F21**: MCP SDK minimum pinned from `^1.0.0` to `^1.27.1` — ensures required protocol features are present

### Refs
- MCPDuro_Mar6 Tier 5

## [0.7.4] - 2026-03-06 — Tier 4: Data Quality & UX

### Fixed
- **F15**: `onServerClose` now resolves trips as `"inconclusive"` instead of `"accepted"` — server disconnect is not proof of merchant acceptance
- **F16**: `spend_cta` no longer says "wallet" — points to `@payclaw/mcp-server` docs instead
- **F19**: README now lists all 4 tools (`reportBadgeOutcome`, `reportBadgeNotPresented` were missing)

### Refs
- MCPDuro_Mar6 Tier 4

## [0.7.3] - 2026-03-06 — Tier 3: Code Sync

### Added
- **F9**: `SYNC.md` documenting canonical file ownership between badge-server and mcp-server
- **F9**: Canonical ownership header comments on all shared source files

### Fixed
- **F14**: `setInterval` in `sampling.ts` now guarded by `VITEST` check — prevents timer leaks in tests

### Refs
- MCPDuro_Mar6 Tier 3

## [Unreleased] - Tier 2: Auth Flow Fixes

### Added
- **F5**: Auth mode startup logging — stderr shows which auth mode is active on launch (API key, consent key, or none)

### Fixed
- **F8**: `isApiMode()` now returns `true` when a stored consent key exists (device-flow users no longer fall to mock/local mode)

### Refs
- MCPDuro_Mar6 Tier 2

## [0.7.2] - 2026-03-06

### Fixed
- **F1**: README Quick Start config pointed to `api.payclaw.io` (does not exist); corrected to `payclaw.io`
- **F2**: `server.json` marked `PAYCLAW_API_KEY` as required, blocking device-flow onboarding; changed to optional
- **F2**: Added missing `PAYCLAW_EXTENDED_AUTH` env var to `server.json`
- **F2**: Aligned `PAYCLAW_API_KEY` description with mcp-server (mentions device flow)
- **F3**: Synced version strings across `package.json`, `server.json`, and `index.ts` (were inconsistent: 0.7.0/0.7.1)

### Refs
- MCPDuro_Mar6 Tier 1 hotfixes
