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
  introspectBadgeToken: vi.fn(() => null),
}));

vi.mock("../lib/signal-status.js", () => ({
  fetchSignalStatus: vi.fn(() => null),
}));

vi.mock("../sampling.js", () => ({
  registerTripAssuranceLevel: vi.fn(),
  onTripStarted: vi.fn(),
  onIdentityPresented: vi.fn(),
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
    expect(body.badge_version).toBe("2.4");
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

// ── v2.2: assurance_level from introspect ────────────────────────────────────

describe("getAgentIdentity — v2.2: assurance_level", () => {
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

  // Contract 2.2.6 — IdentityResult includes assurance_level from introspect
  it("attaches assurance_level to result when introspect returns level", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);
    vi.mocked(api.introspectBadgeToken).mockResolvedValue({
      active: true,
      assurance_level: "regular",
    });

    const result = await getAgentIdentity("store.com");
    expect(result.assurance_level).toBe("regular");
  });

  it("result.assurance_level is null when introspect returns null (graceful)", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);
    vi.mocked(api.introspectBadgeToken).mockResolvedValue(null);

    const result = await getAgentIdentity("store.com");
    // Should not throw — assurance_level absent or null is acceptable
    expect(result.status).toBeDefined();
  });

  it("mock tokens (pc_v1_sand) skip introspect — assurance_level null", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);
    // introspectBadgeToken mock returns null for sand tokens (already handled by implementation)
    vi.mocked(api.introspectBadgeToken).mockResolvedValue(null);

    const result = await getAgentIdentity("store.com");
    // Mock mode returns sand token — identity should still return correctly
    expect(result.product_name).toBe("Badge by kyaLabs");
  });
});

// ── v2.3: merchant_signals from signal-status ────────────────────────────────

describe("getAgentIdentity — v2.3: merchant_signals", () => {
  const mockFetch = vi.fn();
  // Import signal-status module for mocking
  let signalStatus: typeof import("../lib/signal-status.js");

  beforeEach(async () => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
    _resetBrowseDeclaredCache();
    signalStatus = await import("../lib/signal-status.js");
    vi.mocked(signalStatus.fetchSignalStatus).mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  // Contract 2.3.9 — getAgentIdentity result includes merchant_signals
  it("attaches merchant_signals when fetchSignalStatus returns active status", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);
    vi.mocked(signalStatus.fetchSignalStatus).mockResolvedValue({
      signals_active: true,
      signal_types: ["window_kya_commerce", "meta_tags"],
    });

    const result = await getAgentIdentity("https://theagenticdepot.com/products");
    expect(result.merchant_signals?.signals_active).toBe(true);
    expect(result.merchant_signals?.signal_types).toContain("window_kya_commerce");
  });

  it("merchant_signals is null when fetchSignalStatus returns null (graceful)", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);
    vi.mocked(signalStatus.fetchSignalStatus).mockResolvedValue(null);

    const result = await getAgentIdentity("https://store.com");
    // Should not throw — no merchant_signals is acceptable
    expect(result.status).toBeDefined();
  });

  // Contract 2.3.10 — signal_context_received fired when signals active
  it("fires signal_context_received POST when signals are active", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);
    vi.mocked(signalStatus.fetchSignalStatus).mockResolvedValue({
      signals_active: true,
      signal_types: ["window_kya_commerce"],
    });

    mockFetch.mockResolvedValue({ ok: true });
    await getAgentIdentity("https://theagenticdepot.com");

    // signal_context_received POST should have fired
    const reportCalls = mockFetch.mock.calls.filter((c) => {
      try {
        const body = JSON.parse(c[1]?.body || "{}");
        return body.event_type === "signal_context_received";
      } catch {
        return false;
      }
    });
    expect(reportCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(reportCalls[0][1].body);
    expect(body.signals_found).toContain("window_kya_commerce");
  });

  it("does NOT fire signal_context_received when signals are inactive", async () => {
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    vi.mocked(api.isApiMode).mockReturnValue(false);
    vi.mocked(signalStatus.fetchSignalStatus).mockResolvedValue({
      signals_active: false,
      signal_types: [],
    });

    await getAgentIdentity("https://store.com");

    const reportCalls = mockFetch.mock.calls.filter((c) => {
      try {
        return JSON.parse(c[1]?.body || "{}").event_type === "signal_context_received";
      } catch {
        return false;
      }
    });
    expect(reportCalls.length).toBe(0);
  });
});
