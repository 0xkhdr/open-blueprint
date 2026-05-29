import type { BlueprintIR } from "../translator/ir.js";

export function generateEscalationRunbook(ir: BlueprintIR): string {
  const tier = ir.risk?.risk_tier ?? "medium";
  const projectName = ir.spatial_anchor.project_name;

  const lines: string[] = [];
  lines.push(`# Escalation Runbook: ${projectName}`);
  lines.push(`**Risk Tier:** ${tier}`);
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push("");
  lines.push("## Escalation Matrix");
  lines.push("");
  lines.push("| Condition | Action | Contact | Rollback |");
  lines.push("|-----------|--------|---------|----------|");

  if (tier === "critical") {
    lines.push(
      "| Any policy violation | Block + Escalate immediately | CISO | Emergency rollback |"
    );
    lines.push(
      "| Budget overrun > 100% | Block + Alert | Finance + Security | Manual approval required |"
    );
    lines.push(
      "| Secret leak detected | Block + Rotate immediately | Security team | Immediate rotation |"
    );
    lines.push(
      "| Data breach suspected | Lock system + Notify | Legal + CISO + DPO | Full incident response |"
    );
  } else if (tier === "high") {
    lines.push("| Hard rule violation | Block + Alert | Security team | Manual approval |");
    lines.push("| Budget overrun > 80% | Alert | Team lead | Auto |");
    lines.push("| Secret leak detected | Alert + Rotate | Security team | Scheduled rotation |");
    lines.push("| Unauthorized access attempt | Block + Log | Security team | Session revoke |");
  } else if (tier === "medium") {
    lines.push("| Rule violation | Log + Notify | Team lead | Auto |");
    lines.push("| Budget overrun > 100% | Alert | Team lead | Auto |");
    lines.push("| Secret in config detected | Notify | Developer | Rotate next cycle |");
  } else {
    lines.push("| Rule violation | Log | — | Auto |");
    lines.push("| Budget overrun > 100% | Alert | Team lead | Auto |");
  }

  lines.push("");
  lines.push("## Severity Thresholds");
  lines.push("");
  lines.push(getSeverityThresholds(tier));

  lines.push("");
  lines.push("## Response Timelines");
  lines.push("");
  lines.push(getResponseTimelines(tier));

  lines.push("");
  lines.push("## Emergency Contacts");
  lines.push("");
  lines.push("- **Security:** security@company.com");
  lines.push("- **On-call:** oncall@company.com");
  if (tier === "critical" || tier === "high") {
    lines.push("- **CISO:** ciso@company.com");
    lines.push("- **Legal:** legal@company.com");
  }

  lines.push("");
  lines.push("## Post-Incident Checklist");
  lines.push("");
  for (const item of getPostIncidentChecklist(tier)) {
    lines.push(`- [ ] ${item}`);
  }

  return lines.join("\n");
}

function getSeverityThresholds(tier: string): string {
  const thresholds: Record<string, string> = {
    critical:
      "- **Critical:** Any violation triggers immediate block\n- **High:** Auto-escalate within 15 minutes\n- **Medium:** Notify within 1 hour",
    high: "- **Critical:** Escalate within 30 minutes\n- **High:** Notify within 2 hours\n- **Medium:** Log and review daily",
    medium:
      "- **Critical:** Notify within 4 hours\n- **High:** Review within 24 hours\n- **Medium:** Weekly review",
    low: "- **All:** Log and review weekly",
  };
  return thresholds[tier] ?? thresholds.low ?? "";
}

function getResponseTimelines(tier: string): string {
  const timelines: Record<string, string> = {
    critical:
      "| Severity | Response Time | Resolution Target |\n|----------|---------------|-------------------|\n| P0 | 15 min | 2 hours |\n| P1 | 30 min | 4 hours |\n| P2 | 2 hours | 24 hours |",
    high: "| Severity | Response Time | Resolution Target |\n|----------|---------------|-------------------|\n| P0 | 30 min | 4 hours |\n| P1 | 2 hours | 8 hours |\n| P2 | 8 hours | 48 hours |",
    medium:
      "| Severity | Response Time | Resolution Target |\n|----------|---------------|-------------------|\n| P0 | 2 hours | 8 hours |\n| P1 | 8 hours | 24 hours |\n| P2 | 24 hours | 1 week |",
    low: "| Severity | Response Time | Resolution Target |\n|----------|---------------|-------------------|\n| P0 | 4 hours | 24 hours |\n| P1 | 24 hours | 1 week |\n| P2 | 1 week | 1 month |",
  };
  return timelines[tier] ?? timelines.low ?? "";
}

function getPostIncidentChecklist(tier: string): string[] {
  const base = [
    "Document incident timeline",
    "Identify root cause",
    "Apply remediation",
    "Update runbook if needed",
  ];
  const extended = [
    "Notify affected stakeholders",
    "File incident report",
    "Review and update security controls",
    "Schedule post-mortem within 48 hours",
  ];
  const compliance = [
    "Assess regulatory notification requirements",
    "Engage DPO/Legal if PII involved",
    "Preserve evidence for audit trail",
    "Update risk register",
  ];

  if (tier === "critical") return [...base, ...extended, ...compliance];
  if (tier === "high") return [...base, ...extended];
  return base;
}
