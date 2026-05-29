import { parseBlueprint } from "../translator/index.js";
import type { BlueprintIR } from "../translator/ir.js";

export async function generateDocs(projectRoot: string): Promise<string> {
  const ir = await parseBlueprint(projectRoot, "claude");
  return generateMarkdownDocs(ir);
}

export function generateMarkdownDocs(ir: BlueprintIR): string {
  let md = `# Governance Documentation: ${ir.spatial_anchor.project_name}\n\n`;
  md += `**Generated:** ${new Date().toISOString()} · **IR Version:** ${ir.meta?.source_backend || "2.0"}\n\n`;

  md += "## Table of Contents\n\n";
  md += "1. [Project Overview](#overview)\n";
  md += "2. [Risk Assessment](#risk)\n";
  md += "3. [Agent Governance](#agents)\n";
  md += "4. [Rule Registry](#rules)\n";
  md += "5. [Skill Registry](#skills)\n";
  md += "6. [Compliance Mapping](#compliance)\n";
  md += "7. [Settings](#settings)\n";
  md += "8. [MCP Servers](#mcp)\n";
  md += "9. [Audit Trail](#audit)\n\n";

  md += "## Project Overview\n\n";
  md += `- **Name:** ${ir.spatial_anchor.project_name}\n`;
  md += `- **Surface:** ${ir.spatial_anchor.surface}\n`;
  md += `- **Temporal Anchor:** ${ir.spatial_anchor.temporal_anchor}\n`;
  if (ir.spatial_anchor.conventions.length > 0) {
    md += `- **Conventions:**\n`;
    for (const c of ir.spatial_anchor.conventions) {
      md += `  - ${c}\n`;
    }
  }
  md += "\n";

  md += "## Risk Assessment\n\n";
  if (ir.risk) {
    md += `- **Tier:** ${ir.risk.risk_tier || "unset"}\n`;
    const signalCount = ir.risk.risk_signals
      ? Object.values(ir.risk.risk_signals).filter(Boolean).length
      : 0;
    md += `- **Active Signals:** ${signalCount}\n`;
    if (ir.risk.risk_signals) {
      md += "- **Signals:**\n";
      for (const [key, value] of Object.entries(ir.risk.risk_signals)) {
        md += `  - ${key}: ${value ? "✅ Yes" : "❌ No"}\n`;
      }
    }
    if (ir.risk.escalation_rules?.length) {
      md += "- **Escalation Rules:**\n";
      for (const rule of ir.risk.escalation_rules) {
        md += `  - ${rule}\n`;
      }
    }
  } else {
    md += "No risk assessment configured.\n";
  }
  md += "\n";

  md += "## Agent Governance\n\n";
  if (ir.personas.length > 0) {
    md += "| Name | Role | Reasoning Style | Allowed Tools |\n";
    md += "|------|------|-----------------|---------------|\n";
    for (const agent of ir.personas) {
      md += `| ${agent.name} | ${agent.role} | ${agent.reasoning_style} | ${agent.allowed_tools?.join(", ") || "All"} |\n`;
    }
  } else {
    md += "No agents configured.\n";
  }
  md += "\n";

  md += "## Rule Registry\n\n";
  if (ir.rules.length > 0) {
    md += "| ID | Scope | Severity | Action |\n";
    md += "|----|-------|----------|--------|\n";
    for (const rule of ir.rules) {
      const action = rule.action.length > 60 ? `${rule.action.substring(0, 60)}...` : rule.action;
      md += `| ${rule.id} | \`${rule.scope}\` | ${rule.severity} | ${action} |\n`;
    }
  } else {
    md += "No rules configured.\n";
  }
  md += "\n";

  md += "## Skill Registry\n\n";
  if (ir.skills.length > 0) {
    md += "| Name | Description | Tools Required |\n";
    md += "|------|-------------|----------------|\n";
    for (const skill of ir.skills) {
      const desc =
        skill.description.length > 60
          ? `${skill.description.substring(0, 60)}...`
          : skill.description;
      md += `| ${skill.name} | ${desc} | ${skill.tools_required?.join(", ") || "None"} |\n`;
    }
  } else {
    md += "No skills configured.\n";
  }
  md += "\n";

  md += "## Compliance Mapping\n\n";
  if (ir.compliance) {
    md += `- **Frameworks:** ${ir.compliance.frameworks?.join(", ") || "None"}\n`;
    md += `- **Certified:** ${ir.compliance.certified ? "✅ Yes" : "❌ No"}\n`;
    if (ir.compliance.compliance_gaps?.length) {
      md += "- **Gaps:**\n";
      for (const gap of ir.compliance.compliance_gaps) {
        md += `  - ${gap.framework}: ${gap.gap}${gap.remediation ? ` (remediation: ${gap.remediation})` : ""}\n`;
      }
    }
  } else {
    md += "No compliance mapping configured.\n";
  }
  md += "\n";

  md += "## Settings\n\n";
  if (ir.settings) {
    md += `- **Approval Mode:** ${ir.settings.approval_mode || "unset"}\n`;
    if (ir.settings.safety_modes?.length) {
      md += `- **Safety Modes:** ${ir.settings.safety_modes.join(", ")}\n`;
    }
    if (ir.settings.model_config) {
      md += `- **Model:** ${ir.settings.model_config.model || "Default"}\n`;
      if (ir.settings.model_config.temperature !== undefined) {
        md += `- **Temperature:** ${ir.settings.model_config.temperature}\n`;
      }
    }
    if (ir.settings.cost_controls) {
      if (ir.settings.cost_controls.monthly_budget_usd !== undefined) {
        md += `- **Monthly Budget:** $${ir.settings.cost_controls.monthly_budget_usd}\n`;
      }
      if (ir.settings.cost_controls.per_session_limit_usd !== undefined) {
        md += `- **Per Session Limit:** $${ir.settings.cost_controls.per_session_limit_usd}\n`;
      }
    }
  } else {
    md += "No settings configured.\n";
  }
  md += "\n";

  md += "## MCP Servers\n\n";
  if (ir.mcp_servers?.length) {
    md += "| Name | Endpoint | Risk Level | Auth Scope |\n";
    md += "|------|----------|------------|------------|\n";
    for (const server of ir.mcp_servers) {
      md += `| ${server.name} | ${server.endpoint || "N/A"} | ${server.risk_level} | ${server.auth_scope?.join(", ") || "None"} |\n`;
    }
  } else {
    md += "No MCP servers configured.\n";
  }
  md += "\n";

  md += "## Audit Trail\n\n";
  if (ir.audit) {
    md += `- **Enabled:** ${ir.audit.audit_enabled ? "✅ Yes" : "❌ No"}\n`;
    md += `- **Log Level:** ${ir.audit.log_level}\n`;
    md += `- **Retention:** ${ir.audit.retention_days} days\n`;
    md += `- **Correlation Format:** ${ir.audit.correlation_id_format}\n`;
  } else {
    md += "No audit configuration.\n";
  }

  return md;
}
