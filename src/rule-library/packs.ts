import { Rule } from "../translator/ir.js";
import { RulePack } from "./types.js";

export const GDPR_PACK: RulePack = {
  id: "gdpr-baseline",
  name: "GDPR Compliance Baseline",
  version: "1.0.0",
  description: "Essential rules for GDPR compliance (Articles 5, 32, 35)",
  framework: "gdpr",
  author: "open-blueprint",
  tags: ["gdpr", "privacy", "data-protection", "eu"],
  rules: [
    {
      id: "gdpr-consent",
      scope: "**/*.ts",
      severity: "hard",
      action: "require('consent-management' in features)",
      rationale:
        "Article 7: Explicit consent mechanism required for data processing",
    },
    {
      id: "gdpr-data-minimization",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(dataCollected.length <= dataNeeded.length)",
      rationale:
        "Article 5(1)(c): Only collect data adequate to purpose (data minimization)",
    },
    {
      id: "gdpr-retention",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(retentionPolicy !== null)",
      rationale:
        "Article 5(1)(e): Data kept no longer than necessary (storage limitation)",
    },
    {
      id: "gdpr-dpia",
      scope: "**/*.ts",
      severity: "soft",
      action: "require(hasDataProtectionImpactAssessment && riskLevel === 'high')",
      rationale: "Article 35: DPIA required for high-risk processing",
    },
    {
      id: "gdpr-encryption",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(encryption === 'aes-256' || encryption === 'tls-1.3')",
      rationale: "Article 32: Encryption required for data in transit and rest",
    },
    {
      id: "gdpr-audit-log",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(auditLoggingEnabled && auditLogRetention >= 365)",
      rationale:
        "Article 5(2): Accountability demonstrated via audit logs (1 year minimum)",
    },
  ],
  metadata: {
    compliance_standard: "EU General Data Protection Regulation (GDPR)",
    coverage: 85,
  },
};

export const SOC2_PACK: RulePack = {
  id: "soc2-type2",
  name: "SOC 2 Type II Controls",
  version: "1.0.0",
  description: "Security controls aligned with SOC 2 Type II trust principles",
  framework: "soc2",
  author: "open-blueprint",
  tags: ["soc2", "security", "compliance", "audit"],
  rules: [
    {
      id: "soc2-access-control",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(rbacEnabled && auditEnabled)",
      rationale: "CC6.1: Access control and authorization policies enforced",
    },
    {
      id: "soc2-change-management",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(changeApprovalRequired && changeLogEnabled)",
      rationale: "CC7.2: Changes authorized and tested before deployment",
    },
    {
      id: "soc2-logging",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(loggingEnabled && logRetention >= 90)",
      rationale: "CC7.1: System activity monitored and logged (90 days minimum)",
    },
    {
      id: "soc2-backup",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(backupFrequency <= 24 && backupVerified)",
      rationale:
        "A1.1: Data backed up and tested for recovery (daily backup required)",
    },
    {
      id: "soc2-incident-response",
      scope: "**/*.ts",
      severity: "soft",
      action: "require(incidentPlan && incidentResponseTeam && incidentLog)",
      rationale: "A1.2: Incident identification, containment, and response",
    },
  ],
  metadata: {
    compliance_standard: "AICPA SOC 2 Type II (Trust Services Criteria)",
    coverage: 75,
  },
};

export const HIPAA_PACK: RulePack = {
  id: "hipaa-security-rule",
  name: "HIPAA Security Rule",
  version: "1.0.0",
  description: "Administrative, physical, and technical safeguards for PHI",
  framework: "hipaa",
  author: "open-blueprint",
  tags: ["hipaa", "healthcare", "phi", "security"],
  rules: [
    {
      id: "hipaa-encryption",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(encryption === 'aes-256' && keyManagementHSM)",
      rationale:
        "§164.312(a)(2)(ii): Encryption and decryption of PHI required",
    },
    {
      id: "hipaa-access-control",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(mfa === true && idleTimeout <= 15)",
      rationale:
        "§164.312(a)(2)(i): Access controls with unique IDs and MFA required",
    },
    {
      id: "hipaa-audit-logging",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(auditLogEnabled && auditLogTamperProof && auditLogRetention >= 730)",
      rationale:
        "§164.312(b): Audit logs for 2 years minimum with integrity controls",
    },
    {
      id: "hipaa-breach-notification",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(breachNotificationPlan && hasSecurityIncidentTeam)",
      rationale: "§164.404: Breach notification plan required",
    },
    {
      id: "hipaa-workforce-security",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(backgroundCheck && securityAwareness && terminationProc)",
      rationale: "§164.308(a)(3): Workforce security policies and training",
    },
  ],
  metadata: {
    compliance_standard: "US HIPAA Security Rule (45 CFR Part 164)",
    coverage: 80,
  },
};

export const PCIDSS_PACK: RulePack = {
  id: "pcidss-v3.2.1",
  name: "PCI DSS v3.2.1 Requirements",
  version: "1.0.0",
  description: "Payment Card Industry Data Security Standard controls",
  framework: "pci-dss",
  author: "open-blueprint",
  tags: ["pci-dss", "payment", "card-data", "security"],
  rules: [
    {
      id: "pcidss-firewall",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(firewallEnabled && ingressFilteringEnabled)",
      rationale: "Requirement 1: Install and maintain firewall configuration",
    },
    {
      id: "pcidss-default-passwords",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(noDefaultPasswords && passwordPolicy.minLength >= 7)",
      rationale: "Requirement 2: Change default passwords and security settings",
    },
    {
      id: "pcidss-encryption-transit",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(tlsVersion >= '1.2' && encryption === 'tls-required')",
      rationale:
        "Requirement 4: Encrypt transmission of card data (TLS 1.2 minimum)",
    },
    {
      id: "pcidss-access-control",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(rbac && userIdTracking && accessLogging)",
      rationale:
        "Requirement 7: Restrict access to card data by business need (RBAC)",
    },
    {
      id: "pcidss-tracking-monitoring",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(activityLogging && accessLog && secretAccessLog)",
      rationale: "Requirement 10: Track and monitor access to card data",
    },
  ],
  metadata: {
    compliance_standard: "PCI Security Standards Council PCI DSS v3.2.1",
    coverage: 70,
  },
};

// Export all packs
export const BUILT_IN_PACKS: RulePack[] = [
  GDPR_PACK,
  SOC2_PACK,
  HIPAA_PACK,
  PCIDSS_PACK,
];

export function getRulePack(id: string): RulePack | undefined {
  return BUILT_IN_PACKS.find((pack) => pack.id === id);
}

export function getRulePacksByFramework(
  framework: string
): RulePack[] {
  return BUILT_IN_PACKS.filter((pack) => pack.framework === framework);
}

export function listRulePacks(): RulePack[] {
  return [...BUILT_IN_PACKS];
}
