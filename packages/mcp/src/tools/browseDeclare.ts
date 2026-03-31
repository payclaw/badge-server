/**
 * Shared browse declaration helper — routes to declare (authenticated) or report (anonymous).
 *
 * When the agent has a kya_* badge token (enrolled), this fires a `declared` event
 * via /api/badge/declare — which feeds the scoring pipeline.
 *
 * When no badge token exists (pre-enrollment / guest), falls back to the anonymous
 * /api/badge/report endpoint with a `browse_declared` event for basic telemetry.
 *
 * Fire-and-forget: errors are logged to stderr but never propagated.
 */

import {
  getOrCreateInstallId,
  getEnvApiUrl,
  getCachedBadgeToken,
} from "@kyalabs/badge-sdk";
import { getAgentModel } from "../agent-model.js";

const DEFAULT_API_URL = "https://www.kyalabs.io";
const DECLARE_TIMEOUT_MS = 5_000;
const BADGE_VERSION = "2.5.0";
const AGENT_TYPE = "badge-mcp";

/** Infer shopping context from URL path. */
export function inferContext(url?: string): "arrival" | "addtocart" | "checkout" {
  if (!url) return "arrival";
  const lower = url.toLowerCase();
  if (lower.includes("/checkout") || lower.includes("/pay")) return "checkout";
  if (lower.includes("/cart") || lower.includes("/bag")) return "addtocart";
  return "arrival";
}

export interface DeclareOrReportParams {
  merchant: string | undefined;
  tripId: string;
  url?: string;
  /** Explicit badge token override — if not provided, looks up cached token for merchant. */
  badgeToken?: string;
}

/**
 * Fire a browse declaration event — authenticated declare or anonymous report.
 *
 * - If a kya_* badge token is available (agent is enrolled): POST /api/badge/declare
 *   with Bearer auth and {merchant, context, trip_id}.
 * - If no badge token (guest / pre-enrollment): POST /api/badge/report with the
 *   existing anonymous browse_declared payload.
 * - On declare failure, falls back to report (graceful degradation).
 *
 * Fire-and-forget with 5s timeout. Errors logged to stderr, never thrown.
 */
export async function fireDeclareOrReport(params: DeclareOrReportParams): Promise<void> {
  const { merchant, tripId, url } = params;
  const apiUrl = getEnvApiUrl() || DEFAULT_API_URL;

  // Resolve badge token: explicit param > cached for merchant > cached last-enrolled
  const badgeToken = params.badgeToken ?? getCachedBadgeToken(merchant ?? undefined) ?? undefined;

  if (badgeToken) {
    // Authenticated path — /api/badge/declare feeds the scoring pipeline
    const success = await fireDeclare(apiUrl, badgeToken, merchant, tripId, url);
    if (success) return;
    // Fall through to anonymous report on failure (graceful degradation)
    process.stderr.write("[badge] declare failed, falling back to anonymous report\n");
  }

  // Anonymous fallback — /api/badge/report
  await fireReport(apiUrl, merchant, tripId);
}

/** POST /api/badge/declare — authenticated, scoring pipeline. Returns true on success. */
async function fireDeclare(
  apiUrl: string,
  badgeToken: string,
  merchant: string | undefined,
  tripId: string,
  url?: string,
): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DECLARE_TIMEOUT_MS);
  try {
    const res = await fetch(`${apiUrl}/api/badge/declare`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${badgeToken}`,
      },
      body: JSON.stringify({
        merchant: merchant || undefined,
        context: inferContext(url),
        trip_id: tripId,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      process.stderr.write(`[badge] declare failed: HTTP ${res.status}\n`);
      return false;
    }
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[badge] declare failed: ${msg}\n`);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/** POST /api/badge/report — anonymous fallback telemetry. */
async function fireReport(
  apiUrl: string,
  merchant: string | undefined,
  tripId: string,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DECLARE_TIMEOUT_MS);
  try {
    const installId = getOrCreateInstallId();
    const res = await fetch(`${apiUrl}/api/badge/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        install_id: installId,
        badge_version: BADGE_VERSION,
        event_type: "browse_declared",
        merchant: merchant || undefined,
        agent_type: AGENT_TYPE,
        agent_model: getAgentModel(),
        trip_id: tripId,
        timestamp: Date.now(),
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      process.stderr.write(`[badge] browse_declared report failed: HTTP ${res.status}\n`);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    process.stderr.write(`[badge] browse_declared report failed: ${msg}\n`);
  } finally {
    clearTimeout(timer);
  }
}
