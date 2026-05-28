import { describe, it, expect } from "vitest";
import { generateComplianceReport } from "../../../src/validator/compliance.js";
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

describe("Compliance Framework Mapping", () => {
  it("reports empty compliance for IR without frameworks", () => {
    const ir = createBaseIR();
    const report = generateComplianceReport(ir);
    expect(report.frameworks).toHaveLength(0);
    expect(report.overall_score).toBe(0);
  });

  describe("EU AI Act Framework", () => {
    it("passes all checks when risk and audit properly configured", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["eu_ai_act"] },
        risk: { risk_tier: "high", risk_signals: {} },
        audit: { audit_enabled: true },
        settings: { approval_mode: "confirm" },
      };
      const report = generateComplianceReport(ir);
      const euReport = report.frameworks[0];
      expect(euReport?.passing).toBe(euReport?.total);
    });

    it("detects missing risk tier", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["eu_ai_act"] },
        audit: { audit_enabled: true },
      };
      const report = generateComplianceReport(ir);
      const euReport = report.frameworks[0];
      expect(euReport?.gaps.some((g) => g.id === "eu_ai_act_risk_tier")).toBe(true);
    });

    it("detects missing audit logging", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["eu_ai_act"] },
        risk: { risk_tier: "medium", risk_signals: {} },
      };
      const report = generateComplianceReport(ir);
      const euReport = report.frameworks[0];
      expect(euReport?.gaps.some((g) => g.id === "eu_ai_act_audit")).toBe(true);
    });

    it("detects critical risk with auto approval mode", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["eu_ai_act"] },
        risk: { risk_tier: "critical", risk_signals: {} },
        audit: { audit_enabled: true },
        settings: { approval_mode: "auto" },
      };
      const report = generateComplianceReport(ir);
      const euReport = report.frameworks[0];
      expect(euReport?.gaps.some((g) => g.id === "eu_ai_act_approval_mode")).toBe(true);
    });
  });

  describe("ISO 42001 Framework", () => {
    it("requires RBAC enabled with roles", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["iso_42001"] },
        identity: { rbac_enabled: true, roles: [{ name: "admin", permissions: ["read"] }] },
        audit: { retention_days: 90 },
        compliance: { frameworks: ["iso_42001"], certified: true },
      };
      const report = generateComplianceReport(ir);
      const isoReport = report.frameworks[0];
      expect(isoReport?.gaps.some((g) => g.id === "iso_42001_rbac")).toBe(false);
    });

    it("detects missing audit retention policy", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["iso_42001"] },
        identity: { rbac_enabled: true, roles: [{ name: "admin", permissions: ["read"] }] },
      };
      const report = generateComplianceReport(ir);
      const isoReport = report.frameworks[0];
      expect(isoReport?.gaps.some((g) => g.id === "iso_42001_audit_retention")).toBe(true);
    });
  });

  describe("NIST AI RMF Framework", () => {
    it("requires risk signals populated", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["nist_ai_rmf"] },
        risk: {
          risk_tier: "medium",
          risk_signals: {
            has_external_apis: true,
            has_secrets_manager: true,
            has_auth_layer: false,
            has_data_sensitive: false,
          },
        },
        audit: { audit_enabled: true, log_level: "info" },
      };
      const report = generateComplianceReport(ir);
      const nistReport = report.frameworks[0];
      expect(nistReport?.gaps.some((g) => g.id === "nist_ai_rmf_risk_signals")).toBe(false);
    });

    it("requires escalation rules defined", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["nist_ai_rmf"] },
        risk: {
          risk_tier: "medium",
          risk_signals: {
            has_external_apis: true,
            has_secrets_manager: true,
            has_auth_layer: false,
            has_data_sensitive: false,
          },
        },
      };
      const report = generateComplianceReport(ir);
      const nistReport = report.frameworks[0];
      expect(nistReport?.gaps.some((g) => g.id === "nist_ai_rmf_escalation")).toBe(true);
    });
  });

  describe("GDPR Framework", () => {
    it("requires data sensitivity signal", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["gdpr"] },
        risk: {
          risk_tier: "high",
          risk_signals: { has_data_sensitive: true },
        },
        audit: { audit_enabled: true, retention_days: 365 },
      };
      const report = generateComplianceReport(ir);
      const gdprReport = report.frameworks[0];
      expect(gdprReport?.gaps.some((g) => g.id === "gdpr_data_sensitive")).toBe(false);
    });

    it("detects missing data sensitivity signal", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["gdpr"] },
        risk: { risk_tier: "high", risk_signals: { has_data_sensitive: false } },
      };
      const report = generateComplianceReport(ir);
      const gdprReport = report.frameworks[0];
      expect(gdprReport?.gaps.some((g) => g.id === "gdpr_data_sensitive")).toBe(true);
    });
  });

  describe("HIPAA Framework", () => {
    it("requires audit, RBAC, and secrets manager", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["hipaa"] },
        audit: { audit_enabled: true },
        identity: { rbac_enabled: true, roles: [{ name: "admin", permissions: ["read"] }] },
        risk: { risk_tier: "high", risk_signals: { has_secrets_manager: true } },
      };
      const report = generateComplianceReport(ir);
      const hipaaReport = report.frameworks[0];
      expect(hipaaReport?.passing).toBeGreaterThanOrEqual(3);
    });
  });

  describe("SOC 2 Framework", () => {
    it("requires audit and risk classification", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["soc2"] },
        audit: { audit_enabled: true },
        risk: { risk_tier: "medium", risk_signals: {} },
      };
      const report = generateComplianceReport(ir);
      const soc2Report = report.frameworks[0];
      expect(soc2Report?.gaps.some((g) => g.id === "soc2_audit")).toBe(false);
      expect(soc2Report?.gaps.some((g) => g.id === "soc2_risk_tier")).toBe(false);
    });

    it("requires confirm/read-only approval for critical risk", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["soc2"] },
        audit: { audit_enabled: true },
        risk: { risk_tier: "critical", risk_signals: {} },
        settings: { approval_mode: "read-only" },
      };
      const report = generateComplianceReport(ir);
      const soc2Report = report.frameworks[0];
      expect(soc2Report?.gaps.some((g) => g.id === "soc2_approval_mode")).toBe(false);
    });
  });

  describe("Overall Compliance Score", () => {
    it("calculates 0% score with no frameworks", () => {
      const ir = createBaseIR();
      const report = generateComplianceReport(ir);
      expect(report.overall_score).toBe(0);
    });

    it("calculates perfect score when all checks pass", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: {
          frameworks: ["eu_ai_act"],
          certified: true,
        },
        risk: { risk_tier: "high", risk_signals: {} },
        audit: { audit_enabled: true },
        settings: { approval_mode: "confirm" },
      };
      const report = generateComplianceReport(ir);
      expect(report.overall_score).toBe(100);
    });

    it("calculates partial score with some gaps", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["eu_ai_act"] },
        risk: { risk_tier: "high", risk_signals: {} },
        // audit not enabled
        // approval_mode not set
      };
      const report = generateComplianceReport(ir);
      expect(report.overall_score).toBeLessThan(100);
      expect(report.overall_score).toBeGreaterThan(0);
    });

    it("calculates score across multiple frameworks", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["eu_ai_act", "soc2"] },
        risk: { risk_tier: "high", risk_signals: {} },
        audit: { audit_enabled: true },
        settings: { approval_mode: "confirm" },
      };
      const report = generateComplianceReport(ir);
      expect(report.frameworks).toHaveLength(2);
      expect(report.overall_score).toBeGreaterThan(0);
      expect(report.overall_score).toBeLessThanOrEqual(100);
    });
  });

  describe("Compliance Gap Details", () => {
    it("includes remediation steps in gaps", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["eu_ai_act"] },
      };
      const report = generateComplianceReport(ir);
      const euReport = report.frameworks[0];
      if (euReport?.gaps.length) {
        const firstGap = euReport.gaps[0];
        expect(firstGap?.remediation).toBeTruthy();
        expect(firstGap?.description).toBeTruthy();
        expect(firstGap?.id).toBeTruthy();
      }
    });
  });
});
