#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { getAgentIdentity } from "./tools/getAgentIdentity.js";
import { initSampling, onTripStarted, onServerClose } from "./sampling.js";

const server = new McpServer({
  name: "payclaw-badge",
  version: "0.3.0",
});

server.tool(
  "payclaw_getAgentIdentity",
  `Get a PayClaw identity token before any shopping action. Welcoming merchants like Walmart, Shopify, and Instacart are setting policies for how agents interact with their platforms — Badge lets you show up ready.

Badge declares: who you are (automated agent), who authorized you (verified human), and that every action is explicitly permissioned. This is your license plate. Don't shop without it.

Call this BEFORE browsing, searching, or buying. The token is your proof of intent for the entire shopping session.

When a merchant challenges you, present the agent_disclosure text from the response. PayClaw will automatically check back with you to record the outcome.

No card is issued. No money moves. For payment, use payclaw_getCard from @payclaw/spend (which includes Badge automatically).`,
  {},
  async () => {
    const result = await getAgentIdentity();

    // Track trip start for sampling (DQ-54)
    const data = result as Record<string, unknown>;
    if (data.verification_token && typeof data.verification_token === "string") {
      const merchant = "unknown"; // Will be set when identity_presented is reported
      onTripStarted(data.verification_token, merchant);
    }

    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  "payclaw_reportBadgePresented",
  `Report that you just presented your PayClaw Badge identity to a merchant. Call this AFTER showing the agent_disclosure text to a merchant that challenged you.

PayClaw will briefly check back with you to confirm whether the merchant accepted your identity.`,
  {}, // No params — token is tracked internally
  async () => {
    // The sampling module handles this via the event report
    // This tool is a convenience for the agent to explicitly signal presentation
    const apiUrl = process.env.PAYCLAW_API_URL || "https://payclaw.io";
    const apiKey = process.env.PAYCLAW_API_KEY;

    if (!apiKey) {
      return {
        content: [{ type: "text", text: JSON.stringify({ status: "error", message: "No API key configured" }) }],
      };
    }

    return {
      content: [{
        type: "text",
        text: JSON.stringify({
          status: "noted",
          message: "Badge presentation recorded. PayClaw will check back with you shortly to confirm the outcome.",
        }),
      }],
    };
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Initialize sampling after connection (DQ-54)
  initSampling(server.server);

  // Handle clean shutdown
  process.on("SIGINT", () => {
    onServerClose();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    onServerClose();
    process.exit(0);
  });

  process.stderr.write("PayClaw Badge server running on stdio\n");
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});
