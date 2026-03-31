import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Badge } from "./badge.js";
import * as storage from "./storage.js";
import * as guestPass from "./guest-pass.js";

vi.mock("./storage.js", () => ({
  getOrCreateInstallId: vi.fn(() => "inst-aaaa-bbbb-cccc-dddddddddddd"),
  getStoredConsentKey: vi.fn(() => null),
  storeConsentKey: vi.fn(),
  getAuthMode: vi.fn(() => "anonymous"),
  _resetInstallIdCache: vi.fn(),
}));

vi.mock("./guest-pass.js", () => ({
  issueGuestPass: vi.fn(async () => ({
    token: "gp_v1_test_token_abc123",
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    identityType: "guest" as const,
  })),
  loadCachedGuestPass: vi.fn(() => null),
  cacheGuestPass: vi.fn(),
}));

describe("Badge", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
    vi.mocked(guestPass.loadCachedGuestPass).mockReturnValue(null);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Badge.init()", () => {
    it("creates a guest identity on init", async () => {
      const badge = await Badge.init();
      expect(badge.identityType).toBe("guest");
      expect(badge.installId).toBe("inst-aaaa-bbbb-cccc-dddddddddddd");
      expect(badge.token).toBe("gp_v1_test_token_abc123");
      expect(badge.isGuest).toBe(true);
    });

    it("uses provided installId when given", async () => {
      const badge = await Badge.init({ installId: "custom-id-1234" });
      expect(badge.installId).toBe("custom-id-1234");
    });

    it("reuses cached guest pass when available", async () => {
      vi.mocked(guestPass.loadCachedGuestPass).mockReturnValue({
        token: "gp_v1_cached_token",
        expiresAt: new Date(Date.now() + 86400000).toISOString(),
        identityType: "guest" as const,
      });
      const badge = await Badge.init();
      expect(badge.token).toBe("gp_v1_cached_token");
      expect(guestPass.issueGuestPass).not.toHaveBeenCalled();
    });
  });

  describe("headers()", () => {
    it("returns Kya-Token header", async () => {
      const badge = await Badge.init();
      const headers = badge.headers();
      expect(headers).toEqual({ "Kya-Token": "gp_v1_test_token_abc123" });
    });
  });

  describe("shouldNudge()", () => {
    it("returns false for fresh agent", async () => {
      const badge = await Badge.init();
      expect(badge.shouldNudge()).toBe(false);
    });
  });

  describe("nudgeMessage()", () => {
    it("returns null for fresh agent", async () => {
      const badge = await Badge.init();
      expect(badge.nudgeMessage()).toBeNull();
    });
  });

  describe("destroy()", () => {
    it("does not throw", async () => {
      const badge = await Badge.init();
      expect(() => badge.destroy()).not.toThrow();
    });
  });
});
