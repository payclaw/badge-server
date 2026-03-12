# Changelog

## [0.9.0] - 2026-03-11 — Verify Migration

### Removed
- `verify()` export — moved to [ucp-agent-badge/reference/](https://github.com/payclaw/ucp-agent-badge/tree/main/reference) as a reference implementation
- `./verify` sub-path export from package.json
- `verify.ts` and `verify.test.ts` (now at github.com/payclaw/ucp-agent-badge/reference/)

### Changed
- README: agent-developer only; merchant verification content moved to ucp-agent-badge
- Package is now 100% agent-facing — MCP tools only

## [0.8.0] - 2026-03-07 — PRD-2 + PRD-3: Verify Export + UCP-Aware Identity

### Added (PRD-2)
- `verify()` export from `@payclaw/badge/verify` — merchant-side JWT verification using JWKS + ES256
- `PayClawIdentity` and `VerifyOptions` type exports
- JWKS key caching (1h TTL, configurable) with per-kid CryptoKey map
- 16 test cases covering: valid/expired/tampered tokens, unknown kid, cache TTL, network errors, clock tolerance
- Zero runtime dependencies

### Added (PRD-3)
- `merchantUrl` parameter on `getAgentIdentity` — fetches merchant's `/.well-known/ucp` manifest and checks for `io.payclaw.common.identity` capability
- `checkoutPatch` in identity response — agent merges into checkout payload when merchant supports UCP
- `ucpCapable`, `requiredByMerchant`, `ucpWarning` fields on identity result
- `merchantUrl` parameter on `reportBadgePresented` (preferred over `merchant`)
- `checkoutSessionId` parameter on `reportBadgePresented` for UCP checkout session tracking
- `ucp-manifest.ts` — SSRF-protected manifest fetcher with per-domain caching (5 min TTL), HTTPS enforcement, private IP blocking
- 12 test cases for manifest fetcher: caching, normalization, error handling, capability parsing, version compatibility

### Changed
- `reportBadgePresented` now requires `merchantUrl` or `merchant` (validates at least one provided)
- `reportBadgePresented` returns `{ recorded: true }` JSON in first content block for machine parsing
- Canonical header updated to `Synced: PRD-3` on `getAgentIdentity.ts`

### Refs
- PRD-2: Verify Export (2026-03-07)
- PRD-3: UCP-Aware Identity (2026-03-07)

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

## [0.7.3] - 2026-03-06 — Tiers 2 & 3: Auth Flow Fixes + Code Sync

### Added
- **F5**: Auth mode startup logging — stderr shows which auth mode is active on launch (API key, consent key, or none)
- **F13**: `pendingActivation` dedup guard — concurrent `getAgentIdentity` calls reuse the same device flow instead of spawning duplicates (synced from mcp-server)
- **F9**: `SYNC.md` documenting canonical file ownership between badge-server and mcp-server
- **F9**: Canonical ownership header comments on all shared source files

### Fixed
- **F8**: `isApiMode()` now returns `true` when a stored consent key exists (device-flow users no longer fall to mock/local mode)
- **F10**: `device-auth.ts` now uses `fetchWithTimeout` (10s AbortController timeout) — prevents indefinite hangs on network issues
- **F11**: `device-auth.ts` `getBaseUrl()` validates HTTPS (or localhost) — blocks sending OAuth tokens over HTTP in production
- **F12**: `device-auth.ts` sanitizes `interval` and `expires_in` from server response — prevents tight spin loops on malformed data
- **F14**: `setInterval` in `sampling.ts` now guarded by `VITEST` check — prevents timer leaks in tests

### Refs
- MCPDuro_Mar6 Tiers 2 & 3

## [0.7.2] - 2026-03-06

### Fixed
- **F1**: README Quick Start config pointed to `api.payclaw.io` (does not exist); corrected to `payclaw.io`
- **F2**: `server.json` marked `PAYCLAW_API_KEY` as required, blocking device-flow onboarding; changed to optional
- **F2**: Added missing `PAYCLAW_EXTENDED_AUTH` env var to `server.json`
- **F2**: Aligned `PAYCLAW_API_KEY` description with mcp-server (mentions device flow)
- **F3**: Synced version strings across `package.json`, `server.json`, and `index.ts` (were inconsistent: 0.7.0/0.7.1)

### Refs
- MCPDuro_Mar6 Tier 1 hotfixes
