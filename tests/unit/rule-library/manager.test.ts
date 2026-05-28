import { describe, it, expect } from "vitest";
import { BlueprintIR } from "../../../src/translator/ir";
import { RuleLibraryManager } from "../../../src/rule-library/manager";

const baseBlueprintIR: BlueprintIR = {
  version: "2.0",
  spatial_anchor: {
    project_name: "test-project",
    surface: "main",
    temporal_anchor: "2026-05-28",
    conventions: ["convention1"],
  },
  personas: [],
  rules: [],
  skills: [],
  hooks: [],
  meta: {
    rule_precedence: [],
    conflict_resolution: "last-write-wins",
    source_backend: "claude",
    target_backend: "cursor",
  },
};

describe("RuleLibraryManager", () => {
  const manager = new RuleLibraryManager();

  it("installs a rule pack", () => {
    const result = manager.installPack(baseBlueprintIR, "gdpr-baseline");
    expect(result.success).toBe(true);
    expect(result.blueprint.rules.length).toBeGreaterThan(
      baseBlueprintIR.rules.length
    );
  });

  it("fails gracefully for unknown pack", () => {
    const result = manager.installPack(baseBlueprintIR, "unknown-pack");
    expect(result.success).toBe(false);
    expect(result.message).toContain("not found");
  });

  it("merges rules without duplicates", () => {
    const bp = {
      ...baseBlueprintIR,
      rules: [
        {
          id: "custom-rule",
          scope: "**/*.ts",
          severity: "soft" as const,
          action: "custom action",
        },
      ],
    };

    const result = manager.installPack(bp, "gdpr-baseline", { merge: true });
    expect(result.success).toBe(true);
    // Should have custom rule + GDPR rules
    expect(result.blueprint.rules.length).toBeGreaterThan(bp.rules.length);
    // custom-rule should still be there
    expect(result.blueprint.rules.some((r) => r.id === "custom-rule")).toBe(
      true
    );
  });

  it("replaces rules with force option", () => {
    const bp = {
      ...baseBlueprintIR,
      rules: [
        {
          id: "existing-rule",
          scope: "**/*.ts",
          severity: "soft" as const,
          action: "existing action",
        },
      ],
    };

    const result = manager.installPack(bp, "gdpr-baseline", { force: true });
    expect(result.success).toBe(true);
    // Should only have GDPR rules, existing-rule should be gone
    expect(result.blueprint.rules.some((r) => r.id === "existing-rule")).toBe(
      false
    );
  });

  it("generates library index", () => {
    const index = manager.generateIndex();
    expect(index.version).toBe("1.0");
    expect(index.timestamp).toBeDefined();
    expect(index.packs.length).toBeGreaterThan(0);
  });

  it("searches packs by name", () => {
    const results = manager.searchPacks("GDPR");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain("GDPR");
  });

  it("searches packs by description", () => {
    const results = manager.searchPacks("compliance");
    expect(results.length).toBeGreaterThan(0);
  });

  it("searches packs by tags", () => {
    const results = manager.searchPacks("gdpr");
    expect(results.length).toBeGreaterThan(0);
  });

  it("gets pack info", () => {
    const info = manager.getPackInfo("gdpr-baseline");
    expect(info).toBeDefined();
    expect(info?.id).toBe("gdpr-baseline");
    expect(info?.rules_count).toBeGreaterThan(0);
  });

  it("returns undefined for unknown pack info", () => {
    const info = manager.getPackInfo("unknown");
    expect(info).toBeUndefined();
  });
});
