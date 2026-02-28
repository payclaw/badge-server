import * as api from "../api/client.js";

export async function getAgentIdentity(): Promise<object> {
  if (!process.env.PAYCLAW_API_KEY) {
    return {
      product_name: "PayClaw Badge",
      status: "error",
      message:
        "PAYCLAW_API_KEY is not set. Get your key at payclaw.io/dashboard/settings",
    };
  }

  if (!api.isApiMode()) {
    // Mock mode — return sandbox identity for local testing
    return {
      product_name: "PayClaw Badge",
      status: "active",
      agent_disclosure:
        "This session is operated by an AI agent under PayClaw Agentic Intent. The agent acts on behalf of a verified, MFA-authenticated principal. Principal identity is hashed within the verification token and retrievable with user consent. Design inspired by agent policies of Amazon, Shopify, and others.",
      verification_token: "pc_v1_sandbox_mock_token",
      trust_url: "https://payclaw.io/trust",
      contact: "agent_identity@payclaw.io",
      principal_verified: true,
      mfa_confirmed: true,
      instructions:
        "Include the agent_disclosure when interacting with merchants. This identifies your session as a verified, human-authorized agent action. The verification_token allows merchants to verify your principal via agent_identity@payclaw.io.",
    };
  }

  try {
    const result = await api.getAgentIdentity();
    return {
      product_name: "PayClaw Badge",
      status: "active",
      ...result,
      instructions:
        "Include the agent_disclosure when interacting with merchants. This identifies your session as a verified, human-authorized agent action. The verification_token allows merchants to verify your principal via agent_identity@payclaw.io.",
    };
  } catch (err) {
    return {
      product_name: "PayClaw Badge",
      status: "error",
      message: err instanceof Error ? err.message : String(err),
    };
  }
}
