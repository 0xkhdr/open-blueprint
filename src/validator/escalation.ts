import type { BlueprintIR } from "../translator/ir.js";

export function generateRunbook(ir: BlueprintIR): string {
  const lines: string[] = [];

  const riskTier = ir.risk?.risk_tier || "unknown";
  const severityMap: Record<string, string> = {
    low: "🟢 Low",
    medium: "🟡 Medium",
    high: "🔴 High",
    critical: "🛑 Critical",
    unknown: "❓ Unknown",
  };

  lines.push("# Incident Response Runbook");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(`## Severity Level: ${severityMap[riskTier]}`);
  lines.push("");

  if (riskTier === "critical") {
    lines.push(
      "⚠️ **CRITICAL**: This system requires immediate escalation on detection of incidents."
    );
    lines.push("");
  } else if (riskTier === "high") {
    lines.push(
      "⚠️ **HIGH**: This system requires escalation within 30 minutes of incident detection."
    );
    lines.push("");
  }

  // Escalation contacts
  if (ir.identity?.roles && ir.identity.roles.length > 0) {
    lines.push("## Escalation Contacts");
    lines.push("");
    lines.push("| Role | Permissions | On-Call Status |");
    lines.push("|------|-------------|-----------------|");

    for (const role of ir.identity.roles) {
      const perms = role.permissions?.join(", ") || "none";
      lines.push(`| ${role.name} | ${perms} | [Configure] |`);
    }
    lines.push("");

    if (ir.identity.agent_owner) {
      lines.push(`**Primary Owner**: ${ir.identity.agent_owner}`);
      lines.push("");
    }
  }

  // Response procedure
  lines.push("## Response Procedure");
  lines.push("");

  if (ir.risk?.escalation_rules && ir.risk.escalation_rules.length > 0) {
    let stepNum = 1;
    for (const rule of ir.risk.escalation_rules) {
      lines.push(`### Step ${stepNum}: ${rule.condition || "On Trigger"}`);
      lines.push("");
      lines.push(`**Action**: ${rule.action || "Execute escalation"}`);
      lines.push("");
      stepNum++;
    }
  } else {
    lines.push("### Step 1: Detect Incident");
    lines.push("");
    lines.push("Monitor audit logs for anomalies or violations.");
    lines.push("");

    if (riskTier === "critical") {
      lines.push("### Step 2: Immediate Escalation");
      lines.push("");
      lines.push(
        "Notify on-call engineer and team lead immediately by phone or emergency channel."
      );
      lines.push("");

      lines.push("### Step 3: Isolate System");
      lines.push("");
      lines.push("Take the affected agent offline to prevent further damage.");
      lines.push("");

      lines.push("### Step 4: Document");
      lines.push("");
      lines.push("Create incident ticket with:");
      lines.push("- Timestamp of detection");
      lines.push("- Affected components");
      lines.push("- Initial impact assessment");
      lines.push("");
    } else if (riskTier === "high") {
      lines.push("### Step 2: Notify Team");
      lines.push("");
      lines.push("Alert the incident response team through standard channels.");
      lines.push("");

      lines.push("### Step 3: Assessment");
      lines.push("");
      lines.push("Assess scope and impact of the incident.");
      lines.push("");

      lines.push("### Step 4: Remediation");
      lines.push("");
      lines.push("Execute pre-defined recovery procedure.");
      lines.push("");
    } else {
      lines.push("### Step 2: Investigate");
      lines.push("");
      lines.push("Review logs to understand the issue.");
      lines.push("");

      lines.push("### Step 3: Resolve");
      lines.push("");
      lines.push("Apply fix or workaround.");
      lines.push("");
    }
  }

  // Audit logging
  if (ir.audit?.audit_enabled) {
    lines.push("## Audit Trail");
    lines.push("");

    if (ir.audit.log_level) {
      lines.push(`**Log Level**: ${ir.audit.log_level}`);
    }

    if (ir.audit.retention_days) {
      lines.push(`**Retention Period**: ${ir.audit.retention_days} days`);
    }

    if (ir.audit.compliance_checkpoints && ir.audit.compliance_checkpoints.length > 0) {
      lines.push("");
      lines.push("**Compliance Checkpoints**:");
      for (const checkpoint of ir.audit.compliance_checkpoints) {
        lines.push(`- ${checkpoint}`);
      }
    }

    lines.push("");
    lines.push(
      "All incident response actions must be logged with correlation IDs for full traceability."
    );
    lines.push("");
  }

  // Recovery procedures
  lines.push("## Recovery Procedures");
  lines.push("");
  lines.push("1. **Snapshot current state** for post-incident analysis");
  lines.push("2. **Execute rollback** to last known good configuration");
  lines.push("3. **Verify functionality** of critical features");
  lines.push("4. **Monitor** for 24 hours after recovery");
  lines.push("");

  lines.push("## Communication Plan");
  lines.push("");
  lines.push("- **Internal**: Update incident ticket with status every 15 minutes");
  lines.push("- **Stakeholders**: Notify on estimated resolution time");
  lines.push("- **Post-Incident**: Schedule review within 48 hours");
  lines.push("");

  lines.push("---");
  lines.push("");
  lines.push("*This runbook is automatically generated from blueprint governance configuration.*");
  lines.push(`*Last updated: ${new Date().toISOString()}*`);

  return lines.join("\n");
}
