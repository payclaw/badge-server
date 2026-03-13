import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  fetchUCPManifest,
  findBadgeCapability,
  isVersionCompatible,
  _resetManifestCache,
} from "./ucp-manifest.js";

describe("ucp-manifest", () => {
  beforeEach(() => {
    _resetManifestCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const VALID_MANIFEST = {
    capabilities: {
      "io.kyalabs.common.identity": [
        {
          version: "2026-01-11",
          spec: "https://kyalabs.io/ucp/spec/identity",
          schema: "https://kyalabs.io/ucp/schemas/identity.json",
          config: { required: false },
        },
      ],
    },
  };

  describe("fetchUCPManifest", () => {
    it("fetches and returns manifest", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(VALID_MANIFEST), { status: 200 })
      );

      const result = await fetchUCPManifest("https://shop.example.com");
      expect(result).toEqual(VALID_MANIFEST);
    });

    it("caches manifest per domain", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(VALID_MANIFEST), { status: 200 })
      );

      await fetchUCPManifest("https://shop.example.com");
      await fetchUCPManifest("https://shop.example.com");

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("normalizes trailing slash", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response(JSON.stringify(VALID_MANIFEST), { status: 200 })
      );

      await fetchUCPManifest("https://shop.example.com/");
      await fetchUCPManifest("https://shop.example.com");

      expect(fetchMock).toHaveBeenCalledOnce();
    });

    it("returns null on network error", async () => {
      vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network error"));
      const result = await fetchUCPManifest("https://shop.example.com");
      expect(result).toBeNull();
    });

    it("returns null on non-200 response", async () => {
      vi.spyOn(globalThis, "fetch").mockResolvedValue(
        new Response("Not Found", { status: 404 })
      );
      const result = await fetchUCPManifest("https://shop.example.com");
      expect(result).toBeNull();
    });

    it("negative-caches failed fetches", async () => {
      const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("down"));

      await fetchUCPManifest("https://down.example.com");
      await fetchUCPManifest("https://down.example.com");

      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });

  describe("findBadgeCapability", () => {
    it("finds capability in array-wrapped format", () => {
      const result = findBadgeCapability(VALID_MANIFEST);
      expect(result).toEqual({ version: "2026-01-11", required: false, extensionName: "io.kyalabs.common.identity" });
    });

    it("finds capability in plain object format", () => {
      const manifest = {
        capabilities: {
          "io.kyalabs.common.identity": {
            version: "2026-01-11",
            config: { required: true },
          },
        },
      };
      const result = findBadgeCapability(manifest);
      expect(result).toEqual({ version: "2026-01-11", required: true, extensionName: "io.kyalabs.common.identity" });
    });

    it("finds legacy io.payclaw namespace", () => {
      const manifest = {
        capabilities: {
          "io.payclaw.common.identity": [
            { version: "2026-01-11", config: { required: false } },
          ],
        },
      };
      const result = findBadgeCapability(manifest);
      expect(result).toEqual({ version: "2026-01-11", required: false, extensionName: "io.payclaw.common.identity" });
    });

    it("prefers current namespace over legacy", () => {
      const manifest = {
        capabilities: {
          "io.kyalabs.common.identity": [{ version: "2026-01-11" }],
          "io.payclaw.common.identity": [{ version: "2026-01-11" }],
        },
      };
      const result = findBadgeCapability(manifest);
      expect(result?.extensionName).toBe("io.kyalabs.common.identity");
    });

    it("returns null when extension not present", () => {
      const result = findBadgeCapability({ capabilities: {} });
      expect(result).toBeNull();
    });

    it("returns null when no capabilities", () => {
      const result = findBadgeCapability({});
      expect(result).toBeNull();
    });
  });

  describe("isVersionCompatible", () => {
    it("accepts 2026-01-11", () => {
      expect(isVersionCompatible("2026-01-11")).toBe(true);
    });

    it("rejects unknown version", () => {
      expect(isVersionCompatible("2025-01-01")).toBe(false);
    });
  });
});
