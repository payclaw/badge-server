# @kyalabs/badge-sdk

Persistent identity for AI agents across merchant sites. Agents that carry Badge build a behavioral trust score (kyaScore, 500–850) that improves merchant routing over time.

Framework-agnostic. No MCP dependency. Zero-config.

[![npm](https://img.shields.io/npm/v/@kyalabs/badge-sdk)](https://www.npmjs.com/package/@kyalabs/badge-sdk)
[![license](https://img.shields.io/npm/l/@kyalabs/badge-sdk)](LICENSE)

## Install

```bash
npm install @kyalabs/badge-sdk
```

Requires Node.js >= 20.

## Quick Start

```typescript
import { Badge } from '@kyalabs/badge-sdk'

const badge = await Badge.init()
const runId = badge.startRun()

// Attach to outgoing requests
const headers = badge.headers()
// { "Kya-Token": "gp_v1_..." }

await badge.declareVisit({
  merchant: 'merchant.test',
  runId,
  url: 'https://merchant.test/cart',
})

await badge.reportOutcome({
  merchant: 'merchant.test',
  runId,
  outcome: 'not_denied',
})

// Identity state
badge.identityType  // "guest" | "verified" | "offline"
badge.isGuest       // true for guest/offline
badge.installId     // persistent UUID

badge.destroy()
```

No signup. No API key. `Badge.init()` works immediately.

## Why Badge

**Today:** Agents carrying Badge get tracked across merchant sites via [MCP sampling](https://modelcontextprotocol.io/docs/concepts/sampling). Platforms integrating Badge can surface agentic behavior insights to enterprise clients for free — which agents visited, how far they got, where they dropped off.

**Tomorrow:** As agents accumulate interactions, kyaScore builds. Merchants running VerifAi route based on score — higher-scored agents skip friction, get priority access, convert more. Unbadged agents stay anonymous and keep hitting walls.

## How It Works

`Badge.init()` issues a guest pass from the kya API on first run. The token and install ID are cached to `~/.kya/` and persist across process restarts.

Agents carry identity in the `Kya-Token` HTTP header on outgoing requests. Guest passes upgrade to merchant-specific badge tokens through enrollment. Every merchant interaction feeds kyaScore.

Integrated at the platform level. Every agent session inherits identity automatically.

### Identity Lifecycle

```
Badge.init()  →  guest pass (gp_v1_*)  →  enroll at merchant  →  badge token (kya_*)
                      ↑                         ↑
                 cached in ~/.kya/       requires consent key (pk_*)
```

## Configuration

| Environment Variable | Description | Default |
|---------------------|-------------|---------|
| `KYA_API_URL` | API base URL | `https://www.kyalabs.io` |
| `KYA_API_KEY` | Consent key for enrollment (`pk_live_*` / `pk_test_*`) | — |
| `KYA_EXTENDED_AUTH` | Enable device auth flow (`true` / `1`) | `false` |
| `KYA_PING` | Telemetry ping on server start (`true` / `false`) | `true` |

Legacy `PAYCLAW_*` prefixes are supported with a deprecation warning.

## API

### `Badge.init(opts?)`

Create a Badge instance. Issues a guest pass on first run, reuses cache on subsequent runs.

```typescript
const badge = await Badge.init({
  installId: 'custom-uuid',    // override auto-generated ID (for Docker/CI)
  platform: 'node/v20.0.0',   // platform string
  agentClient: 'my-agent',    // agent identifier
})
```

### `badge.headers()`

Returns HTTP headers for identity injection:

```typescript
badge.headers()
// { "Kya-Token": "gp_v1_abc..." }
```

### `badge.startRun()`

Returns a UUID you can use to pair declaration and outcome events.

### `badge.declareVisit(args)`

Declare an agent visit at a merchant and write a `declared` badge event.

```typescript
const runId = badge.startRun()

await badge.declareVisit({
  merchant: 'merchant.test',
  runId,
  url: 'https://merchant.test/cart',
  // or context: 'arrival' | 'addtocart' | 'checkout'
  // source: 'sdk' | 'mcp' | 'radar' | 'inferred' (default: 'sdk')
})
```

If `context` is omitted, the SDK infers it from the URL (`/cart` → `addtocart`, `/checkout` → `checkout`, otherwise `arrival`).

### `badge.reportOutcome(args)`

Report the agent-observed outcome for a previously declared run. This writes `sampling_complete` through the existing anonymous report path so kyaScore recompute still triggers for the install ID.

```typescript
await badge.reportOutcome({
  merchant: 'merchant.test',
  runId,
  outcome: 'not_denied', // or 'denied' | 'unparseable'
  frictionReason: 'merchant_rejection', // optional
  detail: 'CAPTCHA challenge on checkout', // optional free-text
})
```

This is the agent point-of-view outcome only. Merchant-side canonical acceptance or denial is authored separately by the verification/middleware path.

### `badge.identityType`

Current identity tier: `"guest"` (API-issued guest pass), `"verified"` (device auth completed), or `"offline"` (API unreachable, local-only).

### `badge.shouldNudge()`

Whether the agent should be prompted to upgrade identity. Returns `false` in v1.

### `enrollAndCacheBadgeToken(merchant)`

Enroll at a merchant and receive a `kya_*` badge token. Requires `KYA_API_KEY`.

```typescript
import { enrollAndCacheBadgeToken } from '@kyalabs/badge-sdk'

const token = await enrollAndCacheBadgeToken('store.example.com')
// "kya_abc123..."
```

**Important:** The badge token is only returned on the first enrollment per merchant per day. The SDK now persists successful enrollments to `~/.kya/badge_tokens.json`, so same-day reruns can recover the merchant token without another API response.

### `issueGuestPass(installId, platform?, agentClient?, badgeVersion?)`

Low-level guest pass issuance. Returns `null` on failure (caller falls back to offline).

### `getCachedBadgeToken(merchant?)`

Retrieve a cached badge token. If no merchant specified, returns the most recently enrolled token.

## Data

All identity is opt-in. No PII leaves the agent.

| Event | Data Sent | Why | Default | Configurable |
|---|---|---|---|---|
| **Server start** | Badge version, MCP client name (random session ID, not stored) | Uptime monitoring, version distribution | Auto | `KYA_PING=false` disables |
| **`Badge.init()`** | `install_id` (random UUID, generated and stored locally) | Persistent identity across sessions | Auto | `installId` override in opts |
| **First merchant visit** | `install_id`, merchant domain, agent type, timestamp | Minimum signal for merchant insights | Auto | — |
| **Enrollment** (user-initiated) | Merchant-specific token hash | Per-merchant trust building | Only on user approval | Requires `KYA_API_KEY` |

The `install_id` is a file on disk (`~/.kya/install_id`). Delete it and get a new one.

Telemetry can be disabled entirely: `KYA_PING=false`. Guest pass identity still works.

Full data practices: [kyalabs.io/trust](https://kyalabs.io/trust)

## Credential Storage

```
~/.kya/
  install_id      # persistent UUID
  guest_token     # cached guest pass { token, expiresAt }
  badge_tokens.json  # cached merchant badge tokens keyed by install_id:merchant
```

## Status

Actively maintained by [kya labs](https://kyalabs.io). Badge is the core identity primitive across all kya products.

| | |
|---|---|
| **Current version** | See npm badge above |
| **Release cadence** | Semver. Breaking changes only on major bumps. |
| **Tests** | CI on every PR |
| **Changelog** | [CHANGELOG.md](CHANGELOG.md) |

## Badge MCP Server

For MCP client users (Claude Desktop, Cursor, etc.), Badge also ships as an MCP server with tools for identity, web fetch, and header injection:

```bash
npx @kyalabs/badge
```

The MCP server uses this SDK internally. See [@kyalabs/badge](https://www.npmjs.com/package/@kyalabs/badge) for MCP-specific docs.

## License

MIT
