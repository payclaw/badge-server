/**
 * Guest pass issuance lifecycle — KYA-164
 *
 * Issues, caches, and refreshes guest passes from /api/badge/guest-pass.
 * Offline fallback: generates local-only identity if API unreachable.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getEnvApiUrl } from "./env.js";


const DEFAULT_API_URL = "https://www.kyalabs.io";
const GUEST_PASS_TIMEOUT_MS = 5_000;
const KYA_DIR = join(homedir(), ".kya");
const CACHE_FILE = join(KYA_DIR, "guest_token");

export interface GuestPassResult {
  token: string;
  expiresAt: string;
  identityType: "guest" | "offline";
}

/**
 * Issue a guest pass from the API.
 * Returns null on failure (caller should fall back to offline identity).
 */
export async function issueGuestPass(
  installId: string,
  platform?: string,
  agentClient?: string,
  badgeVersion?: string
): Promise<GuestPassResult | null> {
  const apiUrl = getEnvApiUrl() || DEFAULT_API_URL;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GUEST_PASS_TIMEOUT_MS);

    const res = await fetch(`${apiUrl}/api/badge/guest-pass`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        install_id: installId,
        iss: "sdk",
        platform: platform ?? `node/${process.version}`,
        agent_client: agentClient,
        badge_version: badgeVersion ?? "1.0.0",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) return null;

    const data = await res.json();
    const result: GuestPassResult = {
      token: data.guest_token,
      expiresAt: data.expires_at,
      identityType: "guest",
    };

    cacheGuestPass(result.token, result.expiresAt);
    return result;
  } catch {
    return null;
  }
}

/**
 * Load a cached guest pass from ~/.kya/guest_token.
 * Returns null if no cache, expired, or unreadable.
 */
export function loadCachedGuestPass(): GuestPassResult | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    const raw = readFileSync(CACHE_FILE, "utf-8").trim();
    if (!raw) return null;

    const data = JSON.parse(raw);
    if (!data.token || !data.expiresAt) return null;

    // Check expiry
    if (new Date(data.expiresAt) < new Date()) return null;

    return {
      token: data.token,
      expiresAt: data.expiresAt,
      identityType: "guest",
    };
  } catch {
    return null;
  }
}

/**
 * Cache a guest pass to ~/.kya/guest_token.
 * Best-effort — failure is silent.
 */
export function cacheGuestPass(token: string, expiresAt: string): void {
  try {
    mkdirSync(KYA_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify({ token, expiresAt }), "utf-8");
  } catch {
    // Silent failure — cache is a performance optimization, not required
  }
}
