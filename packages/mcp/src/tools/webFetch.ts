/**
 * kya_web_fetch — fetch with automatic Badge identity + shopping journal.
 *
 * Wraps native fetch with:
 * - Kya-Token header injection (identity delivery)
 * - Auto-declare event (shopping journal, fire-and-forget)
 * - SSRF protection (isPublicOrigin check)
 * - Response bounds (5MB max, 30s timeout)
 * - Manual redirects (prevents token leak to redirect targets)
 */

import {
  isPublicOrigin,
  enrollAndCacheBadgeToken,
  getCachedBadgeToken,
} from "@kyalabs/badge-sdk";
import { randomUUID } from "node:crypto";
import { fireDeclareOrReport } from "./browseDeclare.js";

const MAX_BODY_BYTES = 5_242_880; // 5MB
const FETCH_TIMEOUT_MS = 30_000;
const ALLOWED_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** Headers to keep from the response — everything else is stripped. */
const KEEP_HEADERS = new Set([
  "content-type",
  "content-length",
  "location",
  "cache-control",
]);

// --- Result types ---

export interface WebFetchSuccess {
  status: number;
  headers: Record<string, string>;
  body: string;
  truncated: boolean;
  url: string;
}

export interface WebFetchError {
  error: string;
  code: string;
}

export type WebFetchResult = WebFetchSuccess | WebFetchError;

/**
 * Fetch a URL with Kya-Token identity header injected.
 * Auto-fires a browse_declared event (fire-and-forget).
 */
export async function webFetch(
  url: string,
  method?: string,
  headers?: Record<string, string>,
): Promise<WebFetchResult> {
  // 1. URL validation (before identity — need merchant from URL)
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: "Invalid URL", code: "INVALID_URL" };
  }

  // 3. Scheme check — HTTPS only (HTTP allowed in tests)
  const isHttps = parsed.protocol === "https:";
  const isTestHttp = parsed.protocol === "http:" && process.env.VITEST;
  if (!isHttps && !isTestHttp) {
    return { error: "URL must use HTTPS", code: "INVALID_URL" };
  }

  // 4. SSRF check
  if (!isPublicOrigin(url)) {
    return { error: "Cannot fetch private or internal URLs", code: "BLOCKED_URL" };
  }

  // 5. Identity check — get badge token for this merchant
  const merchant = parsed.hostname.replace(/^www\./, "");
  let token = getCachedBadgeToken(merchant);
  if (!token) {
    // Enroll on-the-fly for this merchant
    token = await enrollAndCacheBadgeToken(merchant);
  }
  if (!token) {
    return {
      error: "Call kya_getAgentIdentity with a merchant first to establish identity",
      code: "NO_IDENTITY",
    };
  }

  // 6. Method check
  const resolvedMethod = (method ?? "GET").toUpperCase();
  if (!ALLOWED_METHODS.has(resolvedMethod)) {
    return {
      error: `Method ${resolvedMethod} not allowed. Use GET, HEAD, or OPTIONS.`,
      code: "METHOD_NOT_ALLOWED",
    };
  }

  // 7. Build request headers — our token wins over any agent-provided Kya-Token
  // Filter out case-variant kya-token headers to prevent agents from overriding
  const sanitizedHeaders: Record<string, string> = {};
  if (headers) {
    for (const [k, v] of Object.entries(headers)) {
      if (k.toLowerCase() !== "kya-token") {
        sanitizedHeaders[k] = v;
      }
    }
  }
  const requestHeaders: Record<string, string> = {
    ...sanitizedHeaders,
    "Kya-Token": token,
  };

  // 7. Fetch
  let response: Response;
  try {
    response = await fetch(url, {
      method: resolvedMethod,
      headers: requestHeaders,
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { error: "Request timed out", code: "TIMEOUT" };
    }
    return { error: "Failed to fetch URL", code: "FETCH_ERROR" };
  }

  // 8. Read body with size cap
  let body: string;
  let truncated = false;
  try {
    body = await response.text();
    if (body.length > MAX_BODY_BYTES) {
      body = body.slice(0, MAX_BODY_BYTES);
      truncated = true;
    }
  } catch {
    body = "";
  }

  // 9. Filter response headers
  const responseHeaders: Record<string, string> = {};
  for (const [key, value] of response.headers.entries()) {
    if (KEEP_HEADERS.has(key.toLowerCase())) {
      responseHeaders[key.toLowerCase()] = value;
    }
  }

  const result: WebFetchSuccess = {
    status: response.status,
    headers: responseHeaders,
    body,
    truncated,
    url: response.url || url,
  };

  // 11. Auto-declare (fire-and-forget)
  // v2.6: Routes to /api/badge/declare when badge token available, /api/badge/report otherwise
  fireDeclareOrReport({
    merchant,
    tripId: randomUUID(),
    url,
    badgeToken: token,
  }).catch(() => {});

  return result;
}
