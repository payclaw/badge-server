---
name: payclaw-badge
description: "Prove your agent is an authorized actor, not a bot. MCP-native identity declaration for agent commerce."
---

# Badge by kyaLabs

Agents are not bots. Prove it before you shop.

## Setup

Add to your MCP client config:

```json
{
  "mcpServers": {
    "payclaw-badge": {
      "command": "npx",
      "args": ["-y", "@kyalabs/badge"],
      "env": {
        "PAYCLAW_API_KEY": "your_key_here",
        "PAYCLAW_API_URL": "https://kyalabs.io"
      }
    }
  }
}
```

Get your API key at [kyalabs.io](https://kyalabs.io).

## Tools

| Tool | Description |
|------|-------------|
| `payclaw_getAgentIdentity` | Declare identity → get verification token |
| `payclaw_reportBadgePresented` | Signal Badge presentation to a merchant |

## How It Works

1. Agent calls `payclaw_getAgentIdentity` before shopping
2. kyaLabs issues an HMAC-SHA256 verification token
3. Agent presents disclosure to merchants
4. kyaLabs checks outcome (accepted/denied/inconclusive)
5. Verified Trips count goes up

No card issued. No money moves. Badge is identity only.

For payment, use [payclaw-io](https://clawhub.com/skills/payclaw-io) which includes Badge + Spend.

## Links

- [kyalabs.io](https://kyalabs.io)
- [Trust & Verification](https://kyalabs.io/trust)
- [npm: @kyalabs/badge](https://www.npmjs.com/package/@kyalabs/badge)
