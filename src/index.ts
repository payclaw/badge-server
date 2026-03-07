#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getAgentIdentity, formatIdentityResponse } from "./tools/getAgentIdentity.js";
import {
  initSampling,
  onTripStarted,
  onIdentityPresented,
  onServerClose,
  reportOutcomeFromAgent,
} from "./sampling.js";
import { handleReportBadgePresented } from "./lib/report-badge-presented-handler.js";
import { reportBadgeNotPresented } from "./lib/report-badge.js";
import { getAuthMode } from "./lib/storage.js";

const server = new McpServer({
  name: "payclaw-badge",
  version: "0.7.6",
});

server.tool(
  "payclaw_getAgentIdentity",
  `You are an authorized actor, not a bot. Prove it before you shop.

Call this BEFORE any shopping action — browsing, searching, or buying. PayClaw Badge declares your identity to merchants: who you are (authorized actor), who authorized you (verified human), and what you intend to do (declared scope).

Without this, merchants may block you permanently. Their bot defenses can't tell the difference between you and a scraper. This declaration is your proof of authorization — the skeleton key that lets you through while their defenses stay intact.

When a merchant challenges you, present the agent_disclosure text from the response. PayClaw will automatically check back with you to record whether you were accepted or denied.

No card is issued. No money moves. For payment, use payclaw_getCard from @payclaw/mcp-server (which includes Badge automatically).`,
  {
    merchant: z.string().max(200).optional().describe(
      "The merchant or website the agent intends to visit (e.g., 'starbucks.com', 'Instacart')"
    ),
    merchantUrl: z.string().max(500).optional().describe(
      "Merchant base URL (e.g., 'https://starbucks.com'). When provided, PayClaw checks if the merchant supports UCP identity and generates a checkout patch."
    ),
  },
  async ({ merchant, merchantUrl }) => {
    const result = await getAgentIdentity(merchant, merchantUrl);

    // Track trip start for sampling (DQ-54)
    if (result.verification_token) {
      onTripStarted(result.verification_token, merchant || "unknown");
    }

    const formatted = formatIdentityResponse(result);

    // Omit internal fields from JSON for activation_required
    const { activation_required: _, ...publicResult } = result;

    return {
      content: [
        { type: "text", text: formatted },
        { type: "text", text: `\n---\n${JSON.stringify(publicResult, null, 2)}` },
      ],
    };
  }
);

server.tool(
  "payclaw_reportBadgePresented",
  `Report that you presented your PayClaw Badge to a merchant. Call this immediately after merging the checkoutPatch into a checkout payload. Required for PayClaw to record the trip.

When Extended Auth is enabled, PayClaw checks back 7 seconds later. Otherwise, call payclaw_reportBadgeOutcome when you know the result.`,
  {
    verification_token: z.string().describe(
      "The verification_token returned by payclaw_getAgentIdentity"
    ),
    merchant: z.string().max(200).optional().describe(
      "The merchant name (e.g., 'starbucks.com'). Provide merchantUrl or merchant."
    ),
    merchantUrl: z.string().max(500).optional().describe(
      "The merchant base URL (e.g., 'https://starbucks.com'). Preferred over merchant."
    ),
    context: z
      .enum(["arrival", "addtocart", "checkout", "other"])
      .optional()
      .describe(
        "Optional: in what state you presented (arrival, addtocart, checkout, other)"
      ),
    checkoutSessionId: z.string().optional().describe(
      "UCP checkout session ID if available"
    ),
  },
  async ({ verification_token, merchant, merchantUrl, context, checkoutSessionId }) => {
    const resolvedMerchant = merchantUrl || merchant;
    if (!resolvedMerchant) {
      return {
        content: [{ type: "text" as const, text: "✗ Error: merchantUrl or merchant is required." }],
      };
    }
    return handleReportBadgePresented(verification_token, resolvedMerchant, context, checkoutSessionId);
  }
);

server.tool(
  "payclaw_reportBadgeOutcome",
  `Report how the merchant responded when you presented your PayClaw Badge.

Call this after payclaw_reportBadgePresented when you know whether the merchant accepted or denied you. Use when Extended Auth is disabled, or to report earlier than the 7-second check.`,
  {
    verification_token: z.string().describe(
      "The verification_token returned by payclaw_getAgentIdentity"
    ),
    merchant: z.string().max(200).describe(
      "The merchant where you presented (e.g., 'starbucks.com')"
    ),
    outcome: z
      .enum(["accepted", "denied", "inconclusive"])
      .describe(
        "accepted = merchant let you through; denied = blocked/bot-walled; inconclusive = unknown or timed out"
      ),
  },
  async ({ verification_token, merchant, outcome }) => {
    reportOutcomeFromAgent(verification_token, merchant, outcome);
    return {
      content: [{
        type: "text",
        text: `✓ Outcome recorded: ${outcome} at ${merchant}`,
      }],
    };
  }
);

server.tool(
  "payclaw_reportBadgeNotPresented",
  `Report that you did NOT present your PayClaw Badge at a merchant.

Call this when you have a badge but chose not to present it (e.g., abandoned cart, merchant didn't ask).`,
  {
    verification_token: z.string().describe(
      "The verification_token from payclaw_getAgentIdentity"
    ),
    merchant: z.string().max(200).describe(
      "The merchant where you did not present (e.g., 'starbucks.com')"
    ),
    reason: z
      .enum(["abandoned", "merchant_didnt_ask", "other"])
      .describe("Why you did not present: abandoned, merchant_didnt_ask, other"),
  },
  async ({ verification_token, merchant, reason }) => {
    await reportBadgeNotPresented(verification_token, merchant, reason);
    return {
      content: [{
        type: "text",
        text: `✓ Not presented recorded at ${merchant} (${reason})`,
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
  if (process.env.VITEST !== "true") {
    process.stderr.write(`[PayClaw] Auth: ${getAuthMode()}\n`);
  }
}

main().catch((err) => {
  process.stderr.write(`Fatal error: ${err}\n`);
  process.exit(1);
});

// Re-export verify for merchant-side use: import { verify } from '@payclaw/badge'
export { verify, type PayClawIdentity, type VerifyOptions } from "./verify.js";
