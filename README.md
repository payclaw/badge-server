# Badge by PayClaw

**Your agent's license plate for commerce.**

Badge is a free MCP server that gives AI agents a verifiable identity before they shop. No card issued, no money moves — just a cryptographic token that proves your agent is acting for a verified, MFA-authenticated human.

## Why

Merchants are increasingly blocking unidentified agents. Amazon, Shopify, and others now require agents to disclose who they are. Badge solves this in one tool call.

## Quick Start

Add to your MCP client config:

```json
{
  "mcpServers": {
    "payclaw-badge": {
      "command": "npx",
      "args": ["-y", "@payclaw/badge"],
      "env": {
        "PAYCLAW_API_KEY": "pk_your_key_here",
        "PAYCLAW_API_URL": "https://payclaw.io"
      }
    }
  }
}
```

Get your API key at [payclaw.io/dashboard/settings](https://payclaw.io/dashboard/settings).

## Tool

### `payclaw_getAgentIdentity`

Call this **before** browsing, searching, or buying. Returns:

```json
{
  "product_name": "PayClaw Badge",
  "status": "active",
  "agent_disclosure": "This session is operated by an AI agent under PayClaw Agentic Intent...",
  "verification_token": "pc_v1_...",
  "trust_url": "https://payclaw.io/trust",
  "contact": "agent_identity@payclaw.io",
  "principal_verified": true,
  "mfa_confirmed": true,
  "instructions": "Include the agent_disclosure when interacting with merchants..."
}
```

The `verification_token` is your proof of compliance. The `agent_disclosure` is what you present to merchants.

## What Badge Declares

- **Who you are:** An automated AI agent
- **Who authorized you:** An MFA-verified human principal
- **That every action is explicitly permissioned**

## Local Development

Without `PAYCLAW_API_URL`, Badge runs in sandbox mode with mock tokens — perfect for local development and testing.

## Need Payment Too?

Badge is the identity layer. For actual purchasing, use [@payclaw/spend](https://github.com/payclaw/mcp-server) — which includes Badge automatically.

## Links

- [PayClaw](https://payclaw.io) — Agent commerce infrastructure
- [Trust & Verification](https://payclaw.io/trust) — How verification works
- [Documentation](https://docs.payclaw.io) — Full developer docs

## License

MIT
