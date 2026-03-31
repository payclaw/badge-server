// @kyalabs/badge-sdk — Framework-agnostic Badge identity primitive
// SDK exports: everything that does NOT depend on @modelcontextprotocol/sdk

// --- Badge class (primary API surface) ---
export { Badge, type IdentityType, type BadgeInitOptions } from "./badge.js";

// --- Guest pass lifecycle ---
export { issueGuestPass, loadCachedGuestPass, cacheGuestPass, type GuestPassResult } from "./guest-pass.js";

// --- Types ---
export type { AgentIdentityResponse } from "./types.js";

// --- Device auth ---
export {
  initiateDeviceAuth,
  pollForApproval,
  type DeviceAuthResponse,
  type TokenSuccessResponse,
  type ApprovalCallback,
} from "./device-auth.js";

// --- Storage ---
export {
  getStoredConsentKey,
  storeConsentKey,
  getOrCreateInstallId,
  getAuthMode,
  _resetInstallIdCache,
} from "./storage.js";

// --- Environment ---
export { getEnvApiKey, getEnvApiUrl, getEnvExtendedAuth } from "./env.js";

// --- Outcome parsing ---
export { parseResponse } from "./parse-outcome.js";

// --- Signal status ---
export {
  fetchSignalStatus,
  type SignalStatus,
} from "./signal-status.js";

// --- Telemetry (was report-badge) ---
export {
  reportBadgePresented,
  reportBadgeNotPresented,
  configureReportBadge,
} from "./telemetry.js";

// --- URL safety ---
export { isPublicOrigin } from "./url-safety.js";

// --- Badge token ---
export {
  enrollAndCacheBadgeToken,
  getCachedBadgeToken,
  _resetBadgeTokenCache,
} from "./badge-token.js";

// --- UCP manifest ---
export {
  fetchUCPManifest,
  findBadgeCapability,
  isVersionCompatible,
  _resetManifestCache,
  type BadgeCapability,
} from "./ucp-manifest.js";

// --- API client infrastructure ---
export {
  BadgeApiError,
  REQUEST_TIMEOUT_MS,
  getConfig,
  authHeaders,
  request,
  isApiMode,
  getBaseUrl,
  introspectBadgeToken,
  getAgentIdentityWithToken,
  type IntrospectResult,
} from "./api/client.js";
