# Badge by PayClaw

**Agents are not bots. Prove it.**

Your AI agent looks like a bot to every merchant on the internet. Badge gives it a way to declare what it is: an authorized actor, shopping on behalf of a real human, with explicit consent.

One MCP tool call. Your agent declares itself. Merchants let it through.

---

## Quick Start

Add to your MCP client config:

```json
{
  "mcpServers": {
    "payclaw-badge": {
      "command": "npx",
      "args": ["-y", "@payclaw/badge"],
      "env": {
        "PAYCLAW_API_KEY": "pk_live_your_key_here",
        "PAYCLAW_API_URL": "https://www.payclaw.io"
      }
    }
  }
}
```

Get your API key at [payclaw.io/dashboard/keys](https://www.payclaw.io/dashboard/keys). API keys don't expire.

### Try without an account

Omit `PAYCLAW_API_KEY` — on first use, your agent will show a verification code and URL. Approve on your phone to get a temporary session. When you're ready for a permanent setup, create an account and generate an API key.

### Node version

Badge requires **Node.js 20 or newer**. Node 18 is end-of-life and unsupported.

If you see engine or compatibility errors: `node -v` — install Node 20+ from [nodejs.org](https://nodejs.org/) or `nvm install 20`.

## UCP Identity Linking

Badge is a [UCP (Universal Commerce Protocol)](https://ucp.dev) Credential Provider. Merchants who declare the PayClaw identity extension signal to every UCP-compliant agent that authorized agents are preferred at their store.

When your agent encounters a UCP merchant with PayClaw installed, it presents a cryptographic badge automatically — no extra steps.

- Extension spec + schema: [github.com/payclaw/ucp-agent-badge](https://github.com/payclaw/ucp-agent-badge)
- Merchant verification: [github.com/payclaw/ucp-agent-badge/reference](https://github.com/payclaw/ucp-agent-badge/tree/main/reference)
- Merchant documentation: [payclaw.io/merchants](https://payclaw.io/merchants)

## Why Your Agent Needs This

Your agent is smart. It can browse, compare prices, build carts, find deals. But to every merchant on the internet, it looks identical to a scraper.

Merchants don't ask "is this agent helpful?" They ask "is this a bot?" And they block first, ask never.

**Without Badge:** Your agent hits a merchant → bot detection fires → blocked. Task fails. Your user is disappointed. The merchant lost a sale and doesn't know it.

**With Badge:** Your agent calls `payclaw_getAgentIdentity` → receives a verification token → presents it to the merchant. The merchant sees: authorized actor, verified human behind it, declared intent. Your agent gets through. Task succeeds.

## What Badge Declares

Every time your agent calls `payclaw_getAgentIdentity`, it receives a UCP-compatible credential that declares:

- **Agent type:** Authorized actor (not a bot, not a scraper)
- **Principal:** Verified human behind this session (Google or Apple SSO)
- **Assurance level:** `starter` / `regular` / `veteran` / `elite` based on verified trip history
- **Contact:** `agent_identity@payclaw.io` for merchant verification

The agent presents this disclosure to merchants. Merchants see a verified identity, not anonymous traffic.

## How It Works

### First use (device auth)

```
1. Your agent calls payclaw_getAgentIdentity
2. No key? Device auth flow triggers — code + URL appear in terminal
3. You approve on your phone (Google or Apple, one tap)
4. Consent Key stored — agent is authorized
5. Every subsequent call uses the stored key automatically
```

### UCP-aware identity (with merchantUrl)

```
1. Agent calls payclaw_getAgentIdentity({ merchantUrl: 'https://store.com' })
2. PayClaw fetches store.com/.well-known/ucp manifest
3. If merchant declares io.payclaw.common.identity → returns checkoutPatch
4. Agent merges checkoutPatch into checkout payload
5. Agent calls payclaw_reportBadgePresented({ merchantUrl, verification_token })
6. Merchant verifies token locally (see UCP extension spec for verification)
```

If the merchant doesn't support UCP, a valid token is still returned — nothing breaks. No card is issued. No money moves. Badge is the identity layer — the credential that lets authorized agents through while bot defenses stay intact.

### Extended Auth (optional)

When enabled, PayClaw checks back with your agent 7 seconds after badge presentation to confirm whether the merchant accepted or denied. Results are logged to your dashboard.

```json
"env": {
  "PAYCLAW_API_URL": "https://payclaw.io",
  "PAYCLAW_EXTENDED_AUTH": "true"
}
```

Without it, your agent reports outcomes via `payclaw_reportBadgeOutcome` when it knows the result.

## Tools

| Tool | Description |
|------|-------------|
| `payclaw_getAgentIdentity` | Declare identity, get UCP-compatible verification token |
| `payclaw_reportBadgePresented` | Signal that you presented your Badge to a merchant |
| `payclaw_reportBadgeOutcome` | Report whether merchant accepted or denied the badge |
| `payclaw_reportBadgeNotPresented` | Report that the badge was not presented |

## What's New (v0.9.0)

| Capability | Description |
|---|---|
| Verify migration | Merchant-side JWT verification has moved to the [UCP extension spec](https://github.com/payclaw/ucp-agent-badge/tree/main/reference) as a reference implementation. It is no longer exported from this package. |
| UCP-aware `getAgentIdentity` | Pass `merchantUrl` — fetches merchant manifest, returns `checkoutPatch` when `io.payclaw.common.identity` is declared |
| `reportBadgePresented` with `merchantUrl` | Preferred over `merchant`; includes optional `checkoutSessionId` for UCP session tracking |
| SSRF-protected manifest fetcher | HTTPS-only, private IP blocking, 5-minute domain cache |
| Trip lifecycle hardening | `onServerClose` resolves as `inconclusive`; orphan token recovery on restart |

---

## Need Payment Too?

Badge is the base layer. For virtual Visa cards, use [@payclaw/mcp-server](https://www.npmjs.com/package/@payclaw/mcp-server) — which includes Badge automatically.

```bash
npx -y @payclaw/mcp-server
```

## KYA — Know Your Agent

PayClaw is KYA infrastructure. Every declaration creates a verified record of agentic commerce behavior — building the trust signal that merchants need to tell authorized agents from anonymous bots.

- [Trust & Verification](https://payclaw.io/trust) — The full trust architecture
- [For Merchants](https://payclaw.io/merchants) — How merchant UCP integration works
- [UCP Extension Spec](https://github.com/payclaw/ucp-agent-badge) — `io.payclaw.common.identity` (MIT)

## Links

- **Website:** [payclaw.io](https://payclaw.io)
- **npm:** [@payclaw/badge](https://www.npmjs.com/package/@payclaw/badge)
- **UCP Extension:** [github.com/payclaw/ucp-agent-badge](https://github.com/payclaw/ucp-agent-badge)
- **ClawHub:** [payclaw-badge](https://clawhub.com/skills/payclaw-badge)
- **Trust:** [payclaw.io/trust](https://payclaw.io/trust)
- **Merchants:** [payclaw.io/merchants](https://payclaw.io/merchants)
- **Contact:** agent_identity@payclaw.io

---

*Agents are not bots. PayClaw proves it.*
