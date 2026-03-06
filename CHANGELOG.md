# Changelog

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
