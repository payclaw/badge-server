import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import crypto from "node:crypto";
import {
  getOrCreateInstallId,
  _resetInstallIdCache,
} from "./storage.js";

vi.mock("node:fs");
vi.mock("node:os");
vi.mock("node:crypto", () => ({
  default: { randomUUID: vi.fn(() => "550e8400-e29b-41d4-a716-446655440000") },
  randomUUID: vi.fn(() => "550e8400-e29b-41d4-a716-446655440000"),
}));
vi.mock("./env.js", () => ({
  getEnvApiKey: vi.fn(() => null),
}));

describe("getOrCreateInstallId", () => {
  beforeEach(() => {
    vi.mocked(os.homedir).mockReturnValue("/tmp/test-home");
    _resetInstallIdCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns existing ID when ~/.kya/install_id file exists", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith("install_id") ? true : false
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee" as any
    );

    const id = getOrCreateInstallId();
    expect(id).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(fs.writeFileSync).not.toHaveBeenCalled();
  });

  it("trims whitespace from file content", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith("install_id") ? true : false
    );
    vi.mocked(fs.readFileSync).mockReturnValue(
      "  aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee  \n" as any
    );

    const id = getOrCreateInstallId();
    expect(id).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });

  it("creates new UUID v4 and writes to file when no install_id exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const id = getOrCreateInstallId();
    expect(id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining(".kya"),
      expect.objectContaining({ recursive: true, mode: 0o700 })
    );
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      expect.stringContaining("install_id"),
      "550e8400-e29b-41d4-a716-446655440000",
      expect.objectContaining({ mode: 0o600 })
    );
  });

  it("returns same value on subsequent calls (module-level cache)", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const id1 = getOrCreateInstallId();
    const id2 = getOrCreateInstallId();
    expect(id1).toBe(id2);
    // writeFileSync called only once (first call creates, second is cached)
    expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
  });

  it("generates new ID when file exists but is empty/whitespace", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith("install_id") ? true : false
    );
    vi.mocked(fs.readFileSync).mockReturnValue("   \n" as any);

    const id = getOrCreateInstallId();
    expect(id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it("handles file write failure gracefully — returns UUID from memory", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => {
      throw new Error("EACCES: permission denied");
    });

    // Should NOT throw — returns UUID from memory fallback
    const id = getOrCreateInstallId();
    expect(id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("handles file read error — generates new ID", () => {
    vi.mocked(fs.existsSync).mockImplementation((p) =>
      String(p).endsWith("install_id") ? true : false
    );
    vi.mocked(fs.readFileSync).mockImplementation(() => {
      throw new Error("ENOENT");
    });

    const id = getOrCreateInstallId();
    expect(id).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("returns valid UUID v4 format", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    const id = getOrCreateInstallId();
    const uuidV4Regex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidV4Regex);
  });

  it("[EC-5] NEVER throws — returns UUID even when os.homedir() throws", () => {
    vi.mocked(os.homedir).mockImplementation(() => {
      throw new Error("homedir unavailable");
    });

    // Must NOT throw — returns a valid UUID via memory fallback
    const id = getOrCreateInstallId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("[EC-5] NEVER throws — returns UUID even when os.homedir() returns empty string", () => {
    vi.mocked(os.homedir).mockReturnValue("");
    vi.mocked(fs.existsSync).mockReturnValue(false);
    vi.mocked(fs.mkdirSync).mockImplementation(() => {
      throw new Error("ENOENT: no such file or directory");
    });

    const id = getOrCreateInstallId();
    expect(id).toBeTruthy();
    expect(typeof id).toBe("string");
  });
});
