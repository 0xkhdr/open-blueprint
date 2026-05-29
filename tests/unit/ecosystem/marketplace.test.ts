import { describe, expect, it, vi } from "vitest";
import {
  type MarketplaceTemplate,
  getTemplateRatings,
  rateTemplate,
  searchMarketplace,
} from "../../../src/ecosystem/marketplace-v2.js";

const mockTemplate: MarketplaceTemplate = {
  name: "@bp-templates/node-api",
  version: "1.2.0",
  author: "testuser",
  verified: true,
  rating: 4.5,
  downloads: 1000,
  dependencies: [],
  backends: ["claude", "cursor"],
  frameworks: ["express"],
  risk_tiers: ["medium"],
  compliance: ["gdpr"],
  layers: [1, 2, 3],
  min_bp_version: "1.0.0",
};

describe("searchMarketplace", () => {
  it("returns MarketplaceSearchResult shape on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network error")));
    const result = await searchMarketplace("node-api");
    expect(result).toHaveProperty("templates");
    expect(result).toHaveProperty("total");
    expect(result).toHaveProperty("filters");
    expect(Array.isArray(result.templates)).toBe(true);
    vi.unstubAllGlobals();
  });

  it("returns empty templates on fetch failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const result = await searchMarketplace("anything");
    expect(result.templates).toHaveLength(0);
    expect(result.total).toBe(0);
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

  it("filters by verified_only", async () => {
    const mockResponse = {
      ok: true,
      json: async () => ({
        objects: [
          {
            package: { name: "@bp-templates/verified", version: "1.0.0", keywords: [] },
          },
          {
            package: { name: "unverified-pack", version: "1.0.0", keywords: [] },
          },
        ],
      }),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));
    const result = await searchMarketplace("bp", { verified_only: true });
    expect(result.templates.every((t) => t.verified)).toBe(true);
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

  it("handles non-ok response gracefully", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const result = await searchMarketplace("bp");
    expect(result.templates).toHaveLength(0);
    vi.unstubAllGlobals();
  });
});

describe("rateTemplate", () => {
  it("throws on invalid rating < 1", async () => {
    await expect(rateTemplate("some-template", 0, "comment", "token")).rejects.toThrow(
      "Rating must be between 1 and 5"
    );
  });

  it("throws on invalid rating > 5", async () => {
    await expect(rateTemplate("some-template", 6, "comment", "token")).rejects.toThrow(
      "Rating must be between 1 and 5"
    );
  });

  it("throws when API returns non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, statusText: "Unauthorized" })
    );
    await expect(rateTemplate("template", 5, "great", "token")).rejects.toThrow(
      "Failed to submit rating"
    );
    vi.unstubAllGlobals();
  });

  it("succeeds when API returns ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    await expect(rateTemplate("template", 5, "great", "token")).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("sends correct method and content-type", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal("fetch", mockFetch);
    await rateTemplate("tmpl", 4, "good", "mytoken");
    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ method: "POST" })
    );
    vi.unstubAllGlobals();
  });
});

describe("getTemplateRatings", () => {
  it("returns empty array on network failure", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    const ratings = await getTemplateRatings("some-template");
    expect(ratings).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("returns empty array on non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const ratings = await getTemplateRatings("some-template");
    expect(ratings).toEqual([]);
    vi.unstubAllGlobals();
  });

  it("returns ratings array from API", async () => {
    const mockRatings = [
      { user: "alice", rating: 5, comment: "excellent", timestamp: "2026-01-01", version: "1.0.0" },
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => mockRatings })
    );
    const ratings = await getTemplateRatings("some-template");
    expect(ratings).toEqual(mockRatings);
    vi.unstubAllGlobals();
  });
});
