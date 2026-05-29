import { describe, expect, it } from "vitest";
import { generateEscalationRunbook } from "../../../src/enterprise/runbooks.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function makeIR(riskTier?: "low" | "medium" | "high" | "critical"): BlueprintIR {
  return {
    spatial_anchor: { project_name: "my-app", description: "test app" },
    rules: [],
    personas: [],
    skills: [],
    hooks: [],
    risk: riskTier ? { risk_tier: riskTier } : undefined,
  } as unknown as BlueprintIR;
}

describe("generateEscalationRunbook", () => {
  it("includes project name in header", () => {
    const runbook = generateEscalationRunbook(makeIR("medium"));
    expect(runbook).toContain("my-app");
  });

  it("includes risk tier in header", () => {
    const runbook = generateEscalationRunbook(makeIR("high"));
    expect(runbook).toContain("high");
  });

  it("includes generated timestamp", () => {
    const runbook = generateEscalationRunbook(makeIR("medium"));
    expect(runbook).toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it("includes escalation matrix table", () => {
    const runbook = generateEscalationRunbook(makeIR("medium"));
    expect(runbook).toContain("Escalation Matrix");
    expect(runbook).toContain("|");
  });

  it("critical tier includes CISO escalation", () => {
    const runbook = generateEscalationRunbook(makeIR("critical"));
    expect(runbook).toContain("CISO");
  });

  it("critical tier includes emergency rollback", () => {
    const runbook = generateEscalationRunbook(makeIR("critical"));
    expect(runbook).toContain("Emergency rollback");
  });

  it("high tier includes security team", () => {
    const runbook = generateEscalationRunbook(makeIR("high"));
    expect(runbook).toContain("Security team");
  });

  it("medium tier has alert for budget overrun", () => {
    const runbook = generateEscalationRunbook(makeIR("medium"));
    expect(runbook).toContain("Alert");
  });

  it("low tier has minimal escalation", () => {
    const runbook = generateEscalationRunbook(makeIR("low"));
    expect(runbook).toContain("Log");
  });

  it("defaults to medium tier when risk not set", () => {
    const runbook = generateEscalationRunbook(makeIR());
    expect(runbook).toContain("medium");
  });

  it("includes emergency contacts section", () => {
    const runbook = generateEscalationRunbook(makeIR("high"));
    expect(runbook).toContain("Emergency Contacts");
    expect(runbook).toContain("security@company.com");
  });

  it("critical tier has legal contact", () => {
    const runbook = generateEscalationRunbook(makeIR("critical"));
    expect(runbook).toContain("legal@company.com");
  });

  it("low tier does not have legal contact", () => {
    const runbook = generateEscalationRunbook(makeIR("low"));
    expect(runbook).not.toContain("legal@company.com");
  });

  it("includes post-incident checklist", () => {
    const runbook = generateEscalationRunbook(makeIR("medium"));
    expect(runbook).toContain("Post-Incident Checklist");
    expect(runbook).toContain("- [ ]");
  });

  it("critical tier has more checklist items than low", () => {
    const criticalRunbook = generateEscalationRunbook(makeIR("critical"));
    const lowRunbook = generateEscalationRunbook(makeIR("low"));
    const criticalItems = (criticalRunbook.match(/- \[ \]/g) ?? []).length;
    const lowItems = (lowRunbook.match(/- \[ \]/g) ?? []).length;
    expect(criticalItems).toBeGreaterThan(lowItems);
  });

  it("includes severity thresholds section", () => {
    const runbook = generateEscalationRunbook(makeIR("high"));
    expect(runbook).toContain("Severity Thresholds");
  });

  it("includes response timelines table", () => {
    const runbook = generateEscalationRunbook(makeIR("medium"));
    expect(runbook).toContain("Response Timelines");
    expect(runbook).toContain("P0");
  });
});
