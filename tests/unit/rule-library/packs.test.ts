import { describe, it, expect } from "vitest";
import {
  GDPR_PACK,
  SOC2_PACK,
  HIPAA_PACK,
  PCIDSS_PACK,
  BUILT_IN_PACKS,
  getRulePack,
  getRulePacksByFramework,
  listRulePacks,
} from "../../../src/rule-library/packs";

describe("Rule Packs", () => {
  it("defines GDPR pack", () => {
    expect(GDPR_PACK).toBeDefined();
    expect(GDPR_PACK.framework).toBe("gdpr");
    expect(GDPR_PACK.rules.length).toBeGreaterThan(0);
  });

  it("defines SOC2 pack", () => {
    expect(SOC2_PACK).toBeDefined();
    expect(SOC2_PACK.framework).toBe("soc2");
    expect(SOC2_PACK.rules.length).toBeGreaterThan(0);
  });

  it("defines HIPAA pack", () => {
    expect(HIPAA_PACK).toBeDefined();
    expect(HIPAA_PACK.framework).toBe("hipaa");
    expect(HIPAA_PACK.rules.length).toBeGreaterThan(0);
  });

  it("defines PCI DSS pack", () => {
    expect(PCIDSS_PACK).toBeDefined();
    expect(PCIDSS_PACK.framework).toBe("pci-dss");
    expect(PCIDSS_PACK.rules.length).toBeGreaterThan(0);
  });

  it("lists all built-in packs", () => {
    expect(BUILT_IN_PACKS).toHaveLength(4);
    expect(BUILT_IN_PACKS).toContain(GDPR_PACK);
    expect(BUILT_IN_PACKS).toContain(SOC2_PACK);
    expect(BUILT_IN_PACKS).toContain(HIPAA_PACK);
    expect(BUILT_IN_PACKS).toContain(PCIDSS_PACK);
  });

  it("retrieves pack by ID", () => {
    const pack = getRulePack("gdpr-baseline");
    expect(pack).toBe(GDPR_PACK);
  });

  it("returns undefined for unknown pack ID", () => {
    const pack = getRulePack("unknown-pack");
    expect(pack).toBeUndefined();
  });

  it("filters packs by framework", () => {
    const gdprPacks = getRulePacksByFramework("gdpr");
    expect(gdprPacks).toHaveLength(1);
    expect(gdprPacks[0].id).toBe("gdpr-baseline");
  });

  it("lists all packs", () => {
    const packs = listRulePacks();
    expect(packs).toHaveLength(BUILT_IN_PACKS.length);
  });

  it("pack rules have required fields", () => {
    for (const pack of BUILT_IN_PACKS) {
      for (const rule of pack.rules) {
        expect(rule.id).toBeDefined();
        expect(rule.scope).toBeDefined();
        expect(rule.severity).toMatch(/^(hard|soft)$/);
        expect(rule.action).toBeDefined();
      }
    }
  });

  it("pack has valid metadata", () => {
    for (const pack of BUILT_IN_PACKS) {
      expect(pack.id).toBeDefined();
      expect(pack.name).toBeDefined();
      expect(pack.version).toBeDefined();
      expect(pack.author).toBeDefined();
      expect(pack.tags).toBeInstanceOf(Array);
      expect(pack.framework).toMatch(
        /^(gdpr|soc2|hipaa|pci-dss|iso-27001|custom)$/
      );
    }
  });
});

describe("Rule Packs — Stage 1 enforcement honesty", () => {
  it("every rule either has a check or is explicitly manual", () => {
    for (const pack of BUILT_IN_PACKS) {
      for (const rule of pack.rules) {
        const hasCheck = rule.check !== undefined;
        const isManual = rule.enforcement === "manual";
        expect(
          hasCheck !== isManual,
          `${pack.id}/${rule.id} must have exactly one of check or enforcement: manual`
        ).toBe(true);
      }
    }
  });

  it("each pack has at least 3 auto-enforceable rules", () => {
    for (const pack of BUILT_IN_PACKS) {
      const auto = pack.rules.filter((r) => r.check !== undefined);
      expect(auto.length, `${pack.id} auto-enforceable rules`).toBeGreaterThanOrEqual(3);
    }
  });

  it("metadata.coverage equals the rounded % of auto-enforceable rules", () => {
    for (const pack of BUILT_IN_PACKS) {
      const auto = pack.rules.filter((r) => r.check !== undefined).length;
      const expected = Math.round((auto / pack.rules.length) * 100);
      expect(pack.metadata?.coverage, `${pack.id} coverage`).toBe(expected);
    }
  });
});
