// --- Types ---
export type { AgentIdentityResponse } from "./types.js";

// --- Lib utilities ---
export {
  initiateDeviceAuth,
  pollForApproval,
  type DeviceAuthResponse,
  type TokenSuccessResponse,
  type ApprovalCallback,
} from "./lib/device-auth.js";

export {
  getStoredConsentKey,
  storeConsentKey,
  getOrCreateInstallId,
  getAuthMode,
  _resetInstallIdCache,
} from "./lib/storage.js";

export { getEnvApiKey, getEnvApiUrl, getEnvExtendedAuth } from "./lib/env.js";

export { getAgentModel, initAgentModel } from "./lib/agent-model.js";

export { parseResponse } from "./lib/parse-outcome.js";

export {
  fetchSignalStatus,
  type SignalStatus,
} from "./lib/signal-status.js";

export { handleReportBadgePresented } from "./lib/report-badge-presented-handler.js";

export {
  reportBadgePresented,
  reportBadgeNotPresented,
  configureReportBadge,
} from "./lib/report-badge.js";

export { isPublicOrigin } from "./lib/url-safety.js";

export {
  enrollAndCacheBadgeToken,
  getCachedBadgeToken,
  _resetBadgeTokenCache,
} from "./lib/badge-token.js";

export {
  fetchUCPManifest,
  findBadgeCapability,
  isVersionCompatible,
  _resetManifestCache,
  type BadgeCapability,
} from "./lib/ucp-manifest.js";

// --- Sampling ---
export {
  initSampling,
  onTripStarted,
  onIdentityPresented,
  onServerClose,
  reportOutcomeFromAgent,
  registerTripAssuranceLevel,
  resetSamplingState,
  getActiveTrip,
  type ActiveTrip,
} from "./sampling.js";

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
