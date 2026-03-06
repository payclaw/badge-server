# Changelog

## [0.7.2] - 2026-03-06

### Fixed
- **F1**: README Quick Start config pointed to `api.payclaw.io` (does not exist); corrected to `payclaw.io`
- **F2**: `server.json` marked `PAYCLAW_API_KEY` as required, blocking device-flow onboarding; changed to optional
- **F2**: Added missing `PAYCLAW_EXTENDED_AUTH` env var to `server.json`
- **F2**: Aligned `PAYCLAW_API_KEY` description with mcp-server (mentions device flow)
- **F3**: Synced version strings across `package.json`, `server.json`, and `index.ts` (were inconsistent: 0.7.0/0.7.1)

### Refs
- MCPDuro_Mar6 Tier 1 hotfixes
