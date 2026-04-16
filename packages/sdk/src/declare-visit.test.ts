import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BadgeApiError } from "./api/client.js";
import { postDeclareVisit } from "./declare-visit.js";

describe("postDeclareVisit", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends Bearer auth for kya_* tokens", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recorded_as: "declared", session_token: "KYA-123" }),
    });

    const result = await postDeclareVisit("kya_test_123", {
      merchant: "merchant.test",
      runId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.recordedAs).toBe("declared");
    expect(result.sessionToken).toBe("KYA-123");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.kyalabs.io/api/badge/declare",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer kya_test_123",
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("sends Bearer auth for gp_v1_* tokens", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recorded_as: "reported" }),
    });

    const result = await postDeclareVisit("gp_v1_test_123", {
      merchant: "merchant.test",
      runId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.recordedAs).toBe("reported");
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer gp_v1_test_123");
  });

  it("infers addtocart when url contains /cart", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ recorded_as: "declared" }),
    });

    await postDeclareVisit("kya_test_123", {
      merchant: "merchant.test",
      runId: "11111111-1111-4111-8111-111111111111",
      url: "https://merchant.test/cart",
    });

    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({
      context: "addtocart",
      source: "sdk",
    });
  });

  it("returns offline on timeout", async () => {
    const abortError = new Error("timed out");
    abortError.name = "AbortError";
    mockFetch.mockRejectedValue(abortError);

    const result = await postDeclareVisit("kya_test_123", {
      merchant: "merchant.test",
      runId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.recordedAs).toBe("offline");
  });

  it("returns offline on network failure", async () => {
    mockFetch.mockRejectedValue(new Error("network down"));

    const result = await postDeclareVisit("kya_test_123", {
      merchant: "merchant.test",
      runId: "11111111-1111-4111-8111-111111111111",
    });

    expect(result.recordedAs).toBe("offline");
  });

  it("throws when runId is empty", async () => {
    await expect(
      postDeclareVisit("kya_test_123", {
        merchant: "merchant.test",
        runId: "",
      }),
    ).rejects.toThrow("runId is required");
  });

  it("surfaces 4xx responses as BadgeApiError", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ error: "bad request" }),
    });

    await expect(
      postDeclareVisit("kya_test_123", {
        merchant: "merchant.test",
        runId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toBeInstanceOf(BadgeApiError);
  });
});
