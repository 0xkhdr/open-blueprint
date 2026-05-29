import type { BlueprintIR } from "../translator/ir.js";

export interface GapControl {
  control_id: string;
  description: string;
  status: "automated" | "missing" | "partial" | "manual";
  matching_rules: string[];
  recommendation: string;
}

export interface GapReport {
  framework: string;
  coverage_percent: number;
  gaps: GapControl[];
  summary: {
    total_controls: number;
    automated: number;
    manual: number;
    missing: number;
  };
}

interface FrameworkControl {
  id: string;
  description: string;
  keywords: string[];
}

export function generateGapReport(ir: BlueprintIR, framework: string): GapReport {
  const controls = getFrameworkControls(framework);
  const gaps: GapControl[] = [];
  let automated = 0;
  let manual = 0;
  let missing = 0;

  for (const control of controls) {
    const matchingRules = (ir.rules ?? []).filter((r) => {
      const hasTagMatch = r.tags?.some((t) =>
        control.keywords.some((kw) => t.toLowerCase().includes(kw.toLowerCase()))
      );
      const hasActionMatch = control.keywords.some((kw) =>
        r.action.toLowerCase().includes(kw.toLowerCase())
      );
      return hasTagMatch || hasActionMatch;
    });

    if (matchingRules.length === 0) {
      missing++;
      gaps.push({
        control_id: control.id,
        description: control.description,
        status: "missing",
        matching_rules: [],
        recommendation: `Add rule covering: ${control.description}`,
      });
    } else if (matchingRules.some((r) => r.rationale)) {
      automated++;
      gaps.push({
        control_id: control.id,
        description: control.description,
        status: "automated",
        matching_rules: matchingRules.map((r) => r.id),
        recommendation: "Control is covered with documented rationale.",
      });
    } else {
      manual++;
      gaps.push({
        control_id: control.id,
        description: control.description,
        status: "manual",
        matching_rules: matchingRules.map((r) => r.id),
        recommendation: `Add rationale to rule(s): ${matchingRules.map((r) => r.id).join(", ")}`,
      });
    }
  }

  const total = controls.length;
  const coverage = total > 0 ? ((automated + manual) / total) * 100 : 0;

  return {
    framework,
    coverage_percent: Math.round(coverage * 100) / 100,
    gaps,
    summary: {
      total_controls: total,
      automated,
      manual,
      missing,
    },
  };
}

export function getFrameworkControls(framework: string): FrameworkControl[] {
  const frameworks: Record<string, FrameworkControl[]> = {
    gdpr: [
      {
        id: "art-5-1-c",
        description: "Data minimization — collect only what is necessary",
        keywords: ["minimize", "minimal", "necessary", "data minimization"],
      },
      {
        id: "art-7",
        description: "Conditions for consent — explicit user consent required",
        keywords: ["consent", "user consent", "opt-in"],
      },
      {
        id: "art-17",
        description: "Right to erasure — users can request deletion",
        keywords: ["delete", "erasure", "forget", "removal"],
      },
      {
        id: "art-25",
        description: "Data protection by design and by default",
        keywords: ["privacy", "protection", "design", "default"],
      },
      {
        id: "art-32",
        description: "Security of processing — appropriate technical measures",
        keywords: ["security", "encryption", "access control", "secure"],
      },
    ],
    soc2: [
      {
        id: "CC6.1",
        description: "Logical and physical access controls",
        keywords: ["access", "authentication", "authorization", "rbac"],
      },
      {
        id: "CC6.2",
        description: "Access provisioning and deprovisioning",
        keywords: ["provision", "deprovision", "remove access", "offboard"],
      },
      {
        id: "CC7.1",
        description: "System operations monitoring and detection",
        keywords: ["monitor", "detect", "alert", "log"],
      },
      {
        id: "CC7.2",
        description: "System operations evaluation and response",
        keywords: ["evaluate", "respond", "incident", "review"],
      },
    ],
    hipaa: [
      {
        id: "164.312(a)",
        description: "Access control — unique user identification",
        keywords: ["access", "identity", "authenticate", "user id"],
      },
      {
        id: "164.312(b)",
        description: "Audit controls — hardware, software, procedural mechanisms",
        keywords: ["audit", "log", "audit trail", "record"],
      },
      {
        id: "164.312(c)",
        description: "Integrity — protect ePHI from improper alteration",
        keywords: ["integrity", "hash", "checksum", "tamper"],
      },
      {
        id: "164.312(d)",
        description: "Person or entity authentication — verify identity",
        keywords: ["authenticate", "mfa", "2fa", "verify identity"],
      },
    ],
  };

  return frameworks[framework.toLowerCase()] ?? [];
}

export function formatGapReport(report: GapReport): string {
  const lines: string[] = [];
  lines.push(`# Compliance Gap Report: ${report.framework.toUpperCase()}`);
  lines.push(`**Coverage:** ${report.coverage_percent}%`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Total controls: ${report.summary.total_controls}`);
  lines.push(`- Automated: ${report.summary.automated}`);
  lines.push(`- Manual: ${report.summary.manual}`);
  lines.push(`- Missing: ${report.summary.missing}`);
  lines.push("");
  lines.push("## Control Details");
  lines.push("");

  for (const gap of report.gaps) {
    const icon = gap.status === "automated" ? "✅" : gap.status === "manual" ? "⚠️" : "❌";
    lines.push(`### ${icon} ${gap.control_id}`);
    lines.push(`**Description:** ${gap.description}`);
    lines.push(`**Status:** ${gap.status}`);
    if (gap.matching_rules.length > 0) {
      lines.push(`**Rules:** ${gap.matching_rules.join(", ")}`);
    }
    lines.push(`**Recommendation:** ${gap.recommendation}`);
    lines.push("");
  }

  return lines.join("\n");
}
