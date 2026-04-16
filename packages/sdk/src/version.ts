/**
 * Badge report protocol version — sent as `badge_version` in /api/badge/report payloads.
 * This is the telemetry/event schema version, NOT the npm package version.
 * Guest-pass issuance uses its own version ("1.0.0") inline.
 */
export const BADGE_VERSION = "2.4";
