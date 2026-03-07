import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import {
  onTripStarted,
  onIdentityPresented,
  onServerClose,
  resetSamplingState,
  getActiveTrip,
  reportOutcomeFromAgent,
} from "./sampling.js";
import * as storage from "./lib/storage.js";

vi.mock("./lib/storage.js", () => ({
  getStoredConsentKey: vi.fn(),
  storeConsentKey: vi.fn(),
}));

vi.mock("./api/client.js", () => ({
  getBaseUrl: vi.fn().mockReturnValue("https://payclaw.io"),
}));

describe("sampling — multi-merchant trip lifecycle", () => {
  let originalVitest: string | undefined;
  const mockFetch = vi.fn();

  beforeEach(() => {
    originalVitest = process.env.VITEST;
    process.env.VITEST = "true";
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockResolvedValue({ ok: true });
    vi.mocked(storage.getStoredConsentKey).mockReturnValue("pk_test_xxx");
    resetSamplingState();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetSamplingState();
    vi.unstubAllGlobals();
    if (originalVitest !== undefined) {
      process.env.VITEST = originalVitest;
    } else {
      delete process.env.VITEST;
    }
  });

  it("starting trip B resolves presented trip A as agent_moved_to_new_merchant", () => {
    onTripStarted("tok_a", "amazon.com");
    onIdentityPresented("tok_a", "amazon.com");

    // Trip A is active and presented
    expect(getActiveTrip("tok_a")).toBeDefined();
    expect(getActiveTrip("tok_a")!.presented).toBe(true);

    // Start trip B at a different merchant
    onTripStarted("tok_b", "target.com");

    // Trip A should be resolved and evicted (agent moved on)
    expect(getActiveTrip("tok_a")).toBeUndefined();

    // Trip B should be active
    const tripB = getActiveTrip("tok_b");
    expect(tripB).toBeDefined();
    expect(tripB!.merchant).toBe("target.com");
    expect(tripB!.presented).toBe(false);
  });

  it("trip B can be presented and resolved after trip A is auto-resolved", () => {
    onTripStarted("tok_a", "amazon.com");
    onIdentityPresented("tok_a", "amazon.com");
    onTripStarted("tok_b", "target.com");
    onIdentityPresented("tok_b", "target.com");

    const tripB = getActiveTrip("tok_b");
    expect(tripB).toBeDefined();
    expect(tripB!.presented).toBe(true);

    // Resolve trip B via agent report
    reportOutcomeFromAgent("tok_b", "target.com", "accepted");
    expect(getActiveTrip("tok_b")).toBeUndefined();
  });

  it("non-presented trip A is NOT resolved when trip B starts", () => {
    onTripStarted("tok_a", "amazon.com");
    // Never call onIdentityPresented for tok_a
    onTripStarted("tok_b", "target.com");

    // Trip A should still exist (not presented, so agent_moved logic skips it)
    expect(getActiveTrip("tok_a")).toBeDefined();
    expect(getActiveTrip("tok_b")).toBeDefined();
  });

  it("same-merchant trip restart does not resolve existing trip", () => {
    onTripStarted("tok_a", "amazon.com");
    onIdentityPresented("tok_a", "amazon.com");

    // Start another trip at SAME merchant — should NOT resolve trip A
    onTripStarted("tok_b", "amazon.com");

    // Trip A still active (same merchant = not "moved to new merchant")
    expect(getActiveTrip("tok_a")).toBeDefined();
    expect(getActiveTrip("tok_b")).toBeDefined();
  });

  it("three-merchant chain resolves each previous trip correctly", () => {
    onTripStarted("tok_1", "amazon.com");
    onIdentityPresented("tok_1", "amazon.com");

    onTripStarted("tok_2", "target.com");
    expect(getActiveTrip("tok_1")).toBeUndefined(); // resolved
    onIdentityPresented("tok_2", "target.com");

    onTripStarted("tok_3", "walmart.com");
    expect(getActiveTrip("tok_2")).toBeUndefined(); // resolved
    onIdentityPresented("tok_3", "walmart.com");

    // Only tok_3 should remain
    expect(getActiveTrip("tok_3")).toBeDefined();
    expect(getActiveTrip("tok_3")!.merchant).toBe("walmart.com");
  });

  it("reportOutcomeFromAgent falls back to merchant search when token unknown", () => {
    onTripStarted("tok_a", "amazon.com");
    onIdentityPresented("tok_a", "amazon.com");

    // Report with a different token but matching merchant
    reportOutcomeFromAgent("unknown_tok", "amazon.com", "accepted");

    // Trip should be resolved via merchant search fallback
    expect(getActiveTrip("tok_a")).toBeUndefined();
  });

  it("reportOutcomeFromAgent with no matching trip still POSTs to API", () => {
    mockFetch.mockClear();

    reportOutcomeFromAgent("orphan_tok", "orphan.com", "denied");

    // Should have called fetch to POST directly
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toContain("/api/badge/report");
    expect(JSON.parse(opts.body)).toMatchObject({
      verification_token: "orphan_tok",
      merchant: "orphan.com",
      outcome: "denied",
    });
  });

  it("onServerClose resolves all presented trips as inconclusive", () => {
    onTripStarted("tok_a", "amazon.com");
    onIdentityPresented("tok_a", "amazon.com");
    onTripStarted("tok_b", "amazon.com"); // Same merchant — no auto-resolve
    onIdentityPresented("tok_b", "amazon.com");

    onServerClose();

    expect(getActiveTrip("tok_a")).toBeUndefined();
    expect(getActiveTrip("tok_b")).toBeUndefined();
  });

  it("reportOutcomeFromAgent with ambiguous merchant match falls through to API POST", () => {
    mockFetch.mockClear();
    // Two trips at same merchant, both presented
    onTripStarted("tok_a", "amazon.com");
    onIdentityPresented("tok_a", "amazon.com");
    onTripStarted("tok_b", "amazon.com");
    onIdentityPresented("tok_b", "amazon.com");

    mockFetch.mockClear();
    reportOutcomeFromAgent("unknown_tok", "amazon.com", "accepted");

    // Should NOT resolve either trip (ambiguous) — falls through to direct POST
    expect(getActiveTrip("tok_a")).toBeDefined();
    expect(getActiveTrip("tok_b")).toBeDefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain("/api/badge/report");
  });

  it("API report includes correct event_type for outcome", () => {
    mockFetch.mockClear();
    onTripStarted("tok_a", "amazon.com");
    onIdentityPresented("tok_a", "amazon.com");

    // Move to new merchant — resolves trip A as "accepted"
    onTripStarted("tok_b", "target.com");

    // Check the fetch call for trip A resolution
    const reportCalls = mockFetch.mock.calls.filter((c) =>
      String(c[0]).includes("/api/badge/report")
    );
    expect(reportCalls.length).toBeGreaterThanOrEqual(1);
    const body = JSON.parse(reportCalls[0][1].body);
    expect(body.event_type).toBe("trip_success");
    expect(body.detail).toBe("agent_moved_to_new_merchant");
  });
});
