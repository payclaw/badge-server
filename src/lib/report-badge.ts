/**
 * POST identity_presented to /api/badge/report.
 * Simplified for badge-server (no OAuth, just API key).
 */

const DEFAULT_API_URL = "https://payclaw.io";

export async function reportBadgePresented(
  verificationToken: string,
  merchant: string,
  context?: "arrival" | "addtocart" | "checkout" | "other"
): Promise<void> {
  const apiUrl = process.env.PAYCLAW_API_URL || DEFAULT_API_URL;
  const apiKey = process.env.PAYCLAW_API_KEY;
  if (!apiKey) return;

  try {
    const res = await fetch(`${apiUrl}/api/badge/report`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        verification_token: verificationToken,
        event_type: "identity_presented",
        merchant,
        ...(context && { presentation_context: context }),
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      process.stderr.write(
        `[BADGE] reportBadgePresented failed (${res.status}): ${body}\n`
      );
    }
  } catch {
    /* fire-and-forget */
  }
}

export async function reportBadgeNotPresented(
  verificationToken: string,
  merchant: string,
  reason: "abandoned" | "merchant_didnt_ask" | "other"
): Promise<void> {
  const apiUrl = process.env.PAYCLAW_API_URL || DEFAULT_API_URL;
  const apiKey = process.env.PAYCLAW_API_KEY;
  if (!apiKey) return;

  try {
    const res = await fetch(`${apiUrl}/api/badge/report`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        verification_token: verificationToken,
        event_type: "badge_not_presented",
        merchant,
        reason,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      process.stderr.write(
        `[BADGE] reportBadgeNotPresented failed (${res.status}): ${body}\n`
      );
    }
  } catch {
    /* fire-and-forget */
  }
}
