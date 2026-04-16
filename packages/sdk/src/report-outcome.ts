import { BadgeApiError, getBaseUrl, request } from "./api/client.js";
import type { BadgeOutcome, FrictionReason, OutcomeResult } from "./types.js";
import { BADGE_VERSION } from "./version.js";

interface ReportOutcomeArgs {
  installId: string;
  merchant: string;
  runId: string;
  outcome: BadgeOutcome;
  frictionReason?: FrictionReason;
  detail?: string;
}

interface ReportOutcomeResponse {
  status?: string;
}

// Token param is accepted for call-site symmetry with postDeclareVisit but not
// sent — the anonymous /api/badge/report path authenticates via install_id only.
export async function postReportOutcome(
  _token: string,
  args: ReportOutcomeArgs,
): Promise<OutcomeResult> {
  if (!args.runId) {
    throw new Error("runId is required");
  }

  try {
    await request<ReportOutcomeResponse>(`${getBaseUrl()}/api/badge/report`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        install_id: args.installId,
        badge_version: BADGE_VERSION,
        event_type: "sampling_complete",
        merchant: args.merchant,
        trip_id: args.runId,
        outcome: args.outcome,
        outcome_source: "explicit",
        ...(args.frictionReason ? { friction_reason: args.frictionReason } : {}),
        ...(args.detail ? { detail: args.detail } : {}),
        timestamp: Date.now(),
      }),
    });

    return {
      recordedAs: "reported",
      merchant: args.merchant,
      runId: args.runId,
    };
  } catch (error) {
    if (error instanceof BadgeApiError && error.statusCode !== undefined) {
      throw error;
    }
    return {
      recordedAs: "offline",
      merchant: args.merchant,
      runId: args.runId,
    };
  }
}
