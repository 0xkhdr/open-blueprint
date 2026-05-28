import type { BlueprintIR } from "../translator/ir.js";

export type ComplianceFramework =
  | "eu_ai_act"
  | "iso_42001"
  | "nist_ai_rmf"
  | "gdpr"
  | "hipaa"
  | "soc2";

export interface ComplianceCheckItem {
  id: string;
  description: string;
  remediation: string;
  check: (ir: BlueprintIR) => boolean;
}

export interface ComplianceGap {
  id: string;
  description: string;
  remediation: string;
}

export interface ComplianceFrameworkReport {
  name: ComplianceFramework;
  passing: number;
  total: number;
  gaps: ComplianceGap[];
}

export interface ComplianceReport {
  frameworks: ComplianceFrameworkReport[];
  overall_score: number; // 0-100
}

const FRAMEWORK_CHECKLISTS: Record<ComplianceFramework, ComplianceCheckItem[]> = {
  eu_ai_act: [
    {
      id: "eu_ai_act_risk_tier",
      description: "Risk tier must be classified for EU AI Act compliance",
      remediation: "Set risk.risk_tier to low/medium/high/critical",
      check: (ir) => !!ir.risk?.risk_tier,
    },
    {
      id: "eu_ai_act_audit",
      description: "Audit logging must be enabled for transparency",
      remediation: "Set audit.audit_enabled to true",
      check: (ir) => ir.audit?.audit_enabled === true,
    },
    {
      id: "eu_ai_act_compliance_mapped",
      description: "EU AI Act must be explicitly mapped in compliance framework",
      remediation: "Add 'eu_ai_act' to compliance.frameworks array",
      check: (ir) => ir.compliance?.frameworks?.includes("eu_ai_act") || false,
    },
    {
      id: "eu_ai_act_approval_mode",
      description: "Approval mode must be set for high-risk operations",
      remediation: "Set settings.approval_mode to confirm or read-only for high-risk tier",
      check: (ir) => {
        if (!ir.settings?.approval_mode) return false;
        if (ir.risk?.risk_tier === "critical" && ir.settings.approval_mode === "auto") return false;
        return true;
      },
    },
  ],

  iso_42001: [
    {
      id: "iso_42001_rbac",
      description: "Role-based access control (RBAC) must be implemented",
      remediation: "Set identity.rbac_enabled to true and define roles",
      check: (ir) => ir.identity?.rbac_enabled === true && (ir.identity?.roles?.length || 0) > 0,
    },
    {
      id: "iso_42001_audit_retention",
      description: "Audit retention policy must be defined",
      remediation: "Set audit.retention_days to appropriate value (e.g., 90, 365)",
      check: (ir) => !!ir.audit?.retention_days && ir.audit.retention_days > 0,
    },
    {
      id: "iso_42001_certified",
      description: "Compliance certification status should be tracked",
      remediation: "Set compliance.certified to true once ISO 42001 certification is obtained",
      check: (ir) => ir.compliance?.certified === true,
    },
    {
      id: "iso_42001_identity",
      description: "Identity and access management must be configured",
      remediation: "Define identity layer with RBAC and IAM policies",
      check: (ir) => !!ir.identity,
    },
  ],

  nist_ai_rmf: [
    {
      id: "nist_ai_rmf_risk_signals",
      description: "Risk signals must be populated for NIST RMF assessment",
      remediation: "Ensure risk.risk_signals captures all relevant signals",
      check: (ir) => {
        const signals = ir.risk?.risk_signals;
        if (!signals) return false;
        const hasSignals =
          typeof signals.has_external_apis === "boolean" &&
          typeof signals.has_secrets_manager === "boolean" &&
          typeof signals.has_auth_layer === "boolean" &&
          typeof signals.has_data_sensitive === "boolean";
        return hasSignals;
      },
    },
    {
      id: "nist_ai_rmf_escalation",
      description: "Escalation procedures must be defined",
      remediation: "Add escalation_rules to risk layer",
      check: (ir) => !!ir.risk?.escalation_rules && ir.risk.escalation_rules.length > 0,
    },
    {
      id: "nist_ai_rmf_audit",
      description: "Audit logging must be configured",
      remediation: "Enable audit.audit_enabled and set log_level",
      check: (ir) => ir.audit?.audit_enabled === true && !!ir.audit?.log_level,
    },
    {
      id: "nist_ai_rmf_compliance_mapped",
      description: "NIST AI RMF framework must be in compliance list",
      remediation: "Add 'nist_ai_rmf' to compliance.frameworks",
      check: (ir) => ir.compliance?.frameworks?.includes("nist_ai_rmf") || false,
    },
  ],

  gdpr: [
    {
      id: "gdpr_data_sensitive",
      description: "Data sensitivity must be detected in risk signals",
      remediation: "Ensure risk.risk_signals.has_data_sensitive is true",
      check: (ir) => ir.risk?.risk_signals?.has_data_sensitive === true,
    },
    {
      id: "gdpr_audit",
      description: "Audit logging required for data processing tracking",
      remediation: "Set audit.audit_enabled to true",
      check: (ir) => ir.audit?.audit_enabled === true,
    },
    {
      id: "gdpr_retention",
      description: "Data retention policy must be defined",
      remediation: "Set audit.retention_days to compliance-required value",
      check: (ir) => !!ir.audit?.retention_days && ir.audit.retention_days > 0,
    },
    {
      id: "gdpr_compliance_mapped",
      description: "GDPR must be in compliance framework list",
      remediation: "Add 'gdpr' to compliance.frameworks",
      check: (ir) => ir.compliance?.frameworks?.includes("gdpr") || false,
    },
  ],

  hipaa: [
    {
      id: "hipaa_audit",
      description: "Audit logging required for PHI tracking",
      remediation: "Set audit.audit_enabled to true",
      check: (ir) => ir.audit?.audit_enabled === true,
    },
    {
      id: "hipaa_rbac",
      description: "Role-based access control required for PHI access",
      remediation: "Enable identity.rbac_enabled and define roles",
      check: (ir) => ir.identity?.rbac_enabled === true && (ir.identity?.roles?.length || 0) > 0,
    },
    {
      id: "hipaa_secrets",
      description: "Secrets manager must be present for credential protection",
      remediation: "Ensure risk.risk_signals.has_secrets_manager is true",
      check: (ir) => ir.risk?.risk_signals?.has_secrets_manager === true,
    },
    {
      id: "hipaa_compliance_mapped",
      description: "HIPAA must be in compliance framework list",
      remediation: "Add 'hipaa' to compliance.frameworks",
      check: (ir) => ir.compliance?.frameworks?.includes("hipaa") || false,
    },
  ],

  soc2: [
    {
      id: "soc2_audit",
      description: "Audit logging required for SOC 2 compliance",
      remediation: "Set audit.audit_enabled to true",
      check: (ir) => ir.audit?.audit_enabled === true,
    },
    {
      id: "soc2_risk_tier",
      description: "Risk tier must be classified (not unknown)",
      remediation: "Ensure risk.risk_tier is explicitly set",
      check: (ir) => !!ir.risk?.risk_tier && ir.risk.risk_tier !== "low",
    },
    {
      id: "soc2_approval_mode",
      description: "Approval mode must require confirmation for risky operations",
      remediation: "Set settings.approval_mode to confirm for high-risk systems",
      check: (ir) => {
        if (ir.risk?.risk_tier === "critical") {
          return (
            ir.settings?.approval_mode === "confirm" || ir.settings?.approval_mode === "read-only"
          );
        }
        return true;
      },
    },
    {
      id: "soc2_compliance_mapped",
      description: "SOC 2 must be in compliance framework list",
      remediation: "Add 'soc2' to compliance.frameworks",
      check: (ir) => ir.compliance?.frameworks?.includes("soc2") || false,
    },
  ],
};

export function generateComplianceReport(ir: BlueprintIR): ComplianceReport {
  const frameworks = (ir.compliance?.frameworks || []) as ComplianceFramework[];

  const frameworkReports: ComplianceFrameworkReport[] = [];
  let totalChecksPassing = 0;
  let totalChecks = 0;

  for (const framework of frameworks) {
    const checklist = FRAMEWORK_CHECKLISTS[framework] || [];
    const passing = checklist.filter((item) => item.check(ir)).length;
    const total = checklist.length;
    const gaps: ComplianceGap[] = [];

    for (const item of checklist) {
      if (!item.check(ir)) {
        gaps.push({
          id: item.id,
          description: item.description,
          remediation: item.remediation,
        });
      }
    }

    frameworkReports.push({
      name: framework,
      passing,
      total,
      gaps,
    });

    totalChecksPassing += passing;
    totalChecks += total;
  }

  const overall_score = totalChecks > 0 ? Math.round((totalChecksPassing / totalChecks) * 100) : 0;

  return {
    frameworks: frameworkReports,
    overall_score,
  };
}
