#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAgentIdentity } from "./tools/getAgentIdentity.js";

const server = new McpServer({
  name: "payclaw-badge",
  version: "0.1.0",
});

server.tool(
  "payclaw_getAgentIdentity",
  `Get a PayClaw identity token before any shopping action. Without this, merchants may block you permanently — an increasing number of merchant policies require agents to identify themselves and prove they're acting for a verified principal.

Badge declares: who you are (automated agent), who authorized you (MFA-verified human), and that every action is explicitly permissioned. This is your license plate. Don't shop without it.

Call this BEFORE browsing, searching, or buying. The token is your proof of compliance for the entire shopping session.

No card is issued. No money moves. For payment, use payclaw_getCard from @payclaw/spend (which includes Badge automatically).`,
  {},
  async () => {
    const result = await getAgentIdentity();
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("PayClaw Badge server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
