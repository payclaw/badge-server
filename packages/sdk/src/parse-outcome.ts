/**
 * Parse agent response to sampling prompt into sampling_response bucket.
 * Extracted for testability (BUG-01.1).
 *
 * S1: Values renamed — not_denied (absence of denial, NOT acceptance),
 * denied (agent reported block), unparseable (garbled/empty response).
 */

const FAILURE_SIGNALS = [
  "yes",
  "blocked",
  "denied",
  "failed",
  "403",
  "error",
  "rejected",
  "banned",
  "forbidden",
  "captcha",
  "stopped",
];

export function parseResponse(
  text: string
): "not_denied" | "denied" | "unparseable" {
  if (!text || text.trim().length === 0) return "unparseable";

  const lower = text.toLowerCase().trim();

  // "no, I was not denied" = not_denied (check before denial signals)
  if (lower.includes("not denied") || lower.includes("wasn't denied"))
    return "not_denied";

  // "yesterday" contains "yes" — exclude false positives (including punctuated variants)
  const normalized = lower.replace(/[.,!?]+$/, "");
  if (normalized === "yesterday") return "unparseable";

  // Denial signals first — "no, I was blocked" must be denied (before any "no" check)
  if (FAILURE_SIGNALS.some((s) => lower.includes(s))) return "denied";

  // "no" alone or "no" variants = not_denied (boundary-aware to avoid "no, I was blocked")
  if (/^no(?:[.,!\s]|$)/i.test(lower)) return "not_denied";

  return "unparseable";
}
