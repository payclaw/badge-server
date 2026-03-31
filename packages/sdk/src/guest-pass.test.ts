import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { issueGuestPass, loadCachedGuestPass, cacheGuestPass } from "./guest-pass.js";
import * as storage from "./storage.js";

vi.mock("./storage.js", () => ({
  getOrCreateInstallId: vi.fn(() => "inst-aaaa-bbbb-cccc-dddddddddddd"),
  getStoredConsentKey: vi.fn(() => null),
  storeConsentKey: vi.fn(),
  getAuthMode: vi.fn(() => "anonymous"),
  _resetInstallIdCache: vi.fn(),
}));

// Mock fs for cache operations
vi.mock("node:fs", () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => ""),
  writeFileSync: vi.fn(),
  mkdirSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  homedir: vi.fn(() => "/tmp/test-home"),
}));

describe("guest-pass", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("issueGuestPass()", () => {
    it("calls /api/badge/guest-pass and returns token", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          token: "gp_v1_fresh_token",
          expires_at: "2026-04-07T00:00:00Z",
          identity_type: "guest",
        }),
      });

      const result = await issueGuestPass("inst-aaaa-bbbb-cccc-dddddddddddd");
      expect(result).toBeDefined();
      expect(result!.token).toBe("gp_v1_fresh_token");
      expect(result!.identityType).toBe("guest");

      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toContain("/api/badge/guest-pass");
      expect(opts.method).toBe("POST");
    });

    it("returns null when API unreachable", async () => {
      mockFetch.mockRejectedValueOnce(new Error("network down"));
      const result = await issueGuestPass("inst-aaaa-bbbb-cccc-dddddddddddd");
      expect(result).toBeNull();
    });

    it("returns null on non-200 response", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
      const result = await issueGuestPass("inst-aaaa-bbbb-cccc-dddddddddddd");
      expect(result).toBeNull();
    });
  });

  describe("loadCachedGuestPass()", () => {
    it("returns null when no cache exists", () => {
      const result = loadCachedGuestPass();
      expect(result).toBeNull();
    });
  });

  describe("cacheGuestPass()", () => {
    it("does not throw", () => {
      expect(() => cacheGuestPass("gp_v1_token", "2026-04-07T00:00:00Z")).not.toThrow();
    });
  });
});
