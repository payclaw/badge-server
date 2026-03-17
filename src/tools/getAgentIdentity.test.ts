import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getAgentIdentity, _resetBrowseDeclaredCache } from "./getAgentIdentity.js";
import * as storage from "../lib/storage.js";
import * as api from "../api/client.js";
import * as deviceAuth from "../lib/device-auth.js";

vi.mock("../lib/storage.js", () => ({
  getStoredConsentKey: vi.fn(),
  getOrCreateInstallId: vi.fn(() => "inst-aaaa-bbbb-cccc-dddddddddddd"),
}));

vi.mock("../lib/env.js", () => ({
  getEnvApiKey: vi.fn(() => null),
  getEnvApiUrl: vi.fn(() => null),
  getEnvExtendedAuth: vi.fn(() => false),
}));

vi.mock("../api/client.js", () => ({
  isApiMode: vi.fn(() => false),
  getAgentIdentity: vi.fn(),
  getAgentIdentityWithToken: vi.fn(),
  getBaseUrl: vi.fn(() => "https://www.kyalabs.io"),
}));

vi.mock("../lib/device-auth.js", () => ({
  initiateDeviceAuth: vi.fn(),
  pollForApproval: vi.fn(),
}));

vi.mock("../lib/ucp-manifest.js", () => ({
  fetchUCPManifest: vi.fn(() => null),
  findBadgeCapability: vi.fn(() => null),
  isVersionCompatible: vi.fn(() => false),
}));

describe("getAgentIdentity — browse_declared auto-fire", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
    _resetBrowseDeclaredCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("fires browse_declared when no consent key (activation path)", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue(null);
    vi.mocked(deviceAuth.initiateDeviceAuth).mockResolvedValue({
      device_code: "dc",
      user_code: "UC",
      verification_uri: "https://kyalabs.io/activate",
      verification_uri_complete: "https://kyalabs.io/activate?code=UC",
      interval: 5,
      expires_in: 300,
    });
    vi.mocked(deviceAuth.pollForApproval).mockResolvedValue(undefined as any);

    const result = await getAgentIdentity("amazon.com");

    // browse_declared should have fired
    const browseCalls = mockFetch.mock.calls.filter((c) => {
      try {
        const body = JSON.parse(c[1]?.body || "{}");
        return body.event_type === "browse_declared";
      } catch {
        return false;
      }
    });
    expect(browseCalls.length).toBeGreaterThanOrEqual(1);

    const body = JSON.parse(browseCalls[0][1].body);
    expect(body.install_id).toBe("inst-aaaa-bbbb-cccc-dddddddddddd");
    expect(body.badge_version).toBe("2.0");
    expect(body.merchant).toBe("amazon.com");
    expect(body.agent_type).toBe("badge-mcp");
    expect(typeof body.timestamp).toBe("number");

    // No Authorization header (anonymous)
    expect(browseCalls[0][1].headers.Authorization).toBeUndefined();
  });

  it("fires browse_declared via anonymous path even when consent key exists", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);

    await getAgentIdentity("target.com");

    const browseCalls = mockFetch.mock.calls.filter((c) => {
      try {
        const body = JSON.parse(c[1]?.body || "{}");
        return body.event_type === "browse_declared";
      } catch {
        return false;
      }
    });
    expect(browseCalls.length).toBeGreaterThanOrEqual(1);

    // No Authorization header — browse_declared always uses anonymous path
    // because no verification_token exists yet at browse time
    expect(browseCalls[0][1].headers.Authorization).toBeUndefined();
    const body = JSON.parse(browseCalls[0][1].body);
    expect(body.install_id).toBe("inst-aaaa-bbbb-cccc-dddddddddddd");
  });

  it("[EC-4] fires browse_declared on activation_required path", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue(null);
    vi.mocked(deviceAuth.initiateDeviceAuth).mockResolvedValue({
      device_code: "dc",
      user_code: "UC",
      verification_uri: "https://kyalabs.io/activate",
      verification_uri_complete: "https://kyalabs.io/activate?code=UC",
      interval: 5,
      expires_in: 300,
    });
    vi.mocked(deviceAuth.pollForApproval).mockResolvedValue(undefined as any);

    const result = await getAgentIdentity("shop.com");
    expect(result.activation_required).toBe(true);

    // browse_declared MUST still fire — the agent called the tool
    const browseCalls = mockFetch.mock.calls.filter((c) => {
      try {
        return JSON.parse(c[1]?.body || "{}").event_type === "browse_declared";
      } catch {
        return false;
      }
    });
    expect(browseCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("[EC-4] fires browse_declared in mock mode", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);

    await getAgentIdentity("mockstore.com");

    const browseCalls = mockFetch.mock.calls.filter((c) => {
      try {
        return JSON.parse(c[1]?.body || "{}").event_type === "browse_declared";
      } catch {
        return false;
      }
    });
    expect(browseCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("[EC-5] identity still returned when browse_declared fetch throws", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);
    mockFetch.mockRejectedValue(new Error("network down"));

    const result = await getAgentIdentity("fail.com");

    // Identity must still be returned despite browse fire failure
    expect(result.product_name).toBe("Badge by kyaLabs");
    expect(result.status).toBeDefined();
  });

  it("[EC-5] identity still returned when getOrCreateInstallId throws", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);
    vi.mocked(storage.getOrCreateInstallId).mockImplementation(() => {
      throw new Error("homedir unavailable");
    });

    const result = await getAgentIdentity("broken.com");

    expect(result.product_name).toBe("Badge by kyaLabs");
    expect(result.status).toBeDefined();
  });
});

describe("getAgentIdentity — trip_id (v2.1)", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
    _resetBrowseDeclaredCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("response includes trip_id as a valid UUID", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);

    const result = await getAgentIdentity("store.com");

    expect(result.trip_id).toBeDefined();
    expect(result.trip_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });

  it("each call generates a unique trip_id", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);

    const r1 = await getAgentIdentity("store.com");
    _resetBrowseDeclaredCache();
    const r2 = await getAgentIdentity("store.com");

    expect(r1.trip_id).not.toBe(r2.trip_id);
  });

  it("browse_declared payload includes trip_id", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue(null);
    vi.mocked(deviceAuth.initiateDeviceAuth).mockResolvedValue({
      device_code: "dc",
      user_code: "UC",
      verification_uri: "https://kyalabs.io/activate",
      verification_uri_complete: "https://kyalabs.io/activate?code=UC",
      interval: 5,
      expires_in: 300,
    });
    vi.mocked(deviceAuth.pollForApproval).mockResolvedValue(undefined as any);

    const result = await getAgentIdentity("amazon.com");

    const browseCalls = mockFetch.mock.calls.filter((c) => {
      try {
        return JSON.parse(c[1]?.body || "{}").event_type === "browse_declared";
      } catch {
        return false;
      }
    });
    expect(browseCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(browseCalls[0][1].body);
    expect(body.trip_id).toBe(result.trip_id);
  });

  it("trip_id present even on activation_required path", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue(null);
    vi.mocked(deviceAuth.initiateDeviceAuth).mockResolvedValue({
      device_code: "dc",
      user_code: "UC",
      verification_uri: "https://kyalabs.io/activate",
      verification_uri_complete: "https://kyalabs.io/activate?code=UC",
      interval: 5,
      expires_in: 300,
    });
    vi.mocked(deviceAuth.pollForApproval).mockResolvedValue(undefined as any);

    const result = await getAgentIdentity("store.com");

    expect(result.activation_required).toBe(true);
    expect(result.trip_id).toBeDefined();
    expect(result.trip_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
  });
});

describe("getAgentIdentity — next_step field", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
    _resetBrowseDeclaredCache();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("response includes next_step in mock mode", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);

    const result = await getAgentIdentity("store.com");

    expect(result.next_step).toBeDefined();
    expect(typeof result.next_step).toBe("string");
    expect(result.next_step!.length).toBeGreaterThan(0);
  });

  it("response includes next_step in activation path", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue(null);
    vi.mocked(deviceAuth.initiateDeviceAuth).mockResolvedValue({
      device_code: "dc",
      user_code: "UC",
      verification_uri: "https://kyalabs.io/activate",
      verification_uri_complete: "https://kyalabs.io/activate?code=UC",
      interval: 5,
      expires_in: 300,
    });
    vi.mocked(deviceAuth.pollForApproval).mockResolvedValue(undefined as any);

    const result = await getAgentIdentity("store.com");

    expect(result.next_step).toBeDefined();
    expect(typeof result.next_step).toBe("string");
  });
});
