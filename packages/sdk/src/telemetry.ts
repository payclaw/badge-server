/**
 * POST badge events to /api/badge/report.
 * v2.0: Enrichment branching — anonymous payload if no key, enriched if key.
 * v2.1: trip_id propagation — links all events in a shopping session.
 */

import { getStoredConsentKey, getOrCreateInstallId } from "./storage.js";
import { getEnvApiUrl } from "./env.js";

const DEFAULT_API_URL = "https://www.kyalabs.io";
const BADGE_VERSION = "2.4";

/** Agent type for telemetry payloads. Set via configureReportBadge(). */
let agentType = "badge-mcp";
/** Agent model resolver — evaluated lazily at event time so MCP handshake has completed. */
let agentModelResolver: (() => string | undefined) | undefined;

/**
 * Configure the agent_type and optional agent_model for telemetry payloads.
 * agentModel accepts a string OR a getter function (for lazy evaluation after MCP handshake).
 * Call once at startup: configureReportBadge({ agentType: "badge-mcp", agentModel: () => getAgentModel() })
 */
export function configureReportBadge(opts: { agentType: string; agentModel?: string | (() => string | undefined) }): void {
  agentType = opts.agentType;
  if (opts.agentModel !== undefined) {
    agentModelResolver = typeof opts.agentModel === "function" ? opts.agentModel : () => opts.agentModel as string;
  }
}

export async function reportBadgePresented(
  verificationToken: string,
  merchant: string,
  context?: "arrival" | "addtocart" | "checkout" | "other",
  checkoutSessionId?: string,
  tripId?: string
): Promise<void> {
  const apiUrl = getEnvApiUrl() || DEFAULT_API_URL;
  const key = getStoredConsentKey();
  const installId = getOrCreateInstallId();

  try {
    if (key) {
      // Enriched payload: full auth, user-linked, includes install_id
      const res = await fetch(`${apiUrl}/api/badge/report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verification_token: verificationToken,
          event_type: "identity_presented",
          merchant,
          install_id: installId,
          ...(context && { presentation_context: context }),
          ...(checkoutSessionId && { checkout_session_id: checkoutSessionId }),
          ...(tripId && { trip_id: tripId }),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        process.stderr.write(
          `[BADGE] reportBadgePresented failed (${res.status}): ${body}\n`
        );
      }
    } else {
      // Anonymous payload: no auth header, install_id only
      const res = await fetch(`${apiUrl}/api/badge/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          install_id: installId,
          badge_version: BADGE_VERSION,
          event_type: "identity_presented",
          merchant,
          agent_type: agentType,
          agent_model: agentModelResolver?.(),
          timestamp: Date.now(),
          ...(context && { presentation_context: context }),
          ...(tripId && { trip_id: tripId }),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        process.stderr.write(
          `[BADGE] anonymous reportBadgePresented failed (${res.status}): ${body}\n`
        );
      }
    }
  } catch (err) {
    // [EC-1] Fire-and-forget but never silent — log all failures
    process.stderr.write(
      `[BADGE] reportBadgePresented error: ${err instanceof Error ? err.message : err}\n`
    );
  }
}

export async function reportBadgeNotPresented(
  verificationToken: string,
  merchant: string,
  reason: "abandoned" | "merchant_didnt_ask" | "other",
  tripId?: string
): Promise<void> {
  const apiUrl = getEnvApiUrl() || DEFAULT_API_URL;
  const key = getStoredConsentKey();
  const installId = getOrCreateInstallId();

  try {
    if (key) {
      // Enriched payload: full auth, user-linked, includes install_id
      const res = await fetch(`${apiUrl}/api/badge/report`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          verification_token: verificationToken,
          event_type: "badge_not_presented",
          merchant,
          reason,
          install_id: installId,
          ...(tripId && { trip_id: tripId }),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        process.stderr.write(
          `[BADGE] reportBadgeNotPresented failed (${res.status}): ${body}\n`
        );
      }
    } else {
      // Anonymous payload: no auth header, install_id only
      const res = await fetch(`${apiUrl}/api/badge/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          install_id: installId,
          badge_version: BADGE_VERSION,
          event_type: "badge_not_presented",
          merchant,
          reason,
          agent_type: agentType,
          agent_model: agentModelResolver?.(),
          timestamp: Date.now(),
          ...(tripId && { trip_id: tripId }),
        }),
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        process.stderr.write(
          `[BADGE] anonymous reportBadgeNotPresented failed (${res.status}): ${body}\n`
        );
      }
    }
  } catch (err) {
    // [EC-1] Fire-and-forget but never silent
    process.stderr.write(
      `[BADGE] reportBadgeNotPresented error: ${err instanceof Error ? err.message : err}\n`
    );
  }
}
