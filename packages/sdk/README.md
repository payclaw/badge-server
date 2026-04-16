# @kyalabs/badge-sdk

Persistent identity for AI agents across merchant sites.

Agents that carry Badge build a behavioral trust score — kyaScore (500–850) — that improves merchant treatment over time. Higher-scored agents skip friction, get priority access, and convert more. Unbadged agents stay anonymous.

Framework-agnostic. No MCP dependency. Zero runtime dependencies.

[![npm](https://img.shields.io/npm/v/@kyalabs/badge-sdk)](https://www.npmjs.com/package/@kyalabs/badge-sdk)
[![license](https://img.shields.io/npm/l/@kyalabs/badge-sdk)](LICENSE)

## Install

```bash
npm install @kyalabs/badge-sdk
```

Requires Node.js >= 20.

## Quick Start

```typescript
import { Badge } from "@kyalabs/badge-sdk";

const badge = await Badge.init();
const runId = badge.startRun();

// Declare a visit at a merchant
await badge.declareVisit({
  merchant: "store.example.com",
  runId,
  url: "https://store.example.com/cart",
});

// Report what happened
await badge.reportOutcome({
  merchant: "store.example.com",
  runId,
  outcome: "not_denied",
});
```

No signup. No API key. `Badge.init()` issues a guest pass on first run and caches it to disk. Identity survives process restarts.

## Identity Model

Badge uses a three-tier identity ladder. Every agent starts at the bottom and can move up without user intervention.

```
guest pass (gp_v1_*)  →  badge token (kya_*)  →  authenticated identity
```

**Guest pass.** Issued automatically on `Badge.init()`. Anonymous, persistent, sufficient for visit tracking and score building. Cached to `~/.kya/`.

**Badge token.** Merchant-scoped credential issued on enrollment. This is what merchants verify. Persisted to `~/.kya/badge_tokens.json` — survives process restarts and same-day reruns.

**Authenticated identity.** Optional upgrade via RFC 8628 device authorization. Links the agent to a verified account. Not required for the core lifecycle.

### Two-Token Architecture

The SDK uses opaque `kya_*` tokens for enrollment and session management. These are the tokens agents carry and merchants verify at transaction time.

Separately, the verification layer issues ES256-signed JWTs for cryptographic proof. Merchants can verify these against published JWKS keys without calling the kya API. The two layers serve different purposes: `kya_*` tokens for session identity, JWTs for offline-verifiable proof.

### Identity Handoff

If you already hold a token from another kya surface (Radar cookie, MCP tool), pass it directly:

```typescript
const badge = await Badge.init({
  existingToken: "gp_v1_abc...", // or "kya_xyz..."
});
```

The SDK skips issuance and uses the handed-off credential for the session.

## API Reference

### `Badge.init(opts?)`

Create a Badge instance. Issues a guest pass on first run, reuses cache on subsequent runs.

```typescript
const badge = await Badge.init({
  installId: "custom-uuid",  // override auto-generated ID (for Docker/CI)
  platform: "node/v20.0.0",
  agentClient: "my-agent",
});
```

**Options:**

| Parameter | Type | Description |
|---|---|---|
| `installId` | `string?` | Override the auto-generated install ID. Use this in containerized environments where the filesystem is ephemeral. |
| `existingToken` | `string?` | Skip issuance — use a `gp_v1_*` or `kya_*` token from another surface. |
| `platform` | `string?` | Platform identifier for telemetry. |
| `agentClient` | `string?` | Agent client name. |

**Returns:** `Promise<Badge>`

### `badge.startRun()`

Generate a UUID to correlate declare and outcome events for a single agent trip.

```typescript
const runId = badge.startRun();
```

### `badge.declareVisit(args)`

Declare an agent visit at a merchant. Writes a `declared` event server-side.

```typescript
await badge.declareVisit({
  merchant: "store.example.com",
  runId,
  url: "https://store.example.com/checkout",
});
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `merchant` | `string` | Merchant domain. |
| `runId` | `string?` | Run ID from `startRun()`. Auto-generated if omitted. |
| `url` | `string?` | Current page URL. Used for context inference if `context` is not set. |
| `context` | `"arrival" \| "addtocart" \| "checkout"` | Visit stage. Inferred from URL if omitted (`/cart` → `addtocart`, `/checkout` → `checkout`, else `arrival`). |
| `source` | `"sdk" \| "mcp" \| "radar" \| "inferred"` | Event authorship. Defaults to `"sdk"`. |

**Returns:** `Promise<DeclareResult>`

```typescript
interface DeclareResult {
  recordedAs: "declared" | "reported" | "offline";
  source: "sdk" | "mcp" | "radar" | "inferred";
  merchant: string;
  runId: string;
  sessionToken?: string;
}
```

`recordedAs` tells you the recording confidence: `"declared"` means the server acknowledged it, `"offline"` means the network was unreachable and the call was a no-op.

### `badge.reportOutcome(args)`

Report the agent-observed outcome for a run. Triggers kyaScore recomputation server-side.

```typescript
await badge.reportOutcome({
  merchant: "store.example.com",
  runId,
  outcome: "not_denied",
  frictionReason: "bot_challenge", // optional
  detail: "CAPTCHA on checkout",   // optional
});
```

**Parameters:**

| Parameter | Type | Description |
|---|---|---|
| `merchant` | `string` | Merchant domain. |
| `runId` | `string` | Run ID from `startRun()`. |
| `outcome` | `"not_denied" \| "denied" \| "unparseable"` | What the agent observed. |
| `frictionReason` | `string?` | Why friction occurred. Free-text for now; structured categories (`"auth_required"`, `"bot_challenge"`, `"merchant_rejection"`) coming in a future release. |
| `detail` | `string?` | Free-text description. |
| `source` | `"sdk" \| "mcp" \| "radar" \| "inferred"` | Event authorship. Defaults to `"sdk"`. |

**Returns:** `Promise<OutcomeResult>`

```typescript
interface OutcomeResult {
  recordedAs: "declared" | "reported" | "offline";
  merchant: string;
  runId: string;
}
```

On success, `recordedAs` is `"reported"`. On network failure, `"offline"`. Note that `OutcomeResult` does not echo `source` back to the caller (unlike `DeclareResult`) — the source is persisted server-side.

This is the agent's point of view only. Merchant-side acceptance or denial is authored separately through the verification path.

### `badge.headers()`

Returns HTTP headers for identity injection into outgoing requests.

```typescript
const headers = badge.headers();
// { "Kya-Token": "gp_v1_abc..." }
```

### `badge.identityType`

Current identity tier: `"guest"` (API-issued guest pass), `"verified"` (device auth completed), or `"offline"` (API unreachable).

### `badge.token`

The raw credential string. `gp_v1_*` for guest passes, `kya_*` for enrolled badge tokens, `offline_*` for offline fallback.

### `badge.isGuest`

`true` if the identity is guest or offline. Useful for gating enrollment prompts.

### `badge.installId`

The persistent install ID (UUID). Stored at `~/.kya/install_id`.

### Enrollment

For agents with a consent key (`pk_live_*` or `pk_test_*`), enrollment upgrades a guest pass to a merchant-scoped badge token:

```typescript
import { enrollAndCacheBadgeToken } from "@kyalabs/badge-sdk";

const token = await enrollAndCacheBadgeToken("store.example.com");
// "kya_abc123..." or null
```

Returns the badge token on first enrollment per merchant per day, or `null` if no consent key is configured or enrollment fails. The SDK persists successful enrollments to `~/.kya/badge_tokens.json`, so reruns recover the token from cache.

```typescript
import { getCachedBadgeToken } from "@kyalabs/badge-sdk";

const cached = getCachedBadgeToken("store.example.com");
```

## Offline Behavior

Badge never throws on network failure. Every network call degrades to a deterministic fallback:

| Method | Online | Offline |
|---|---|---|
| `Badge.init()` | Issues guest pass from API | Returns `offline` identity with local-only token |
| `declareVisit()` | Writes event, returns `{recordedAs: "declared"}` | Returns `{recordedAs: "offline"}` |
| `reportOutcome()` | Writes event, returns `{recordedAs: "reported"}`, triggers score recompute | Returns `{recordedAs: "offline"}` |

`recordedAs` is client-facing data, not an internal quality signal. If you're building reports from Badge events, this is the confidence column.

## Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `KYA_API_URL` | API base URL | `https://www.kyalabs.io` |
| `KYA_API_KEY` | Consent key for enrollment (`pk_live_*` / `pk_test_*`) | — |
| `KYA_EXTENDED_AUTH` | Enable RFC 8628 device auth flow | `false` |
| `KYA_PING` | Server-start telemetry | `true` |

Legacy `PAYCLAW_*` prefixes are supported with a deprecation warning.

### Multi-Tenant Environments

For managed platforms running agents across multiple tenants on shared infrastructure, use the `installId` override to isolate identity per agent or per tenant:

```typescript
const badge = await Badge.init({
  installId: `${tenantId}-${agentId}`,
});
```

Structured multi-tenant binding (`agentId`, `tenantId`, `environment` as first-class parameters) ships in a future release. The `installId` override is the supported escape hatch until then.

## UCP Integration

Badge is a [UCP](https://universalcommerce.dev) Credential Provider under the `io.kyalabs.common.identity` namespace. It extends `dev.ucp.shopping.checkout` — agents that don't understand the Badge extension ignore it via `allOf` composition. Transactions proceed on baseline checkout.

### Published Artifacts

| Artifact | URL |
|---|---|
| Capability spec | [kyalabs.io/ucp/spec/identity](https://www.kyalabs.io/ucp/spec/identity) |
| JSON Schema | [kyalabs.io/ucp/schemas/identity.json](https://www.kyalabs.io/ucp/schemas/identity.json) |
| JWKS (public keys) | [kyalabs.io/.well-known/jwks.json](https://www.kyalabs.io/.well-known/jwks.json) |
| Platform profile | [kyalabs.io/.well-known/ucp](https://www.kyalabs.io/.well-known/ucp) |
| Reference repo | [github.com/kyalabs/ucp-agent-badge](https://github.com/kyalabs/ucp-agent-badge) |

### SDK Utilities

```typescript
import { fetchUCPManifest, findBadgeCapability } from "@kyalabs/badge-sdk";

const manifest = await fetchUCPManifest("store.example.com");
const cap = findBadgeCapability(manifest);

if (cap) {
  // Merchant supports Badge — proceed with enrollment
}
```

`fetchUCPManifest` fetches a merchant's `/.well-known/ucp` manifest with SSRF protection and TTL caching. `findBadgeCapability` extracts the `io.kyalabs.common.identity` entry if present.

### Protocol Compliance

- **OAuth 2.0.** RFC 8628 device authorization + RFC 7662 token introspection.
- **Verification tokens.** ES256-signed JWTs. Verifiable against published JWKS without calling the kya API.
- **Namespace.** `io.kyalabs.common.identity` — reverse-domain, DNS-sovereign.
- **Schema.** JSON Schema Draft 2020-12. `allOf` composition with `dev.ucp.shopping.checkout`. Spec URL Binding compliant.

## Architecture

### Event Model

Every lifecycle call writes to an append-only event log. Events are structured and typed:

- `declared` — agent arrived at a merchant
- `enrolled` — agent received a merchant-scoped badge token
- `sampling_complete` — agent reported an outcome
- `guest_pass_issued` — guest pass minted

Each event carries `source` (who authored it: `sdk`, `mcp`, `radar`, `inferred`) and recording confidence. Events are keyed by install ID, merchant, and run ID for full traceability.

### Scoring

`reportOutcome()` triggers score recomputation server-side. The score reflects visit history, outcome patterns, and cross-merchant behavior. It's portable — an agent that builds trust at one merchant carries that reputation everywhere.

Merchants query scores through the verify endpoint. Responses are tiered (basic, standard, premium) based on the merchant's access level.

### Security

- Badge tokens are stored as SHA-256 hashes server-side. The server never holds plaintext.
- Session tokens are single-use with a 15-minute TTL, burned on first verify.
- Badge tokens carry a rolling 30-day TTL, refreshed on each declare.
- Enrollment is atomic — no partial state on failure.
- UCP manifest fetching is SSRF-protected.

## Credential Storage

```
~/.kya/
  install_id          # persistent UUID
  guest_token         # cached guest pass
  badge_tokens.json   # merchant-scoped badge tokens (keyed by install_id:merchant)
```

Delete `~/.kya/` to reset all identity state.

## Data Practices

All identity is opt-in. No PII leaves the agent.

| Event | Data Sent | Configurable |
|---|---|---|
| Server start | Badge version, MCP client name | `KYA_PING=false` disables |
| `Badge.init()` | `install_id` (random UUID, generated locally) | `installId` override |
| Merchant visit | install_id, merchant domain, visit context, timestamp | — |
| Enrollment | Merchant-specific token hash | Requires consent key |

The `install_id` is a file on disk. Delete it to get a new one. Telemetry can be disabled entirely with `KYA_PING=false`; guest pass identity still works.

Full data practices: [kyalabs.io/trust](https://www.kyalabs.io/trust)

## What's Coming

- **Multi-tenant identity binding.** First-class `agentId`, `tenantId`, and `environment` parameters for managed platforms. Use the `installId` override until this ships.
- **Friction taxonomy.** Structured friction categories beyond free-text `frictionReason`.
- **Nudge system.** `shouldNudge()` currently returns `false`. Future versions will suggest identity upgrades based on trip count.

## Badge MCP Server

For MCP client users (Claude Desktop, Cursor, etc.), Badge also ships as an MCP server:

```bash
npx @kyalabs/badge
```

The MCP server uses this SDK internally. See [@kyalabs/badge](https://www.npmjs.com/package/@kyalabs/badge) for MCP-specific documentation.

## Status

Actively maintained by [kya labs](https://www.kyalabs.io). Badge is the core identity primitive across all kya products.

| | |
|---|---|
| **Release cadence** | Semver. Breaking changes only on major bumps. |
| **Tests** | CI on every PR |
| **Changelog** | [CHANGELOG.md](CHANGELOG.md) |

## License

MIT
