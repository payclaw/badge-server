/**
 * Badge-server API client — thin wrapper over shared infrastructure.
 * Adds the getAgentIdentity() endpoint function specific to badge-server.
 */

import type { AgentIdentityResponse } from "@kyalabs/shared-identity";
import {
  BadgeApiError,
  getConfig,
  authHeaders,
  request,
  isApiMode,
  getBaseUrl,
  introspectBadgeToken,
  getAgentIdentityWithToken,
  type IntrospectResult,
} from "@kyalabs/shared-identity";

// Re-export shared infra for existing consumers
export {
  BadgeApiError,
  getConfig,
  authHeaders,
  request,
  isApiMode,
  getBaseUrl,
  introspectBadgeToken,
  getAgentIdentityWithToken,
};
export type { IntrospectResult };

/** Badge-specific endpoint: POST /api/agent-identity with stored consent key. */
export async function getAgentIdentity(
  sessionId?: string,
  merchant?: string,
  tripId?: string
): Promise<AgentIdentityResponse> {
  const { baseUrl, apiKey } = getConfig();
  return request<AgentIdentityResponse>(`${baseUrl}/api/agent-identity`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      session_id: sessionId,
      ...(merchant ? { merchant } : {}),
      ...(tripId ? { trip_id: tripId } : {}),
    }),
  });
}
