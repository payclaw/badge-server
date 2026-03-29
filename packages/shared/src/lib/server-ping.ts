/**
 * Anonymous server ping — Tier 1 telemetry.
 *
 * Fires once on MCP server startup after handshake completes.
 * No install_id, no persistent identifiers, no disk writes.
 * Opt-out: KYA_PING=false
 */

import { randomUUID } from "node:crypto";
import { getAgentModel } from "./agent-model.js";
import { getEnvApiUrl } from "./env.js";

const DEFAULT_API_URL = "https://www.kyalabs.io";
const PING_TIMEOUT_MS = 5_000;

/** Delay before sending ping — gives initAgentModel() time to read client handshake. */
const PING_DELAY_MS = 2_000;

/**
 * Fire an anonymous server_started ping. Call once after initAgentModel().
 *
 * - No await needed — fire-and-forget, never blocks startup
 * - No retry — one shot, errors swallowed silently
 * - No disk writes — session_id is in-memory only
 * - Opt-out: set KYA_PING=false in env
 * - Deferred 2s so agent_client is populated from MCP handshake
 */
export function fireServerPing(badgeVersion: string, serverType?: string): void {
  // Opt-out check
  if (process.env.KYA_PING === "false") return;
  // Don't ping during tests
  if (process.env.VITEST) return;

  const apiUrl = getEnvApiUrl() || DEFAULT_API_URL;
  const sessionId = randomUUID();

  setTimeout(() => {
    const payload = {
      event: "server_started",
      session_id: sessionId,
      badge_version: badgeVersion,
      agent_client: getAgentModel() ?? "unknown",
      server_type: serverType ?? null,
      platform: process.platform,
      timestamp: Date.now(),
    };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);

    fetch(`${apiUrl}/api/badge/ping`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(() => clearTimeout(timer))
      .catch(() => clearTimeout(timer));
    // Fire-and-forget. Failure is silent. No log, no retry.
  }, PING_DELAY_MS);
}
