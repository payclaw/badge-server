/** Shared identity response shape — used by both badge-server and mcp-server. */
export interface AgentIdentityResponse {
  agent_disclosure: string;
  verification_token: string;
  trust_url: string;
  contact: string;
  principal_verified: boolean;
  mfa_confirmed?: boolean;
}
