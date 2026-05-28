import type { BlueprintIR } from "../translator/ir.js";
import type { ValidationError } from "./structural.js";

function collectKnownAgents(ir: BlueprintIR): Set<string> {
  const agents = new Set<string>();

  for (const team of ir.orchestration?.agent_teams ?? []) {
    agents.add(team.team_name);
    for (const agent of team.agents) {
      agents.add(agent);
    }
  }

  for (const persona of ir.personas ?? []) {
    agents.add(persona.name);
  }

  for (const agent of ir.agent_registry?.agents ?? []) {
    agents.add(agent.name);
  }

  return agents;
}

function validateAgentRegistry(ir: BlueprintIR): ValidationError[] {
  const errors: ValidationError[] = [];
  const registry = ir.agent_registry;

  if (!registry) return errors;

  const names = new Set<string>();

  for (const agent of registry.agents) {
    if (names.has(agent.name)) {
      errors.push({
        file: "agent_registry",
        type: "DUPLICATE_AGENT",
        severity: "error",
        message: `Agent '${agent.name}' appears multiple times in registry`,
        resolution: "Remove duplicate agent entry",
      });
    }
    names.add(agent.name);

    if (agent.eval_status === "certified" && !agent.version) {
      errors.push({
        file: "agent_registry",
        type: "CERTIFIED_NO_VERSION",
        severity: "warning",
        message: `Certified agent '${agent.name}' missing version field`,
        resolution: "Add version field to certified agents",
      });
    }
  }

  return errors;
}

function validateToolRegistry(ir: BlueprintIR): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const server of ir.mcp_servers ?? []) {
    if (!server.tool_registry?.length) continue;

    const toolNames = new Set<string>();

    for (const tool of server.tool_registry) {
      if (toolNames.has(tool.tool_name)) {
        errors.push({
          file: "mcp_servers",
          type: "DUPLICATE_TOOL",
          severity: "error",
          message: `Tool '${tool.tool_name}' appears multiple times in server '${server.name}'`,
          resolution: "Remove duplicate tool entry",
        });
      }
      toolNames.add(tool.tool_name);

      if (tool.access_level === "admin" && !tool.auth_scopes?.length) {
        errors.push({
          file: "mcp_servers",
          type: "ADMIN_TOOL_NO_AUTH",
          severity: "error",
          message: `Admin tool '${tool.tool_name}' in server '${server.name}' must have auth_scopes`,
          resolution: "Add auth_scopes to admin tools",
        });
      }
    }
  }

  return errors;
}

function validateMCPGovernance(ir: BlueprintIR): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const server of ir.mcp_servers ?? []) {
    if (server.risk_level === "high") {
      if (!server.governance?.permission_validation) {
        errors.push({
          file: "mcp_servers",
          type: "HIGH_RISK_NO_GOVERNANCE",
          severity: "warning",
          message: `High-risk MCP server '${server.name}' should have permission_validation enabled`,
          resolution: "Enable permission_validation for high-risk servers",
        });
      }
    }
  }

  return errors;
}

function validateTeams(ir: BlueprintIR): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const team of ir.orchestration?.agent_teams ?? []) {
    if (!team.agents?.length) {
      errors.push({
        file: "orchestration",
        type: "EMPTY_TEAM",
        severity: "warning",
        message: `Agent team '${team.team_name}' has no agents`,
        resolution: "Add agents to team or remove it",
      });
    }

    if (!team.owner || !team.purpose) {
      errors.push({
        file: "orchestration",
        type: "MISSING_TEAM_METADATA",
        severity: "info",
        message: `Agent team '${team.team_name}' missing owner or purpose`,
        resolution: "Add owner and purpose fields to teams for better governance",
      });
    }
  }

  return errors;
}

function validateChains(ir: BlueprintIR): ValidationError[] {
  const errors: ValidationError[] = [];
  const knownAgents = collectKnownAgents(ir);

  for (const chain of ir.orchestration?.agent_chains ?? []) {
    for (const agent of chain.sequence ?? []) {
      if (!knownAgents.has(agent)) {
        errors.push({
          file: "orchestration",
          type: "UNKNOWN_CHAIN_AGENT",
          severity: "warning",
          message: `Chain '${chain.chain_name}' references unknown agent '${agent}'`,
          resolution: "Define agent in personas, teams, or agent_registry",
        });
      }
    }

    if (chain.error_handler && !knownAgents.has(chain.error_handler)) {
      errors.push({
        file: "orchestration",
        type: "UNKNOWN_ERROR_HANDLER",
        severity: "warning",
        message: `Chain '${chain.chain_name}' error_handler references unknown agent '${chain.error_handler}'`,
        resolution: "Define error_handler agent or remove it",
      });
    }
  }

  return errors;
}

function validateMemory(ir: BlueprintIR): ValidationError[] {
  const errors: ValidationError[] = [];
  const memory = ir.orchestration?.persistent_memory;

  if (!memory?.enabled) return errors;

  const knownAgents = collectKnownAgents(ir);

  for (const agent of memory.access_control ?? []) {
    if (!knownAgents.has(agent)) {
      errors.push({
        file: "orchestration",
        type: "UNKNOWN_MEMORY_AGENT",
        severity: "warning",
        message: `Memory access_control references unknown agent '${agent}'`,
        resolution: "Define agent in personas, teams, or agent_registry",
      });
    }
  }

  return errors;
}

function validateCrossAgentComm(ir: BlueprintIR): ValidationError[] {
  const errors: ValidationError[] = [];
  const comm = ir.orchestration?.cross_agent_communication;

  if (!comm) return errors;

  if (comm.inter_agent_validation && !comm.shared_state_schemas) {
    errors.push({
      file: "orchestration",
      type: "VALIDATION_NO_SCHEMAS",
      severity: "warning",
      message: "inter_agent_validation enabled but no shared_state_schemas defined",
      resolution: "Define shared_state_schemas or disable inter_agent_validation",
    });
  }

  return errors;
}

export function validateOrchestration(ir: BlueprintIR): ValidationError[] {
  return [
    ...validateAgentRegistry(ir),
    ...validateToolRegistry(ir),
    ...validateMCPGovernance(ir),
    ...validateTeams(ir),
    ...validateChains(ir),
    ...validateMemory(ir),
    ...validateCrossAgentComm(ir),
  ];
}
