import { BadgeApiError, getBaseUrl, request } from "./api/client.js";
import { inferContextFromUrl } from "./context-inference.js";
import type {
  BadgeEventSource,
  BadgeVisitContext,
  DeclareResult,
} from "./types.js";

interface DeclareVisitArgs {
  merchant: string;
  runId: string;
  context?: BadgeVisitContext;
  url?: string;
  source?: BadgeEventSource;
}

interface DeclareVisitResponse {
  recorded_as?: "declared" | "reported";
  session_token?: string;
}

function resolveContext(args: DeclareVisitArgs): BadgeVisitContext {
  if (args.context) return args.context;
  if (args.url) return inferContextFromUrl(args.url);
  return "arrival";
}

export async function postDeclareVisit(
  token: string,
  args: DeclareVisitArgs,
): Promise<DeclareResult> {
  if (!args.runId) {
    throw new Error("runId is required");
  }
  const source = args.source ?? "sdk";

  try {
    const response = await request<DeclareVisitResponse>(`${getBaseUrl()}/api/badge/declare`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        merchant: args.merchant,
        context: resolveContext(args),
        trip_id: args.runId,
        source,
      }),
    });

    return {
      recordedAs: response.recorded_as ?? (token.startsWith("gp_v1_") ? "reported" : "declared"),
      source,
      merchant: args.merchant,
      runId: args.runId,
      ...(response.session_token ? { sessionToken: response.session_token } : {}),
    };
  } catch (error) {
    if (error instanceof BadgeApiError && error.statusCode !== undefined) {
      throw error;
    }
    return {
      recordedAs: "offline",
      source,
      merchant: args.merchant,
      runId: args.runId,
    };
  }
}
