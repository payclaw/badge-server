import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

// Mock the shared identity module — introspectBadgeToken uses getEnvApiUrl internally
vi.mock("@kyalabs/shared-identity", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@kyalabs/shared-identity")>();
  return {
    ...actual,
    getEnvApiUrl: vi.fn().mockReturnValue("https://www.kyalabs.io"),
    getEnvApiKey: vi.fn().mockReturnValue(null),
    getStoredConsentKey: vi.fn().mockReturnValue(null),
    getOrCreateInstallId: vi.fn().mockReturnValue("aaaaaaaa-0000-0000-0000-000000000001"),
  };
});

import { introspectBadgeToken } from "./client.js";

describe("introspectBadgeToken", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    process.env.VITEST = "true";
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // Contract 2.2.1 — returns assurance_level on success
  it("returns assurance_level on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ active: true, assurance_level: "starter" }),
    });

    const result = await introspectBadgeToken("pc_v1_abc123");
    expect(result?.active).toBe(true);
    expect(result?.assurance_level).toBe("starter");
    expect(mockFetch).toHaveBeenCalledOnce();

    // Verify form-encoded body
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/api/oauth/introspect");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/x-www-form-urlencoded",
    });
  });

  // Contract 2.2.2 — mock tokens skip introspect entirely
  it("returns null for mock tokens without calling fetch", async () => {
    const result = await introspectBadgeToken("pc_v1_sand_mock_token");
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns null for any pc_v1_sand prefixed token", async () => {
    const result = await introspectBadgeToken("pc_v1_sand");
    expect(result).toBeNull();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // Contract 2.2.3 — graceful null on network failure
  it("returns null on network failure (does not throw)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const result = await introspectBadgeToken("pc_v1_real_token_abc");
    expect(result).toBeNull();
  });

  it("returns null on abort/timeout (does not throw)", async () => {
    const abortErr = new Error("AbortError");
    abortErr.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortErr);
    const result = await introspectBadgeToken("pc_v1_real_token_abc");
    expect(result).toBeNull();
  });

  it("returns null on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const result = await introspectBadgeToken("pc_v1_real_token_abc");
    expect(result).toBeNull();
  });

  it("returns full IntrospectResult fields when available", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        active: true,
        assurance_level: "elite",
        scope: "browse",
        credential_provider: "device_flow",
        badge_status: "verified",
        install_id: "bbbbbbbb-0000-0000-0000-000000000002",
        agent_type: "mcp-server",
      }),
    });

    const result = await introspectBadgeToken("pc_v1_real_token_abc");
    expect(result?.assurance_level).toBe("elite");
    expect(result?.scope).toBe("browse");
    expect(result?.credential_provider).toBe("device_flow");
  });
});
