import type { BlueprintIR } from "../ir.js";

export function generateAgentsMD(ir: BlueprintIR): string {
  let content = `# Agents & Governance Configuration

<!-- bp-generated:begin agents-header -->

This document describes the agents and tools available in this blueprint. It is compatible with multiple AI agent platforms including Claude Code, Cursor, OpenDev, Codex, PI Agent, and others.

**Generated:** ${new Date().toISOString()}
**Blueprint Version:** ${ir.version}
**Project:** ${ir.spatial_anchor.project_name}

<!-- bp-generated:end agents-header -->

## Agents & Personas

<!-- bp-generated:begin agents-list -->

`;

  for (const persona of ir.personas) {
    content += `### ${persona.name}\n\n`;
    content += `**Role:** ${persona.role}\n\n`;
    content += `**Reasoning Style:** ${persona.reasoning_style}\n\n`;

    if (persona.allowed_tools && persona.allowed_tools.length > 0) {
      content += `**Allowed Tools:** ${persona.allowed_tools.join(", ")}\n\n`;
    }

    if (persona.constraints.length > 0) {
      content += `**Constraints:**\n`;
      for (const constraint of persona.constraints) {
        content += `- ${constraint}\n`;
      }
      content += `\n`;
    }
  }

  content += `<!-- bp-generated:end agents-list -->

## Governance Rules

<!-- bp-generated:begin rules -->

`;

  for (const rule of ir.rules) {
    const severity = rule.severity === "hard" ? "🔴 Hard" : "🟡 Soft";
    content += `### ${severity}: ${rule.action}\n\n`;
    content += `**ID:** \`${rule.id}\`  \n`;
    content += `**Scope:** ${rule.scope}\n\n`;

    if (rule.rationale) {
      content += `**Rationale:** ${rule.rationale}\n\n`;
    }

    if (rule.tags && rule.tags.length > 0) {
      content += `**Tags:** ${rule.tags.join(", ")}\n\n`;
    }
  }

  content += `<!-- bp-generated:end rules -->

## Skills & Capabilities

<!-- bp-generated:begin skills -->

`;

  for (const skill of ir.skills) {
    content += `### ${skill.name}\n\n`;
    content += `${skill.description}\n\n`;
    content += `**When to Use:** ${skill.when_to_use}\n\n`;

    if (skill.tools_required && skill.tools_required.length > 0) {
      content += `**Tools Required:** ${skill.tools_required.join(", ")}\n\n`;
    }

    content += `**Procedure:**\n`;
    content += `${skill.procedure}\n\n`;
  }

  content += `<!-- bp-generated:end skills -->`;

  if (ir.settings) {
    content += `\n## Settings & Configuration\n\n<!-- bp-generated:begin settings -->\n\n`;

    if (ir.settings.approval_mode) {
      content += `**Approval Mode:** \`${ir.settings.approval_mode}\`\n\n`;
    }

    if (ir.settings.model_config) {
      content += `**Model Configuration:**\n`;
      if (ir.settings.model_config.model) {
        content += `- Model: ${ir.settings.model_config.model}\n`;
      }
      if (ir.settings.model_config.max_tokens) {
        content += `- Max Tokens: ${ir.settings.model_config.max_tokens}\n`;
      }
      if (ir.settings.model_config.temperature !== undefined) {
        content += `- Temperature: ${ir.settings.model_config.temperature}\n`;
      }
      content += `\n`;
    }

    if (ir.settings.cost_controls) {
      content += `**Cost Controls:**\n`;
      if (ir.settings.cost_controls.monthly_budget_usd) {
        content += `- Monthly Budget: $${ir.settings.cost_controls.monthly_budget_usd}\n`;
      }
      if (ir.settings.cost_controls.per_session_limit_usd) {
        content += `- Per-Session Limit: $${ir.settings.cost_controls.per_session_limit_usd}\n`;
      }
      content += `\n`;
    }

    if (ir.settings.safety_modes && ir.settings.safety_modes.length > 0) {
      content += `**Safety Modes:** ${ir.settings.safety_modes.join(", ")}\n\n`;
    }

    content += `<!-- bp-generated:end settings -->`;
  }

  if (ir.risk) {
    content += `\n## Risk Assessment\n\n<!-- bp-generated:begin risk -->\n\n`;

    if (ir.risk.risk_tier) {
      const tierEmoji = {
        low: "🟢",
        medium: "🟡",
        high: "🔴",
        critical: "🔴🔴",
      }[ir.risk.risk_tier];
      content += `**Risk Tier:** ${tierEmoji} ${ir.risk.risk_tier.toUpperCase()}\n\n`;
    }

    if (ir.risk.risk_signals) {
      content += `**Risk Signals:**\n`;
      if (ir.risk.risk_signals.has_external_apis) {
        content += `- Has External APIs: Yes\n`;
      }
      if (ir.risk.risk_signals.has_secrets_manager) {
        content += `- Has Secrets Manager: Yes\n`;
      }
      if (ir.risk.risk_signals.has_auth_layer) {
        content += `- Has Auth Layer: Yes\n`;
      }
      if (ir.risk.risk_signals.has_data_sensitive) {
        content += `- Handles Sensitive Data: Yes\n`;
      }
      content += `\n`;
    }

    if (ir.risk.escalation_rules && ir.risk.escalation_rules.length > 0) {
      content += `**Escalation Rules:**\n`;
      for (const rule of ir.risk.escalation_rules) {
        content += `- If ${rule.condition}, then ${rule.action}\n`;
      }
      content += `\n`;
    }

    content += `<!-- bp-generated:end risk -->`;
  }

  if (ir.compliance) {
    content += `\n## Compliance Requirements\n\n<!-- bp-generated:begin compliance -->\n\n`;

    if (ir.compliance.frameworks && ir.compliance.frameworks.length > 0) {
      content += `**Applicable Frameworks:** ${ir.compliance.frameworks.join(", ")}\n\n`;
    }

    if (ir.compliance.compliance_gaps && ir.compliance.compliance_gaps.length > 0) {
      content += `**Compliance Gaps:**\n`;
      for (const gap of ir.compliance.compliance_gaps) {
        content += `- ${gap.framework}: ${gap.gap}`;
        if (gap.remediation) {
          content += ` (Remediation: ${gap.remediation})`;
        }
        content += `\n`;
      }
      content += `\n`;
    }

    if (ir.compliance.certified !== undefined) {
      content += `**Certified:** ${ir.compliance.certified ? "Yes" : "No"}\n\n`;
    }

    content += `<!-- bp-generated:end compliance -->`;
  }

  if (ir.orchestration || ir.agent_registry || ir.mcp_servers) {
    content += `\n## Orchestration & Multi-Agent Coordination\n\n<!-- bp-generated:begin orchestration -->\n\n`;

    if (ir.orchestration?.agent_teams && ir.orchestration.agent_teams.length > 0) {
      content += `**Agent Teams:**\n`;
      for (const team of ir.orchestration.agent_teams) {
        content += `- **${team.team_name}**: ${team.agents.join(", ")}`;
        if (team.owner || team.purpose) content += ` (Owner: ${team.owner}, Purpose: ${team.purpose})`;
        content += `\n`;
      }
      content += `\n`;
    }

    if (ir.orchestration?.agent_chains && ir.orchestration.agent_chains.length > 0) {
      content += `**Agent Chains:**\n`;
      for (const chain of ir.orchestration.agent_chains) {
        const mode = chain.parallel_mode ? "(Parallel)" : "(Sequential)";
        content += `- **${chain.chain_name}** ${mode}: ${chain.sequence.join(" → ")}`;
        if (chain.timeout_ms) content += ` [Timeout: ${chain.timeout_ms}ms]`;
        content += `\n`;
      }
      content += `\n`;
    }

    if (ir.agent_registry?.agents && ir.agent_registry.agents.length > 0) {
      content += `**Agent Registry:**\n\n`;
      content += `| Name | Owner | Purpose | Risk Tier | Status |\n`;
      content += `|------|-------|---------|-----------|--------|\n`;
      for (const agent of ir.agent_registry.agents) {
        const risk = agent.risk_tier || "unspecified";
        const status = agent.eval_status || "untested";
        content += `| ${agent.name} | ${agent.owner} | ${agent.purpose} | ${risk} | ${status} |\n`;
      }
      content += `\n`;
    }

    if (ir.mcp_servers && ir.mcp_servers.length > 0) {
      content += `**MCP Servers & Tools:**\n\n`;
      for (const server of ir.mcp_servers) {
        content += `- **${server.name}** (${server.endpoint})`;
        if (server.risk_level) content += ` [Risk: ${server.risk_level}]`;
        content += `\n`;
        if (server.tool_registry && server.tool_registry.length > 0) {
          for (const tool of server.tool_registry) {
            content += `  - ${tool.tool_name} (Access: ${tool.access_level})\n`;
          }
        }
      }
      content += `\n`;
    }

    if (ir.orchestration?.cross_agent_communication) {
      const comm = ir.orchestration.cross_agent_communication;
      content += `**Cross-Agent Communication:**\n`;
      if (comm.communication_protocol) {
        content += `- Protocol: ${comm.communication_protocol}\n`;
      }
      if (comm.inter_agent_validation) {
        content += `- Inter-Agent Validation: Enabled\n`;
      }
      content += `\n`;
    }

    if (ir.orchestration?.persistent_memory?.enabled) {
      content += `**Persistent Memory:** Enabled\n`;
      if (ir.orchestration.persistent_memory.retention_policy) {
        content += `- Retention Policy: ${ir.orchestration.persistent_memory.retention_policy}\n`;
      }
      if (ir.orchestration.persistent_memory.encryption) {
        content += `- Encryption: Enabled\n`;
      }
      content += `\n`;
    }

    content += `<!-- bp-generated:end orchestration -->`;
  }

  content += `\n`;

  return content;
}
