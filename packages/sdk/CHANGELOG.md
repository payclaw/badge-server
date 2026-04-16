# Changelog

## 1.1.1 (2026-04-16)

### Fixed

- `reportOutcome()` now accepts optional `source` param (was hardcoded to `"sdk"` — MCP adapter and Radar wrappers could not self-identify as event authors). Defaults to `"sdk"` for backward compatibility.

## 1.1.0 (2026-04-16)

### Added

- **Lifecycle event authorship.** `badge.declareVisit()` and `badge.reportOutcome()` now send `source: "sdk"` in every request, enabling full traceability from event back to SDK install.
- **`declareVisit()`** — declare arrival, addtocart, or checkout at a merchant. Wraps `/api/badge/declare` with automatic context inference from URL when no explicit context is provided.
- **`reportOutcome()`** — report trip completion (`sampling_complete`). Wraps `/api/badge/report`. Triggers `compute_kyascore` server-side.
- **`startRun()`** — generate a UUIDv4 run ID for trip correlation across declare/report calls.
- **Context inference** (`inferContextFromUrl`) — `/cart/` maps to `addtocart`, `/checkout/` to `checkout`, else `arrival`.
- **Badge token persistence** — enrolled `kya_*` tokens persist to `~/.kya/badge_tokens.json` (keyed by `install_id:merchant`). Survives process restarts. Fixes silent second-run failure.
- **Deprecation warnings** on `reportBadgePresented` / `reportBadgeNotPresented` — one-shot console warn pointing to `declareVisit`.
- **Unified version constant** — all SDK paths share a single `BADGE_VERSION` from `version.ts`.
- **`demo.mjs`** and **`reset.mjs`** examples for A→B→A multi-merchant lifecycle.

### Fixed

- Badge token lost on process restart (in-memory-only cache replaced with file-backed persistence).
- False JSDoc advertising `badge.fetch()` which never existed (removed).
- `badge_version` drift across guest-pass and telemetry paths (unified to `version.ts`).

## 1.0.0 (2026-03-31)

Initial release. Identity primitive: guest-pass issuance, token caching, header injection.
