/**
 * Detect the agent model (MCP client) running this server.
 *
 * Detection order:
 * 1. MCP client info from protocol handshake (clientInfo.name)
 * 2. KYA_AGENT_MODEL env var (explicit override)
 * 3. Fallback: "unknown"
 *
 * Values are raw client strings — normalization happens in DB views.
 *
 * Note: server.connect() resolves when the transport is ready, BEFORE the
 * client sends its initialize request. getClientVersion() only returns data
 * after the handshake completes. We store a server reference and read lazily
 * so the ping (fired 2s after connect) picks up the value once available.
 */

import type { Server } from "@modelcontextprotocol/sdk/server/index.js";

let serverRef: Server | null = null;

/**
 * Store a reference to the MCP server for lazy client detection.
 * Call once after server.connect() completes.
 */
export function initAgentModel(server: Server): void {
  serverRef = server;
}

/**
 * Get the detected agent model string.
 * Reads lazily from the server — safe to call before or after handshake.
 * Returns raw client name (e.g. "claude-desktop", "cursor", "continue").
 */
export function getAgentModel(): string {
  // 1. MCP client info (read lazily — handshake may have completed since init)
  try {
    const clientInfo = serverRef?.getClientVersion();
    if (clientInfo?.name) return clientInfo.name;
  } catch {
    // getClientVersion() may throw if called before handshake — safe to ignore
  }

  // 2. Explicit env override
  const envModel = process.env.KYA_AGENT_MODEL?.trim();
  if (envModel) return envModel;

  // 3. Fallback
  return "unknown";
}
