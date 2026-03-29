import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./agent-model.js", () => ({
  getAgentModel: vi.fn(() => "claude-desktop"),
}));

vi.mock("./env.js", () => ({
  getEnvApiUrl: vi.fn(() => ""),
}));

import { fireServerPing } from "./server-ping.js";

describe("fireServerPing", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    delete process.env.KYA_PING;
    // VITEST is set by vitest runner — override to allow ping in tests
    delete process.env.VITEST;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    process.env.VITEST = "true";
  });

  it("fires POST to /api/badge/ping with correct payload shape", () => {
    fireServerPing("2.5.0", "badge-mcp");
    vi.advanceTimersByTime(2_000);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe("https://www.kyalabs.io/api/badge/ping");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body);
    expect(body.event).toBe("server_started");
    expect(body.badge_version).toBe("2.5.0");
    expect(body.agent_client).toBe("claude-desktop");
    expect(body.server_type).toBe("badge-mcp");
    expect(body.session_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    );
    expect(body.platform).toBe(process.platform);
    expect(typeof body.timestamp).toBe("number");
  });

  it("sends server_type as null when omitted", () => {
    fireServerPing("2.5.0");
    vi.advanceTimersByTime(2_000);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.server_type).toBeNull();
  });

  it("does not include install_id in payload", () => {
    fireServerPing("2.5.0");
    vi.advanceTimersByTime(2_000);

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.install_id).toBeUndefined();
  });

  it("defers the fetch by 2 seconds", () => {
    fireServerPing("2.5.0");
    expect(mockFetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1_999);
    expect(mockFetch).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("suppressed when KYA_PING=false", () => {
    process.env.KYA_PING = "false";
    fireServerPing("2.5.0");
    vi.advanceTimersByTime(2_000);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("fires when KYA_PING is unset", () => {
    delete process.env.KYA_PING;
    fireServerPing("2.5.0");
    vi.advanceTimersByTime(2_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("fires when KYA_PING is set to any value other than false", () => {
    process.env.KYA_PING = "true";
    fireServerPing("2.5.0");
    vi.advanceTimersByTime(2_000);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not throw when fetch fails", () => {
    mockFetch.mockRejectedValue(new Error("network down"));
    expect(() => fireServerPing("2.5.0")).not.toThrow();
    vi.advanceTimersByTime(2_000);
  });

  it("generates unique session_id per call", () => {
    fireServerPing("2.5.0");
    fireServerPing("2.5.0");
    vi.advanceTimersByTime(2_000);

    const id1 = JSON.parse(mockFetch.mock.calls[0][1].body).session_id;
    const id2 = JSON.parse(mockFetch.mock.calls[1][1].body).session_id;
    expect(id1).not.toBe(id2);
  });
});
