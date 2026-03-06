// Canonical: mcp-server | Synced: 0.7.3 | Structurally divergent — badge-only subset of mcp-server's client
import type { AgentIdentityResponse } from "../types.js";
import { getStoredConsentKey } from "../lib/storage.js";

class PayClawApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "PayClawApiError";
  }
}

const REQUEST_TIMEOUT_MS = 30_000;

function getConfig() {
  const baseUrl = process.env.PAYCLAW_API_URL;
  const apiKey = getStoredConsentKey();
  if (!baseUrl) throw new PayClawApiError("PayClaw API URL is not configured.");
  if (!apiKey) throw new PayClawApiError("PayClaw API key is not configured.");
  if (
    !baseUrl.startsWith("https://") &&
    !baseUrl.startsWith("http://localhost")
  ) {
    throw new PayClawApiError("PayClaw API URL must use HTTPS.");
  }
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey };
}

function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new PayClawApiError("Request timed out.");
    }
    throw new PayClawApiError("Could not reach the PayClaw API.");
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401) {
    const authHeader =
      init.headers instanceof Headers
        ? init.headers.get("Authorization")
        : (init.headers as Record<string, string> | undefined)?.Authorization;
    const isBearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ");
    throw new PayClawApiError(
      isBearer
        ? "Authentication failed. Check your access token or OAuth credentials."
        : "Authentication failed. Check your API key.",
      401
    );
  }

  if (!res.ok) {
    let body: string;
    try {
      const json = (await res.json()) as { error?: string };
      body = json.error ?? JSON.stringify(json);
    } catch {
      body = await res.text();
    }
    throw new PayClawApiError(body, res.status);
  }

  return (await res.json()) as T;
}

export async function getAgentIdentity(
  sessionId?: string,
  merchant?: string
): Promise<AgentIdentityResponse> {
  const { baseUrl, apiKey } = getConfig();
  return request<AgentIdentityResponse>(`${baseUrl}/api/agent-identity`, {
    method: "POST",
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      session_id: sessionId,
      ...(merchant ? { merchant } : {}),
    }),
  });
}

export function isApiMode(): boolean {
  return !!process.env.PAYCLAW_API_URL || !!getStoredConsentKey();
}

/** Base URL for API calls. Defaults to https://payclaw.io. Validates HTTPS for token safety. */
export function getBaseUrl(): string {
  const url = process.env.PAYCLAW_API_URL;
  if (url && url.trim().length > 0) {
    const trimmed = url.trim().replace(/\/+$/, "");
    if (trimmed.startsWith("https://") || trimmed.startsWith("http://localhost")) {
      return trimmed;
    }
  }
  return "https://payclaw.io";
}

/**
 * Call agent-identity with a Bearer token (API key or OAuth access token).
 * Used when consent key comes from device flow (OAuth token) instead of PAYCLAW_API_KEY.
 */
export async function getAgentIdentityWithToken(
  baseUrl: string,
  token: string,
  merchant?: string
): Promise<AgentIdentityResponse> {
  return request<AgentIdentityResponse>(`${baseUrl}/api/agent-identity`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      ...(merchant ? { merchant } : {}),
    }),
  });
}
