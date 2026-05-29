import { describe, expect, it } from "vitest";
import {
  formatGapReport,
  generateGapReport,
  getFrameworkControls,
} from "../../../src/enterprise/compliance-report.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function makeIR(rules: Array<{ id: string; action: string; tags?: string[]; rationale?: string }>): BlueprintIR {
  return {
    spatial_anchor: { project_name: "test-project", description: "test" },
    rules: rules.map((r) => ({
      id: r.id,
      action: r.action,
      tags: r.tags,
      rationale: r.rationale,
      priority: "medium" as const,
      applies_to: [],
    })),
    personas: [],
    skills: [],
    hooks: [],
  } as unknown as BlueprintIR;
}

describe("getFrameworkControls", () => {
  it("returns 5 GDPR controls", () => {
    expect(getFrameworkControls("gdpr")).toHaveLength(5);
  });

  it("returns 4 SOC2 controls", () => {
    expect(getFrameworkControls("soc2")).toHaveLength(4);
  });

  it("returns 4 HIPAA controls", () => {
    expect(getFrameworkControls("hipaa")).toHaveLength(4);
  });

  it("is case-insensitive for framework name", () => {
    expect(getFrameworkControls("GDPR")).toHaveLength(5);
    expect(getFrameworkControls("SOC2")).toHaveLength(4);
  });

  it("returns empty array for unknown framework", () => {
    expect(getFrameworkControls("unknown")).toEqual([]);
  });
});

describe("generateGapReport - GDPR", () => {
  it("reports all missing when no rules", () => {
    const ir = makeIR([]);
    const report = generateGapReport(ir, "gdpr");
    expect(report.framework).toBe("gdpr");
    expect(report.summary.missing).toBe(5);
    expect(report.summary.total_controls).toBe(5);
    expect(report.coverage_percent).toBe(0);
  });

  it("detects coverage via action keyword match", () => {
    const ir = makeIR([
      { id: "r1", action: "Always minimize data collected from users" },
    ]);
    const report = generateGapReport(ir, "gdpr");
    expect(report.summary.missing).toBeLessThan(5);
  });

  it("marks control as automated when rule has rationale", () => {
    const ir = makeIR([
      { id: "r1", action: "minimize data", rationale: "GDPR art-5-1-c requires data minimization" },
    ]);
    const report = generateGapReport(ir, "gdpr");
    const control = report.gaps.find((g) => g.control_id === "art-5-1-c");
    expect(control?.status).toBe("automated");
    expect(report.summary.automated).toBeGreaterThan(0);
  });

  it("marks control as manual when rule matches but has no rationale", () => {
    const ir = makeIR([
      { id: "r1", action: "ensure data minimization" },
    ]);
    const report = generateGapReport(ir, "gdpr");
    const control = report.gaps.find((g) => g.control_id === "art-5-1-c");
    expect(control?.status).toBe("manual");
  });

  it("coverage_percent is between 0 and 100", () => {
    const ir = makeIR([
      { id: "r1", action: "minimize data" },
      { id: "r2", action: "get user consent" },
    ]);
    const report = generateGapReport(ir, "gdpr");
    expect(report.coverage_percent).toBeGreaterThanOrEqual(0);
    expect(report.coverage_percent).toBeLessThanOrEqual(100);
  });

  it("matching_rules lists rule IDs", () => {
    const ir = makeIR([
      { id: "security-rule-1", action: "ensure security of processing" },
    ]);
    const report = generateGapReport(ir, "gdpr");
    const control = report.gaps.find((g) => g.control_id === "art-32");
    expect(control?.matching_rules).toContain("security-rule-1");
  });

  it("tag-based matching works", () => {
    const ir = makeIR([
      { id: "r1", action: "some action", tags: ["consent", "gdpr"] },
    ]);
    const report = generateGapReport(ir, "gdpr");
    const control = report.gaps.find((g) => g.control_id === "art-7");
    expect(control?.status).not.toBe("missing");
  });

  it("provides recommendation for missing controls", () => {
    const ir = makeIR([]);
    const report = generateGapReport(ir, "gdpr");
    for (const gap of report.gaps) {
      expect(gap.recommendation).toBeTruthy();
    }
  });
});

describe("generateGapReport - SOC2", () => {
  it("has correct total_controls", () => {
    const ir = makeIR([]);
    const report = generateGapReport(ir, "soc2");
    expect(report.summary.total_controls).toBe(4);
  });

  it("detects access control coverage", () => {
    const ir = makeIR([
      { id: "r1", action: "enforce access control and authentication" },
    ]);
    const report = generateGapReport(ir, "soc2");
    const cc61 = report.gaps.find((g) => g.control_id === "CC6.1");
    expect(cc61?.status).not.toBe("missing");
  });
});

describe("generateGapReport - HIPAA", () => {
  it("has correct total_controls", () => {
    const ir = makeIR([]);
    const report = generateGapReport(ir, "hipaa");
    expect(report.summary.total_controls).toBe(4);
  });

  it("detects audit control coverage", () => {
    const ir = makeIR([
      { id: "r1", action: "maintain audit log of all actions" },
    ]);
    const report = generateGapReport(ir, "hipaa");
    const control = report.gaps.find((g) => g.control_id === "164.312(b)");
    expect(control?.status).not.toBe("missing");
  });
});

describe("formatGapReport", () => {
  it("includes framework name", () => {
    const ir = makeIR([]);
    const report = generateGapReport(ir, "gdpr");
    const formatted = formatGapReport(report);
    expect(formatted).toContain("GDPR");
  });

  it("includes coverage percentage", () => {
    const ir = makeIR([]);
    const report = generateGapReport(ir, "gdpr");
    const formatted = formatGapReport(report);
    expect(formatted).toContain("%");
  });

  it("includes summary section", () => {
    const ir = makeIR([]);
    const report = generateGapReport(ir, "gdpr");
    const formatted = formatGapReport(report);
    expect(formatted).toContain("Summary");
  });

  it("shows missing icon for missing controls", () => {
    const ir = makeIR([]);
    const report = generateGapReport(ir, "gdpr");
    const formatted = formatGapReport(report);
    expect(formatted).toContain("❌");
  });

  it("shows check icon for automated controls", () => {
    const ir = makeIR([
      { id: "r1", action: "minimize data", rationale: "GDPR requirement" },
    ]);
    const report = generateGapReport(ir, "gdpr");
    const formatted = formatGapReport(report);
    expect(formatted).toContain("✅");
  });
});
