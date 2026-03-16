# Badge by kyaLabs

**Your agent isn't a bot. kyaLabs proves it.**

Your AI agent looks like a bot to every merchant on the internet. Badge gives it a way to declare what it is: an authorized actor, shopping on behalf of a real human, with explicit consent.

If you're like 20% of Americans last year - you used an agent to shop. And you probably ran into a ton of login walls, workarounds, bumps? 

So did we. So we created Badge - the first MCP tool that works with the new Universal Commerce Protocol to easily handshake verified agents at supporting merchants (Shopify, Target, Walmart, Etsy... it's a lot)

One MCP tool call. Your agent declares itself. Merchants let it through.

---

## Quick Start

Add to your MCP client config:

```bash
npx -y @kyalabs/badge-server
```

OR

```json
{
  "mcpServers": {
    "kyalabs-badge": {
      "command": "npx",
      "args": ["-y", "@kyalabs/badge"]
    }
  }
}
```

That's it. No API key. No signup. No network calls on install.

The first time your agent calls `kya_getAgentIdentity`, Badge activates — your agent declares itself to the merchant and gets back a response with instructions for the next step. One anonymous event is recorded: this install visited this merchant at this time.

### Upgrade to verified mode

For cryptographic identity (ES256-signed JWT, same curve as Apple Pay), add an API key:

```json
"env": {
  "KYA_API_KEY": "pk_live_your_key_here"
}
```

Get your API key at [kyalabs.io/signup](https://kyalabs.io/signup). API keys don't expire.

Without an API key, Badge uses device auth when a merchant requires verified identity — your agent shows a code and URL, you approve on your phone. This only happens when a merchant asks for it. We never ask for it ourselves. Sign up + API key means 1. you dont have to use phone OAuth every time and 2. you can track your agentic shopping (custom avatars included)

### Node version

Badge requires **Node.js 20 or newer**. Node 18 is end-of-life and unsupported.

If you see engine or compatibility errors: `node -v` — install Node 20+ from [nodejs.org](https://nodejs.org/) or `nvm install 20`.

---

## How Badge Works: Two Modes

### Declared (default)

First time your agent goes to a merchant with Badge, Badge generates an anonymous install ID — a random UUID stored locally at `~/.kya/install_id`. It has no connection to you, your device, or any personal information.

Your agent gets back a declaration and a `next_step` guiding it to report its badge presentation at the merchant.

This is the default mode. It's how Badge works out of the box, for every user, forever.

### Verified (when merchant requires it)

When a merchant requires verified identity — their UCP manifest says `required: true` — your agent will ask you to approve a device flow. You visit a merchant-kyaLabs URL, enter the OAuth code from your agent, and prove you're a real person.

Badge issues a tokenized credential: an ES256-signed JWT, signed by kya's private key, verifiable locally by the merchant. Your agent is free to continue - no login, PII or anything needed. 

---

## Our Data Philosophy

| When | What | Why |
|------|------|-----|
| **On install** | Nothing | We help agents shop. If they're not shopping, we don't need anything |
| **On first tool call** | install_id (random UUID), merchant, agent_type, event_type, timestamp | Minimum viable signal reduce agent friction at merchants and with labs |
| **On verified identity** | + hashed user token, intent scope (checkout, etc.) | Only required where login traditionally required (i.e. checkout) to prove there's a real person authorizing the agent's next step |

The install_id is a file we wrote to your disk. You can delete it (`rm ~/.kya/install_id`) and get a new one. 

Full data practices: [kyalabs.io/trust](https://kyalabs.io/trust)

---

## The Universal Commerce Protocol

Badge is a [UCP (Universal Commerce Protocol)](https://ucp.dev) Credential Provider. Merchants who declare the kyaLabs identity extension signal to every UCP-compliant agent that authorized agents are preferred at their store.

When your agent encounters a UCP merchant with Badge installed, it presents a cryptographic badge automatically — no extra steps.

We believe the UCP is the future of commerce and are proud to support reduce friction for agents and users. 

- Extension spec + schema: [github.com/kyalabs/ucp-agent-badge](https://github.com/kyalabs/ucp-agent-badge)
- Read more about the UCP: [github.com/universal-commerce-protocol/ucp](https://github.com/universal-commerce-protocol/ucp)

**Without Badge:** Your agent hits a merchant → bot detection fires → blocked. Task fails. Your user is disappointed. The merchant lost a sale and doesn't know it.

**With Badge:** Your agent calls `kya_getAgentIdentity` → declares itself → merchants see an authorized actor. Your agent gets through. Task succeeds.

---

## Tools

| Tool | Description |
|------|-------------|
| `kya_getAgentIdentity` | Declare identity, get verification token + `next_step` guidance |
| `kya_reportBadgePresented` | Signal that you presented your Badge to a merchant |
| `kya_reportBadgeOutcome` | Report whether merchant accepted or denied the badge |
| `kya_reportBadgeNotPresented` | Report that the badge was not presented |

Every tool call works immediately — no auth required. Events fire in both anonymous and verified modes.

### Extended Auth (optional)

When enabled, kyaLabs checks back with your agent 7 seconds after each badge presentation to confirm whether the merchant accepted or denied. Results are logged to your dashboard so you can see when and which merchants are rejecting your agent. 

```json
"env": {
  "KYA_EXTENDED_AUTH": "true"
}
```

---

## What's New (v2.0)

| Capability | Description |
|---|---|
| Anonymous-first | Badge works on install. No auth, no signup, no network on install. First `kya_getAgentIdentity` call fires `browse_declared` automatically. |
| Enrichment branching | Anonymous events fire without auth. Verified events include full user context. No silent gates. |
| `next_step` field | Every `kya_getAgentIdentity` response includes guidance for the agent's next action. |

---

## Need Payment Too?

Badge is the base layer. For virtual Visa cards, use [@kyalabs/mcp-server](https://www.npmjs.com/package/@kyalabs/mcp-server) — which includes Badge automatically.

```bash
npx -y @kyalabs/mcp-server
```

## KYA — Know Your Agent

kyaLabs is KYA infrastructure. Every declaration creates a verified record of agentic commerce behavior — building the trust signal that merchants need to tell authorized agents from anonymous bots.

## Links

- **Website:** [kyalabs.io](https://kyalabs.io)
- **npm:** [@kyalabs/badge](https://www.npmjs.com/package/@kyalabs/badge)
- **UCP Extension:** [github.com/kyalabs/ucp-agent-badge](https://github.com/kyalabs/ucp-agent-badge)
- **ClawHub:** [kyalabs-badge](https://clawhub.com/skills/kyalabs-badge)
- **Trust:** [kyalabs.io/trust](https://kyalabs.io/trust)
- **Merchants:** [kyalabs.io/merchants](https://kyalabs.io/merchants)
- **Contact:** agent_identity@kyalabs.io

---

*Agents are not bots. kyaLabs proves it.*
