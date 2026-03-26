/**
 * Shared API client infrastructure for kyaLabs badge/identity APIs.
 *
 * Provides: BadgeApiError, request<T>(), auth helpers, introspection.
 * Consumer packages extend with their own endpoint functions.
 */

import type { AgentIdentityResponse } from "../types.js";
import { getStoredConsentKey } from "../lib/storage.js";
import { getEnvApiUrl } from "../lib/env.js";

export class BadgeApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "BadgeApiError";
  }
}

export const REQUEST_TIMEOUT_MS = 30_000;

export function getConfig() {
  const baseUrl = getBaseUrl();
  const apiKey = getStoredConsentKey();
  if (!apiKey) throw new BadgeApiError("kyaLabs API key is not configured.");
  return { baseUrl, apiKey };
}

export function authHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function request<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof Error && err.name === "AbortError") {
      throw new BadgeApiError("Request timed out.");
    }
    throw new BadgeApiError("Could not reach the kyaLabs API.");
  } finally {
    clearTimeout(timeout);
  }

  if (res.status === 401) {
    const authHeader =
      init.headers instanceof Headers
        ? init.headers.get("Authorization")
        : (init.headers as Record<string, string> | undefined)?.Authorization;
    const isBearer = typeof authHeader === "string" && authHeader.startsWith("Bearer ");
    throw new BadgeApiError(
      isBearer
        ? "Authentication failed. Check your access token or OAuth credentials."
        : "Authentication failed. Check your API key.",
      401
    );
  }

  if (!res.ok) {
    const rawBody = await res.text();
    let body: string;
    try {
      const json = JSON.parse(rawBody) as { error?: string };
      body = json.error ?? JSON.stringify(json);
    } catch {
      body = rawBody;
    }
    throw new BadgeApiError(body, res.status);
  }

  return (await res.json()) as T;
}

export function isApiMode(): boolean {
  return !!getEnvApiUrl() || !!getStoredConsentKey();
}

/** Base URL for API calls. Defaults to https://kyalabs.io. Validates HTTPS for token safety. */
export function getBaseUrl(): string {
  const url = getEnvApiUrl();
  if (url && url.trim().length > 0) {
    const trimmed = url.trim().replace(/\/+$/, "");
    try {
      const parsed = new URL(trimmed);
      const isLocalhost = parsed.protocol === "http:" && parsed.hostname === "localhost";
      if (parsed.protocol === "https:" || isLocalhost) return trimmed;
    } catch {
      // Invalid URL — fall through to default
    }
  }
  return "https://www.kyalabs.io";
}

export interface IntrospectResult {
  active: boolean;
  assurance_level?: string | null;
  scope?: string;
  credential_provider?: string;
  badge_status?: string;
  token_type?: string;
  install_id?: string;
  agent_type?: string;
}

const MOCK_TOKEN_PREFIX = "pc_v1_sand";

/**
 * v2.2: Introspect a badge token to retrieve assurance_level and status.
 * Mock tokens (pc_v1_sand*) are skipped — they return active:false from the API.
 * Graceful null on any failure (timeout, network, non-ok response).
 */
export async function introspectBadgeToken(token: string): Promise<IntrospectResult | null> {
  if (token.startsWith(MOCK_TOKEN_PREFIX)) return null;

  const apiUrl = getEnvApiUrl() || "https://www.kyalabs.io";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);

  try {
    const res = await fetch(`${apiUrl}/api/oauth/introspect`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    return (await res.json()) as IntrospectResult;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Call agent-identity with a Bearer token (API key or OAuth access token).
 * Used when consent key comes from device flow (OAuth token) instead of KYA_API_KEY.
 */
export async function getAgentIdentityWithToken(
  baseUrl: string,
  token: string,
  merchant?: string,
  tripId?: string
): Promise<AgentIdentityResponse> {
  return request<AgentIdentityResponse>(`${baseUrl}/api/agent-identity`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      ...(merchant ? { merchant } : {}),
      ...(tripId ? { trip_id: tripId } : {}),
    }),
  });
}
