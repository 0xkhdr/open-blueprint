import { describe, it, expect } from "vitest";
import { generateRunbook } from "../../../src/validator/escalation.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function createBaseIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "test-project",
      surface: "# Test Project",
      temporal_anchor: "2025-05-28",
      conventions: [],
    },
    personas: [],
    rules: [],
    skills: [],
    hooks: [],
    meta: { created_at: "2025-05-28", updated_at: "2025-05-28" },
  };
}

describe("Escalation Runbook Generation", () => {
  it("generates valid markdown for minimal IR", () => {
    const ir = createBaseIR();
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("# Incident Response Runbook");
    expect(runbook).toContain("Severity Level:");
    expect(runbook).toContain("Response Procedure");
  });

  it("includes critical severity header for critical risk", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      risk: { risk_tier: "critical", risk_signals: {} },
    };
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("🛑 Critical");
    expect(runbook).toContain("CRITICAL");
    expect(runbook).toContain("immediate escalation");
  });

  it("includes high severity header for high risk", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      risk: { risk_tier: "high", risk_signals: {} },
    };
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("🔴 High");
    expect(runbook).toContain("30 minutes");
  });

  it("includes medium severity header for medium risk", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      risk: { risk_tier: "medium", risk_signals: {} },
    };
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("🟡 Medium");
  });

  it("includes low severity header for low risk", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      risk: { risk_tier: "low", risk_signals: {} },
    };
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("🟢 Low");
  });

  it("generates escalation contacts from roles", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      identity: {
        rbac_enabled: true,
        agent_owner: "admin@example.com",
        roles: [
          { name: "admin", permissions: ["read", "write"] },
          { name: "oncall", permissions: ["execute"] },
        ],
      },
    };
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("Escalation Contacts");
    expect(runbook).toContain("admin");
    expect(runbook).toContain("oncall");
    expect(runbook).toContain("admin@example.com");
  });

  it("includes custom escalation rules in response procedure", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      risk: {
        risk_tier: "critical",
        risk_signals: {},
        escalation_rules: [
          { condition: "On Detection", action: "Notify on-call team immediately" },
          {
            condition: "Within 5 minutes",
            action: "Engage incident commander",
          },
          { condition: "Within 30 minutes", action: "Declare SEV-1" },
        ],
      },
    };
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("On Detection");
    expect(runbook).toContain("Notify on-call team immediately");
    expect(runbook).toContain("incident commander");
    expect(runbook).toContain("SEV-1");
  });

  it("generates default procedures when no escalation rules defined", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      risk: { risk_tier: "high", risk_signals: {} },
    };
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("Step 1:");
    expect(runbook).toContain("Step 2:");
    expect(runbook).toContain("Notify Team");
    expect(runbook).toContain("Assessment");
  });

  it("includes audit trail section when audit enabled", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      audit: {
        audit_enabled: true,
        log_level: "info",
        retention_days: 365,
        compliance_checkpoints: ["gdpr", "hipaa"],
      },
    };
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("Audit Trail");
    expect(runbook).toContain("Log Level");
    expect(runbook).toContain("Retention Period");
    expect(runbook).toContain("gdpr");
    expect(runbook).toContain("hipaa");
  });

  it("does not include audit trail section when audit disabled", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      audit: { audit_enabled: false },
    };
    const runbook = generateRunbook(ir);
    expect(runbook).not.toContain("Audit Trail");
  });

  it("includes recovery procedures section", () => {
    const ir = createBaseIR();
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("Recovery Procedures");
    expect(runbook).toContain("Snapshot current state");
    expect(runbook).toContain("rollback");
    expect(runbook).toContain("Verify functionality");
    expect(runbook).toContain("Monitor");
  });

  it("includes communication plan", () => {
    const ir = createBaseIR();
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("Communication Plan");
    expect(runbook).toContain("Internal");
    expect(runbook).toContain("Stakeholders");
    expect(runbook).toContain("Post-Incident");
  });

  it("includes timestamp footer", () => {
    const ir = createBaseIR();
    const runbook = generateRunbook(ir);
    expect(runbook).toContain("Last updated:");
    expect(runbook).toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("generates valid markdown syntax", () => {
    const ir: BlueprintIR = {
      ...createBaseIR(),
      risk: { risk_tier: "critical", risk_signals: {} },
      identity: {
        agent_owner: "admin@example.com",
        roles: [{ name: "admin", permissions: ["read"] }],
      },
      audit: {
        audit_enabled: true,
        log_level: "warn",
        retention_days: 90,
      },
    };
    const runbook = generateRunbook(ir);

    // Check for markdown headers
    expect(runbook).toMatch(/^# /m);
    expect(runbook).toMatch(/^## /m);
    expect(runbook).toMatch(/^### /m);

    // Check for markdown tables
    expect(runbook).toContain("|");

    // Check for markdown lists
    expect(runbook).toContain("- ");
  });

  it("different risk tiers produce different procedure steps", () => {
    const criticalRunbook = generateRunbook({
      ...createBaseIR(),
      risk: { risk_tier: "critical", risk_signals: {} },
    });
    const lowRunbook = generateRunbook({
      ...createBaseIR(),
      risk: { risk_tier: "low", risk_signals: {} },
    });

    expect(criticalRunbook).toContain("Immediate Escalation");
    expect(lowRunbook).not.toContain("Immediate Escalation");

    expect(criticalRunbook.length).toBeGreaterThan(lowRunbook.length);
  });
});
