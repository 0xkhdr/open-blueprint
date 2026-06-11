import type { RulePack } from "./types.js";

// ---------------------------------------------------------------------------
// Built-in compliance packs.
//
// Stage 1 honesty pass: every rule either carries a `check` that is genuinely
// evaluable from static repository state, or is explicitly marked
// `enforcement: "manual"`. No fake checks: a check must verify what the rule
// actually claims (or a clearly-scoped static signal of it, stated in the
// action text). `metadata.coverage` = % of rules with auto enforcement.
// ---------------------------------------------------------------------------

export const GDPR_PACK: RulePack = {
  schema: "bp-pack/1",
  kind: "rules",
  id: "gdpr-baseline",
  name: "GDPR Compliance Baseline",
  version: "1.1.0",
  description: "Essential rules for GDPR compliance (Articles 5, 13, 32, 35)",
  framework: "gdpr",
  author: "open-blueprint",
  tags: ["gdpr", "privacy", "data-protection", "eu"],
  rules: [
    {
      id: "gdpr-consent",
      scope: "**/*.ts",
      severity: "hard",
      action: "require('consent-management' in features)",
      rationale: "Article 7: Explicit consent mechanism required for data processing",
      enforcement: "manual",
    },
    {
      id: "gdpr-data-minimization",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(dataCollected.length <= dataNeeded.length)",
      rationale: "Article 5(1)(c): Only collect data adequate to purpose (data minimization)",
      enforcement: "manual",
    },
    {
      id: "gdpr-retention",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(retentionPolicy !== null)",
      rationale: "Article 5(1)(e): Data kept no longer than necessary (storage limitation)",
      enforcement: "manual",
    },
    {
      id: "gdpr-dpia",
      scope: "**/*.ts",
      severity: "soft",
      action: "require(hasDataProtectionImpactAssessment && riskLevel === 'high')",
      rationale: "Article 35: DPIA required for high-risk processing",
      enforcement: "manual",
    },
    {
      id: "gdpr-encryption",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(encryption === 'aes-256' || encryption === 'tls-1.3')",
      rationale: "Article 32: Encryption required for data in transit and rest",
      // Cipher/TLS configuration is runtime state; not honestly expressible
      // from static repo reads.
      enforcement: "manual",
    },
    {
      id: "gdpr-audit-log",
      scope: "src/**/*.{ts,js}",
      severity: "hard",
      action: "Source must initialize an audit logger (audit-log / auditLog reference present)",
      rationale: "Article 5(2): Accountability demonstrated via audit logs (1 year minimum)",
      check: {
        type: "content-match",
        glob: "src/**/*.{ts,js}",
        pattern: "audit[-_]?log",
        flags: "i",
        scope: "any",
      },
    },
    {
      id: "gdpr-privacy-policy-doc",
      scope: "**/*",
      severity: "soft",
      action: "Repository must contain a PRIVACY.md privacy notice",
      rationale: "Article 13: Privacy information must be available to data subjects",
      check: { type: "file-exists", glob: "PRIVACY.md" },
    },
    {
      id: "gdpr-no-plaintext-http",
      scope: "src/**/*",
      severity: "soft",
      action: "No plaintext http:// endpoints in source (localhost excepted)",
      rationale: "Article 32: static signal for encryption of data in transit",
      check: {
        type: "content-absent",
        glob: "src/**/*.{ts,js}",
        pattern: "[\"'`]http://(?!localhost|127\\.0\\.0\\.1)",
      },
    },
  ],
  metadata: {
    compliance_standard: "EU General Data Protection Regulation (GDPR)",
    coverage: 38, // 3 of 8 rules auto-enforceable
  },
};

export const SOC2_PACK: RulePack = {
  schema: "bp-pack/1",
  kind: "rules",
  id: "soc2-type2",
  name: "SOC 2 Type II Controls",
  version: "1.1.0",
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
      enforcement: "manual",
    },
    {
      id: "soc2-change-management",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(changeApprovalRequired && changeLogEnabled)",
      rationale: "CC7.2: Changes authorized and tested before deployment",
      enforcement: "manual",
    },
    {
      id: "soc2-logging",
      scope: "**/*.ts",
      severity: "hard",
      action: "A structured logging dependency (pino/winston/bunyan/log4js) must be declared",
      rationale: "CC7.1: System activity monitored and logged (90 days minimum)",
      check: {
        type: "anyOf",
        checks: [
          { type: "dependency-present", name: "pino" },
          { type: "dependency-present", name: "winston" },
          { type: "dependency-present", name: "bunyan" },
          { type: "dependency-present", name: "log4js" },
        ],
      },
    },
    {
      id: "soc2-backup",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(backupFrequency <= 24 && backupVerified)",
      rationale: "A1.1: Data backed up and tested for recovery (daily backup required)",
      enforcement: "manual",
    },
    {
      id: "soc2-incident-response",
      scope: "**/*.ts",
      severity: "soft",
      action: "require(incidentPlan && incidentResponseTeam && incidentLog)",
      rationale: "A1.2: Incident identification, containment, and response",
      enforcement: "manual",
    },
    {
      id: "soc2-security-policy",
      scope: "**/*",
      severity: "soft",
      action: "Repository must contain a SECURITY.md security policy",
      rationale: "CC2.2: Security commitments communicated to internal and external users",
      check: { type: "file-exists", glob: "SECURITY.md" },
    },
    {
      id: "soc2-codeowners",
      scope: "**/*",
      severity: "soft",
      action: "Repository must declare code ownership (.github/CODEOWNERS)",
      rationale: "CC7.2: static signal that changes are routed to authorized reviewers",
      check: { type: "file-exists", glob: ".github/CODEOWNERS" },
    },
  ],
  metadata: {
    compliance_standard: "AICPA SOC 2 Type II (Trust Services Criteria)",
    coverage: 43, // 3 of 7 rules auto-enforceable
  },
};

export const HIPAA_PACK: RulePack = {
  schema: "bp-pack/1",
  kind: "rules",
  id: "hipaa-security-rule",
  name: "HIPAA Security Rule",
  version: "1.1.0",
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
      rationale: "§164.312(a)(2)(ii): Encryption and decryption of PHI required",
      enforcement: "manual",
    },
    {
      id: "hipaa-access-control",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(mfa === true && idleTimeout <= 15)",
      rationale: "§164.312(a)(2)(i): Access controls with unique IDs and MFA required",
      enforcement: "manual",
    },
    {
      id: "hipaa-audit-logging",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(auditLogEnabled && auditLogTamperProof && auditLogRetention >= 730)",
      rationale: "§164.312(b): Audit logs for 2 years minimum with integrity controls",
      enforcement: "manual",
    },
    {
      id: "hipaa-breach-notification",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(breachNotificationPlan && hasSecurityIncidentTeam)",
      rationale: "§164.404: Breach notification plan required",
      enforcement: "manual",
    },
    {
      id: "hipaa-workforce-security",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(backgroundCheck && securityAwareness && terminationProc)",
      rationale: "§164.308(a)(3): Workforce security policies and training",
      enforcement: "manual",
    },
    {
      id: "hipaa-security-policy",
      scope: "**/*",
      severity: "soft",
      action: "Repository must contain a SECURITY.md security policy",
      rationale: "§164.316(a): Security policies and procedures must be documented",
      check: { type: "file-exists", glob: "SECURITY.md" },
    },
    {
      id: "hipaa-no-plaintext-http",
      scope: "src/**/*",
      severity: "hard",
      action: "No plaintext http:// endpoints in source (localhost excepted)",
      rationale: "§164.312(e)(1): static signal for transmission security of PHI",
      check: {
        type: "content-absent",
        glob: "src/**/*.{ts,js}",
        pattern: "[\"'`]http://(?!localhost|127\\.0\\.0\\.1)",
      },
    },
    {
      id: "hipaa-no-hardcoded-aws-keys",
      scope: "**/*",
      severity: "hard",
      action: "No hardcoded AWS access key IDs in source",
      rationale: "§164.312(a)(2)(i): credentials must not be embedded in code",
      check: {
        type: "content-absent",
        glob: "src/**/*.{ts,js,py,go}",
        pattern: "AKIA[0-9A-Z]{16}",
      },
    },
  ],
  metadata: {
    compliance_standard: "US HIPAA Security Rule (45 CFR Part 164)",
    coverage: 38, // 3 of 8 rules auto-enforceable
  },
};

export const PCIDSS_PACK: RulePack = {
  schema: "bp-pack/1",
  kind: "rules",
  id: "pcidss-v3-2-1",
  name: "PCI DSS v3.2.1 Requirements",
  version: "1.1.0",
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
      enforcement: "manual",
    },
    {
      id: "pcidss-default-passwords",
      scope: "**/*.ts",
      severity: "hard",
      action: "No hardcoded default passwords (admin/password/123456/default) in source",
      rationale: "Requirement 2: Change default passwords and security settings",
      check: {
        type: "content-absent",
        glob: "src/**/*.{ts,js}",
        pattern: "password\\s*[:=]\\s*[\"'](admin|password|123456|default)[\"']",
        flags: "i",
      },
    },
    {
      id: "pcidss-encryption-transit",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(tlsVersion >= '1.2' && encryption === 'tls-required')",
      rationale: "Requirement 4: Encrypt transmission of card data (TLS 1.2 minimum)",
      // Negotiated TLS version is runtime state; not statically verifiable.
      enforcement: "manual",
    },
    {
      id: "pcidss-access-control",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(rbac && userIdTracking && accessLogging)",
      rationale: "Requirement 7: Restrict access to card data by business need (RBAC)",
      enforcement: "manual",
    },
    {
      id: "pcidss-tracking-monitoring",
      scope: "**/*.ts",
      severity: "hard",
      action: "require(activityLogging && accessLog && secretAccessLog)",
      rationale: "Requirement 10: Track and monitor access to card data",
      enforcement: "manual",
    },
    {
      id: "pcidss-no-card-numbers",
      scope: "**/*",
      severity: "hard",
      action: "No hardcoded primary account numbers (Visa/Mastercard patterns) in source",
      rationale: "Requirement 3: Protect stored cardholder data — PANs must never be in code",
      check: {
        type: "content-absent",
        glob: "src/**/*.{ts,js,py,go}",
        pattern: "\\b(4[0-9]{12}([0-9]{3})?|5[1-5][0-9]{14})\\b",
      },
    },
    {
      id: "pcidss-security-policy",
      scope: "**/*",
      severity: "soft",
      action: "Repository must contain a SECURITY.md security policy",
      rationale: "Requirement 12: Maintain an information security policy",
      check: { type: "file-exists", glob: "SECURITY.md" },
    },
  ],
  metadata: {
    compliance_standard: "PCI Security Standards Council PCI DSS v3.2.1",
    coverage: 43, // 3 of 7 rules auto-enforceable
  },
};

// Export all packs
export const BUILT_IN_PACKS: RulePack[] = [GDPR_PACK, SOC2_PACK, HIPAA_PACK, PCIDSS_PACK];

export function getRulePack(id: string): RulePack | undefined {
  return BUILT_IN_PACKS.find((pack) => pack.id === id);
}

export function getRulePacksByFramework(framework: string): RulePack[] {
  return BUILT_IN_PACKS.filter((pack) => pack.framework === framework);
}

export function listRulePacks(): RulePack[] {
  return [...BUILT_IN_PACKS];
}
