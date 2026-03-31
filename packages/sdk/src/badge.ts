/**
 * Badge — the identity primitive for AI agents.
 *
 * Stateful wrapper around storage, guest-pass issuance, token management,
 * and telemetry. Framework-agnostic — no MCP dependency.
 *
 * Usage:
 *   const badge = await Badge.init()
 *   badge.headers()       // { "Kya-Token": "gp_v1_..." }
 *   badge.fetch(url)      // auto header injection
 *   badge.destroy()       // flush telemetry
 *
 * KYA-164
 */

import { getOrCreateInstallId } from "./storage.js";
import { issueGuestPass, loadCachedGuestPass, type GuestPassResult } from "./guest-pass.js";

export type IdentityType = "guest" | "verified" | "offline";

export interface BadgeInitOptions {
  /** Override the auto-generated install_id (for Docker/CI where filesystem is ephemeral) */
  installId?: string;
  /** Platform string for telemetry */
  platform?: string;
  /** Agent client identifier */
  agentClient?: string;
}

export class Badge {
  readonly identityType: IdentityType;
  readonly installId: string;
  readonly token: string;

  private constructor(
    identityType: IdentityType,
    installId: string,
    token: string,
  ) {
    this.identityType = identityType;
    this.installId = installId;
    this.token = token;
  }

  /** True if this is a guest (non-verified) identity */
  get isGuest(): boolean {
    return this.identityType === "guest" || this.identityType === "offline";
  }

  /**
   * Initialize a Badge instance. Issues a guest pass on first run ("SSN on birth").
   * Reuses cached guest pass when available.
   */
  static async init(opts?: BadgeInitOptions): Promise<Badge> {
    const installId = opts?.installId ?? getOrCreateInstallId();

    // Try cached guest pass first
    const cached = loadCachedGuestPass();
    if (cached) {
      return new Badge(cached.identityType, installId, cached.token);
    }

    // Issue fresh guest pass
    const gp = await issueGuestPass(installId, opts?.platform, opts?.agentClient);
    if (gp) {
      return new Badge(gp.identityType, installId, gp.token);
    }

    // Offline fallback — local-only identity
    return new Badge("offline", installId, `offline_${installId}`);
  }

  /** Get HTTP headers for identity injection */
  headers(): Record<string, string> {
    return { "Kya-Token": this.token };
  }

  /** Whether the agent should be nudged to upgrade to verified identity */
  shouldNudge(): boolean {
    // v1: no nudge logic — always false until trip count tracking lands
    return false;
  }

  /** Human-readable nudge message, or null if no nudge */
  nudgeMessage(): string | null {
    return this.shouldNudge() ? "Create an account to preserve your history." : null;
  }

  /** Flush pending telemetry and release resources */
  destroy(): void {
    // v1: no-op — telemetry flush will be wired in when reportEvent lands
  }
}
