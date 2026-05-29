import * as fs from "node:fs";
import * as path from "node:path";

export interface RulePack {
  name: string;
  framework: string;
  version: string;
  rules: Array<{
    id: string;
    scope: string;
    severity: "hard" | "soft";
    action: string;
    rationale: string;
    tags: string[];
  }>;
  skills: Array<{
    name: string;
    description: string;
    when_to_use: string;
  }>;
  compliance_mapping: Array<{
    control_id: string;
    rule_id: string;
    description: string;
  }>;
}

export const BUILTIN_RULE_PACKS: Record<string, RulePack> = {
  gdpr: {
    name: "@bp-rules/gdpr",
    framework: "gdpr",
    version: "1.0.0",
    rules: [
      {
        id: "gdpr-data-minimization",
        scope: "src/**/*",
        severity: "hard",
        action:
          "Only collect and process personal data that is necessary for the specific purpose",
        rationale: "Article 5(1)(c) of GDPR requires data minimization",
        tags: ["gdpr", "art-5-1-c", "privacy"],
      },
      {
        id: "gdpr-consent-management",
        scope: "src/**/*",
        severity: "hard",
        action:
          "Obtain explicit consent before processing personal data. Consent must be freely given, specific, informed, and unambiguous",
        rationale: "Article 7 of GDPR sets conditions for consent",
        tags: ["gdpr", "art-7", "consent"],
      },
      {
        id: "gdpr-right-to-erasure",
        scope: "src/services/**/*",
        severity: "soft",
        action:
          "Implement data deletion endpoints that allow users to request erasure of their personal data",
        rationale: "Article 17 of GDPR grants the right to erasure",
        tags: ["gdpr", "art-17", "deletion"],
      },
      {
        id: "gdpr-data-protection-by-design",
        scope: "src/**/*",
        severity: "soft",
        action:
          "Implement technical and organizational measures to ensure data protection principles are integrated into processing activities",
        rationale: "Article 25 of GDPR requires data protection by design and default",
        tags: ["gdpr", "art-25", "design"],
      },
      {
        id: "gdpr-security-of-processing",
        scope: "src/**/*",
        severity: "hard",
        action:
          "Implement appropriate security measures including encryption, pseudonymization, and regular security assessments",
        rationale: "Article 32 of GDPR requires security of processing",
        tags: ["gdpr", "art-32", "security"],
      },
    ],
    skills: [
      {
        name: "gdpr-audit",
        description: "Perform a GDPR compliance audit on the codebase",
        when_to_use: "When reviewing code for GDPR compliance or before release",
      },
    ],
    compliance_mapping: [
      {
        control_id: "art-5-1-c",
        rule_id: "gdpr-data-minimization",
        description: "Data minimization principle",
      },
      {
        control_id: "art-7",
        rule_id: "gdpr-consent-management",
        description: "Conditions for consent",
      },
      {
        control_id: "art-17",
        rule_id: "gdpr-right-to-erasure",
        description: "Right to erasure",
      },
      {
        control_id: "art-25",
        rule_id: "gdpr-data-protection-by-design",
        description: "Data protection by design",
      },
      {
        control_id: "art-32",
        rule_id: "gdpr-security-of-processing",
        description: "Security of processing",
      },
    ],
  },
  soc2: {
    name: "@bp-rules/soc2",
    framework: "soc2",
    version: "1.0.0",
    rules: [
      {
        id: "soc2-logical-access",
        scope: "src/auth/**/*",
        severity: "hard",
        action: "Implement role-based access control with principle of least privilege",
        rationale: "CC6.1 requires logical access security",
        tags: ["soc2", "CC6.1", "access-control"],
      },
      {
        id: "soc2-access-removal",
        scope: "src/auth/**/*",
        severity: "soft",
        action: "Automatically revoke access when employees leave or change roles",
        rationale: "CC6.2 requires timely access removal",
        tags: ["soc2", "CC6.2", "access-removal"],
      },
      {
        id: "soc2-monitoring",
        scope: "src/logging/**/*",
        severity: "hard",
        action:
          "Log all system operations with timestamps, user IDs, and action details",
        rationale: "CC7.1 requires system operations monitoring",
        tags: ["soc2", "CC7.1", "monitoring"],
      },
    ],
    skills: [
      {
        name: "soc2-audit",
        description: "Perform a SOC 2 compliance audit",
        when_to_use: "Before SOC 2 audit or quarterly review",
      },
    ],
    compliance_mapping: [
      {
        control_id: "CC6.1",
        rule_id: "soc2-logical-access",
        description: "Logical access security",
      },
      {
        control_id: "CC6.2",
        rule_id: "soc2-access-removal",
        description: "Access removal",
      },
      {
        control_id: "CC7.1",
        rule_id: "soc2-monitoring",
        description: "System operations monitoring",
      },
    ],
  },
  hipaa: {
    name: "@bp-rules/hipaa",
    framework: "hipaa",
    version: "1.0.0",
    rules: [
      {
        id: "hipaa-access-control",
        scope: "src/**/*",
        severity: "hard",
        action:
          "Implement unique user identification and emergency access procedures for PHI",
        rationale: "164.312(a) requires access control",
        tags: ["hipaa", "164.312(a)", "phi"],
      },
      {
        id: "hipaa-audit-controls",
        scope: "src/logging/**/*",
        severity: "hard",
        action:
          "Implement hardware, software, and procedural mechanisms to record and examine access to PHI",
        rationale: "164.312(b) requires audit controls",
        tags: ["hipaa", "164.312(b)", "audit"],
      },
      {
        id: "hipaa-integrity",
        scope: "src/**/*",
        severity: "hard",
        action:
          "Implement mechanisms to authenticate and protect PHI from improper alteration or destruction",
        rationale: "164.312(c) requires integrity controls",
        tags: ["hipaa", "164.312(c)", "integrity"],
      },
    ],
    skills: [
      {
        name: "hipaa-audit",
        description: "Perform a HIPAA compliance audit",
        when_to_use: "When handling PHI or before HIPAA assessment",
      },
    ],
    compliance_mapping: [
      {
        control_id: "164.312(a)",
        rule_id: "hipaa-access-control",
        description: "Access control",
      },
      {
        control_id: "164.312(b)",
        rule_id: "hipaa-audit-controls",
        description: "Audit controls",
      },
      {
        control_id: "164.312(c)",
        rule_id: "hipaa-integrity",
        description: "Integrity",
      },
    ],
  },
};

export function installRulePack(packName: string, projectRoot: string): void {
  const pack = BUILTIN_RULE_PACKS[packName];
  if (!pack) {
    throw new Error(
      `Unknown rule pack: ${packName}. Available: ${Object.keys(BUILTIN_RULE_PACKS).join(", ")}`
    );
  }

  const rulesDir = path.join(projectRoot, ".claude", "rules");
  fs.mkdirSync(rulesDir, { recursive: true });

  for (const rule of pack.rules) {
    const ruleContent = generateRuleMarkdown(rule);
    const rulePath = path.join(rulesDir, `${rule.id}.md`);
    fs.writeFileSync(rulePath, ruleContent, "utf-8");
  }

  const skillsDir = path.join(projectRoot, ".claude", "skills");
  fs.mkdirSync(skillsDir, { recursive: true });

  for (const skill of pack.skills) {
    const skillContent = generateSkillMarkdown(skill);
    const skillPath = path.join(skillsDir, `${skill.name}.md`);
    fs.writeFileSync(skillPath, skillContent, "utf-8");
  }
}

export function generateRuleMarkdown(rule: RulePack["rules"][0]): string {
  return `---
scope: "${rule.scope}"
severity: ${rule.severity}
tags: [${rule.tags.map((t) => `"${t}"`).join(", ")}]
---

# ${rule.id}

${rule.action}

## Rationale

${rule.rationale}
`;
}

export function generateSkillMarkdown(skill: RulePack["skills"][0]): string {
  return `---
name: "${skill.name}"
description: "${skill.description}"
when_to_use: "${skill.when_to_use}"
---

# ${skill.name}

${skill.description}

## When to Use

${skill.when_to_use}
`;
}

export function listAvailablePacks(): string[] {
  return Object.keys(BUILTIN_RULE_PACKS);
}

export function getRulePack(packName: string): RulePack | undefined {
  return BUILTIN_RULE_PACKS[packName];
}
