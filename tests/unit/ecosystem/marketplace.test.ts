import { describe, expect, it, vi } from "vitest";
import {
  type MarketplaceTemplate,
  searchMarketplace,
} from "../../../src/ecosystem/marketplace-v2.js";

const _mockTemplate: MarketplaceTemplate = {
  name: "@bp-templates/node-api",
  version: "1.2.0",
  author: "testuser",
  official: true,
  downloads: 1000,
  dependencies: [],
  backends: ["claude", "cursor"],
  frameworks: ["express"],
  risk_tiers: ["medium"],
  compliance: ["gdpr"],
  min_bp_version: "1.0.0",
};

describe("searchMarketplace", () => {
  it("surfaces network failures instead of returning empty results", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    await expect(searchMarketplace("node-api")).rejects.toThrow("network error");
    vi.unstubAllGlobals();
  });

  it("throws a descriptive error on non-ok registry response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 503, statusText: "Service Unavailable" })
    );
    await expect(searchMarketplace("bp")).rejects.toThrow("npm registry search failed");
    vi.unstubAllGlobals();
  });

  it("filters by backend", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        objects: [
          {
            package: {
              name: "@bp-templates/a",
              version: "1.0.0",
              keywords: ["backend:claude", "backend:cursor"],
            },
          },
          {
            package: {
              name: "@bp-templates/b",
              version: "1.0.0",
              keywords: ["backend:codex"],
            },
          },
        ],
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await searchMarketplace("bp", { backend: "claude" });
    expect(result.templates.every((t) => t.backends.includes("claude"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("filters by official_only", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        objects: [
          {
            package: { name: "@bp-templates/official", version: "1.0.0", keywords: [] },
          },
          {
            package: { name: "community-pack", version: "1.0.0", keywords: [] },
          },
        ],
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await searchMarketplace("bp", { official_only: true });
    expect(result.templates.every((t) => t.official)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("filters by framework", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        objects: [
          {
            package: {
              name: "@bp-templates/express",
              version: "1.0.0",
              keywords: ["framework:express"],
            },
          },
        ],
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await searchMarketplace("bp", { framework: "express" });
    expect(result.templates.every((t) => t.frameworks.includes("express"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("filters by risk_tier", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        objects: [
          {
            package: {
              name: "@bp-templates/high",
              version: "1.0.0",
              keywords: ["risk:high"],
            },
          },
        ],
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await searchMarketplace("bp", { risk_tier: "high" });
    expect(result.templates.every((t) => t.risk_tiers.includes("high"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("filters by compliance", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        objects: [
          {
            package: {
              name: "@bp-templates/gdpr",
              version: "1.0.0",
              keywords: ["compliance:gdpr"],
            },
          },
        ],
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await searchMarketplace("bp", { compliance: "gdpr" });
    expect(result.templates.every((t) => t.compliance.includes("gdpr"))).toBe(true);
    vi.unstubAllGlobals();
  });

  it("aggregates available backends in filters", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        objects: [
          {
            package: {
              name: "@bp-templates/a",
              version: "1.0.0",
              keywords: ["backend:claude"],
            },
          },
          {
            package: {
              name: "@bp-templates/b",
              version: "1.0.0",
              keywords: ["backend:cursor"],
            },
          },
        ],
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await searchMarketplace("bp");
    expect(result.filters.backends).toContain("claude");
    expect(result.filters.backends).toContain("cursor");
    vi.unstubAllGlobals();
  });

  it("returns total matching template count", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        objects: Array(5).fill({
          package: { name: "@bp-templates/test", version: "1.0.0", keywords: [] },
        }),
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await searchMarketplace("test");
    expect(result.total).toBe(5);
    vi.unstubAllGlobals();
  });

  it("marks @bp-templates packages as official and others as community", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        objects: [
          { package: { name: "@bp-templates/x", version: "1.0.0", keywords: [] } },
          { package: { name: "random-pack", version: "1.0.0", keywords: [] } },
        ],
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await searchMarketplace("bp");
    const official = result.templates.find((t) => t.name === "@bp-templates/x");
    const community = result.templates.find((t) => t.name === "random-pack");
    expect(official?.official).toBe(true);
    expect(community?.official).toBe(false);
    vi.unstubAllGlobals();
  });
});
