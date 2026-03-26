import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { fetchSignalStatus } from "./signal-status.js";

describe("fetchSignalStatus", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // Contract 2.3.7 — returns SignalStatus on success
  it("returns signals_active and signal_types on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        signals_active: true,
        signal_types: ["window_kya_commerce", "meta_tags"],
      }),
    });

    const result = await fetchSignalStatus("theagenticdepot.com", "https://www.kyalabs.io");
    expect(result?.signals_active).toBe(true);
    expect(result?.signal_types).toContain("window_kya_commerce");
    expect(result?.signal_types).toContain("meta_tags");

    // Verify URL construction
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).toContain("/api/merchant/signal-status");
    expect(url).toContain("domain=theagenticdepot.com");
  });

  it("returns signals_active:false for inactive merchant", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ signals_active: false, signal_types: [] }),
    });

    const result = await fetchSignalStatus("unknown.com", "https://www.kyalabs.io");
    expect(result?.signals_active).toBe(false);
    expect(result?.signal_types).toHaveLength(0);
  });

  // Contract 2.3.8 — graceful null on timeout (does not throw)
  it("returns null on timeout (does not throw)", async () => {
    const abortErr = new Error("AbortError");
    abortErr.name = "AbortError";
    mockFetch.mockRejectedValueOnce(abortErr);

    const result = await fetchSignalStatus("slow.com", "https://www.kyalabs.io");
    expect(result).toBeNull();
  });

  it("returns null on network failure (does not throw)", async () => {
    mockFetch.mockRejectedValueOnce(new Error("network error"));
    const result = await fetchSignalStatus("fail.com", "https://www.kyalabs.io");
    expect(result).toBeNull();
  });

  it("returns null on non-ok HTTP response", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const result = await fetchSignalStatus("missing.com", "https://www.kyalabs.io");
    expect(result).toBeNull();
  });

  it("encodes domain in URL query param", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ signals_active: false, signal_types: [] }),
    });

    await fetchSignalStatus("shop with spaces.com", "https://www.kyalabs.io");
    const [url] = mockFetch.mock.calls[0] as [string];
    expect(url).not.toContain(" ");
    expect(url).toContain("domain=shop%20with%20spaces.com");
  });
});
