import type { BlueprintIR } from "../translator/ir.js";
import type { ValidationError } from "./structural.js";

function riskToApprovalMode(riskTier: string): string {
  switch (riskTier) {
    case "low":
      return "auto";
    case "medium":
      return "confirm";
    case "high":
    case "critical":
      return "read-only";
    default:
      return "confirm";
  }
}

export function validateSettingsDeep(ir: BlueprintIR, file: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!ir.settings) return errors;

  if (ir.risk?.risk_tier) {
    const expected = riskToApprovalMode(ir.risk.risk_tier);
    if (ir.settings.approval_mode && ir.settings.approval_mode !== expected) {
      errors.push({
        file,
        type: "SETTINGS_RISK_MISMATCH",
        severity: "warning",
        message: `Approval mode '${ir.settings.approval_mode}' does not match risk tier '${ir.risk.risk_tier}' (expected: ${expected})`,
        resolution: `Set approval_mode to '${expected}' or adjust risk tier`,
      });
    }
  }

  if (
    ir.settings.cost_controls?.monthly_budget_usd !== undefined &&
    ir.settings.cost_controls.monthly_budget_usd <= 0
  ) {
    errors.push({
      file,
      type: "INVALID_BUDGET",
      severity: "error",
      message: "monthly_budget_usd must be positive",
      resolution: "Set a value > 0 or remove the field",
    });
  }

  return errors;
}

export function validateCommandsDeep(ir: BlueprintIR, file: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!ir.commands) return errors;

  const names = new Set<string>();
  for (const cmd of ir.commands) {
    if (names.has(cmd.name)) {
      errors.push({
        file,
        type: "DUPLICATE_COMMAND",
        severity: "error",
        message: `Duplicate command name: ${cmd.name}`,
        resolution: "Rename or merge commands",
      });
    }
    names.add(cmd.name);
  }

  return errors;
}

export function validateMCPServersDeep(ir: BlueprintIR, file: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!ir.mcp_servers) return errors;

  for (const server of ir.mcp_servers) {
    if (!server.endpoint && !server.name) {
      errors.push({
        file,
        type: "MCP_SERVER_INCOMPLETE",
        severity: "error",
        message: `MCP server missing required name or endpoint`,
        resolution: "Add endpoint or command configuration",
      });
    }

    if (ir.risk?.risk_tier === "low" && server.risk_level === "high") {
      errors.push({
        file,
        type: "MCP_RISK_MISMATCH",
        severity: "warning",
        message: `Low-risk project has high-risk MCP server: ${server.name}`,
        resolution: "Downgrade server risk_level or upgrade project risk tier",
      });
    }

    const highRiskTools = server.tool_registry?.filter((t) => t.risk_level === "high") ?? [];
    if (highRiskTools.length > 0 && !server.auth_scope?.length) {
      errors.push({
        file,
        type: "MCP_AUTH_MISSING",
        severity: "warning",
        message: `High-risk MCP server '${server.name}' missing auth scopes`,
        resolution: "Add auth_scope to restrict tool access",
      });
    }
  }

  return errors;
}
