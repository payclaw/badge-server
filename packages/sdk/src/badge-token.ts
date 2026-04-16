/**
 * Badge token cache — manages kya_* opaque tokens per merchant.
 *
 * Badge tokens are merchant-scoped credentials minted by /api/badge/enroll.
 * They are the credential type that merchants verify via /api/badge/verify.
 *
 * This is DIFFERENT from the consent key (pk_* / OAuth token) which authenticates
 * badge-server to the kya API. The consent key is for kya; the badge token is for merchants.
 *
 * Flow: consent key → authenticate to kya → enroll → kya_* badge token → Kya-Token header
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getStoredConsentKey, getOrCreateInstallId } from "./storage.js";
import { getEnvApiUrl } from "./env.js";

const DEFAULT_API_URL = "https://www.kyalabs.io";
const ENROLL_TIMEOUT_MS = 10_000;
const KYA_DIR = join(homedir(), ".kya");
const CACHE_FILE = join(KYA_DIR, "badge_tokens.json");

/** Per-merchant badge token cache. Key = installId:merchant. */
const badgeTokenCache = new Map<string, { token: string; expiresAt?: string }>();

/** Track the last enrolled merchant for getHeaders() (no merchant context). */
let lastEnrolledMerchant: string | null = null;

interface PersistedBadgeToken {
  token: string;
  expiresAt?: string;
}

function normalizeMerchant(merchant: string): string {
  return merchant
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/$/, "");
}

function cacheKey(merchant: string, installId: string): string {
  return `${installId}:${normalizeMerchant(merchant)}`;
}

function readPersistedBadgeTokens(): Record<string, PersistedBadgeToken> {
  try {
    if (!existsSync(CACHE_FILE)) return {};
    const raw = readFileSync(CACHE_FILE, "utf-8").trim();
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, PersistedBadgeToken>;
    return parsed ?? {};
  } catch {
    return {};
  }
}

function writePersistedBadgeTokens(tokens: Record<string, PersistedBadgeToken>): void {
  try {
    mkdirSync(KYA_DIR, { recursive: true, mode: 0o700 });
    writeFileSync(CACHE_FILE, JSON.stringify(tokens), { encoding: "utf-8", mode: 0o600 });
  } catch {
    // Silent failure — cache is durable optimization, not required for correctness
  }
}

function loadPersistedBadgeToken(merchant: string, installId: string): string | null {
  const normalizedMerchant = normalizeMerchant(merchant);
  const tokens = readPersistedBadgeTokens();
  const entry = tokens[cacheKey(normalizedMerchant, installId)];
  if (!entry?.token) return null;

  if (entry.expiresAt && new Date(entry.expiresAt) < new Date()) {
    delete tokens[cacheKey(normalizedMerchant, installId)];
    writePersistedBadgeTokens(tokens);
    return null;
  }

  badgeTokenCache.set(cacheKey(normalizedMerchant, installId), { token: entry.token, expiresAt: entry.expiresAt });
  lastEnrolledMerchant = normalizedMerchant;
  return entry.token;
}

function persistBadgeToken(
  merchant: string,
  installId: string,
  token: string,
  expiresAt?: string,
): void {
  const normalizedMerchant = normalizeMerchant(merchant);
  const key = cacheKey(normalizedMerchant, installId);
  badgeTokenCache.set(key, { token, expiresAt });
  lastEnrolledMerchant = normalizedMerchant;

  const tokens = readPersistedBadgeTokens();
  tokens[key] = { token, ...(expiresAt ? { expiresAt } : {}) };
  writePersistedBadgeTokens(tokens);
}

/**
 * Enroll at a merchant and cache the kya_* badge token.
 * Returns cached token if already enrolled for this merchant.
 * Returns null on failure (graceful — never throws).
 */
export async function enrollAndCacheBadgeToken(merchant: string): Promise<string | null> {
  const normalizedMerchant = normalizeMerchant(merchant);
  const installId = getOrCreateInstallId();
  const key = cacheKey(normalizedMerchant, installId);

  // Check cache first
  const cached = badgeTokenCache.get(key);
  if (cached) {
    if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
      badgeTokenCache.delete(key);
    } else {
      return cached.token;
    }
  }

  const persisted = loadPersistedBadgeToken(normalizedMerchant, installId);
  if (persisted) return persisted;

  // Need consent key to enroll
  const consentKey = getStoredConsentKey();
  if (!consentKey) return null;

  const apiUrl = getEnvApiUrl() || DEFAULT_API_URL;

  try {
    const res = await fetch(`${apiUrl}/api/badge/enroll`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${consentKey}`,
      },
      body: JSON.stringify({ merchant, install_id: installId }),
      signal: AbortSignal.timeout(ENROLL_TIMEOUT_MS),
    });

    if (!res.ok) {
      process.stderr.write(`[badge] enroll failed for ${merchant}: HTTP ${res.status}\n`);
      return null;
    }

    const data = (await res.json()) as {
      badge_token?: string;
      existing?: boolean;
      expires_at?: string;
    };

    // Idempotent re-enrollment: API returns { existing: true } without a badge_token
    // because the token was hashed on first enrollment and can't be reversed.
    // The SDK must persist the badge_token from the original 201 response.
    if (data.existing && !data.badge_token) {
      const persistedExisting = loadPersistedBadgeToken(normalizedMerchant, installId);
      if (persistedExisting) return persistedExisting;
      // No cached token (process restarted) — can't recover until next day
      process.stderr.write(`[badge] already enrolled at ${merchant} today but no cached token — persist badge_token on first enrollment\n`);
      return null;
    }

    if (!data.badge_token) {
      process.stderr.write(`[badge] enroll response missing badge_token\n`);
      return null;
    }

    persistBadgeToken(normalizedMerchant, installId, data.badge_token, data.expires_at);
    return data.badge_token;
  } catch {
    process.stderr.write(`[badge] enroll failed for ${merchant}: network error\n`);
    return null;
  }
}

/**
 * Get cached badge token for a merchant.
 * If no merchant specified, returns the most recently enrolled token.
 * Returns null if no token cached.
 */
export function getCachedBadgeToken(merchant?: string): string | null {
  if (merchant) {
    const installId = getOrCreateInstallId();
    const normalizedMerchant = normalizeMerchant(merchant);
    const key = cacheKey(normalizedMerchant, installId);
    const cached = badgeTokenCache.get(key);
    let token: string | null = null;
    if (cached) {
      if (cached.expiresAt && new Date(cached.expiresAt) < new Date()) {
        badgeTokenCache.delete(key);
      } else {
        token = cached.token;
      }
    }
    token ??= loadPersistedBadgeToken(normalizedMerchant, installId);
    // Keep lastEnrolledMerchant in sync so no-arg getHeaders() uses the right merchant
    if (token) lastEnrolledMerchant = normalizedMerchant;
    return token;
  }
  // No merchant — return last enrolled
  if (lastEnrolledMerchant) {
    return getCachedBadgeToken(lastEnrolledMerchant);
  }
  return null;
}

/** Reset cache — for testing only. */
export function _resetBadgeTokenCache(): void {
  badgeTokenCache.clear();
  lastEnrolledMerchant = null;
}
