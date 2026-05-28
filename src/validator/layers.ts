import {
  AuditSchema,
  CommandSchema,
  ComplianceSchema,
  IdentitySchema,
  MCPServerSchema,
  OrchestrationSchema,
  RegistrySchema,
  RiskSchema,
  SettingsSchema,
} from "../translator/ir.js";

export interface LayerValidationError {
  layer: string;
  field?: string;
  message: string;
}

export function validateSettings(settings: unknown): LayerValidationError[] {
  const result = SettingsSchema.safeParse(settings);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    layer: "settings",
    field: issue.path.join("."),
    message: `${issue.code}: ${issue.message}`,
  }));
}

export function validateCommands(commands: unknown): LayerValidationError[] {
  if (!Array.isArray(commands)) {
    return [
      {
        layer: "commands",
        message: "Commands must be an array",
      },
    ];
  }

  const errors: LayerValidationError[] = [];
  for (let i = 0; i < commands.length; i++) {
    const result = CommandSchema.safeParse(commands[i]);
    if (!result.success) {
      errors.push(
        ...result.error.issues.map((issue) => ({
          layer: "commands",
          field: `[${i}].${issue.path.join(".")}`,
          message: `${issue.code}: ${issue.message}`,
        }))
      );
    }
  }

  return errors;
}

export function validateMCPServers(mcp_servers: unknown): LayerValidationError[] {
  if (!Array.isArray(mcp_servers)) {
    return [
      {
        layer: "mcp_servers",
        message: "MCP servers must be an array",
      },
    ];
  }

  const errors: LayerValidationError[] = [];
  for (let i = 0; i < mcp_servers.length; i++) {
    const result = MCPServerSchema.safeParse(mcp_servers[i]);
    if (!result.success) {
      errors.push(
        ...result.error.issues.map((issue) => ({
          layer: "mcp_servers",
          field: `[${i}].${issue.path.join(".")}`,
          message: `${issue.code}: ${issue.message}`,
        }))
      );
    }
  }

  return errors;
}

export function validateIdentity(identity: unknown): LayerValidationError[] {
  const result = IdentitySchema.safeParse(identity);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    layer: "identity",
    field: issue.path.join("."),
    message: `${issue.code}: ${issue.message}`,
  }));
}

export function validateAudit(audit: unknown): LayerValidationError[] {
  const result = AuditSchema.safeParse(audit);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    layer: "audit",
    field: issue.path.join("."),
    message: `${issue.code}: ${issue.message}`,
  }));
}

export function validateCompliance(compliance: unknown): LayerValidationError[] {
  const result = ComplianceSchema.safeParse(compliance);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    layer: "compliance",
    field: issue.path.join("."),
    message: `${issue.code}: ${issue.message}`,
  }));
}

export function validateRisk(risk: unknown): LayerValidationError[] {
  const result = RiskSchema.safeParse(risk);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    layer: "risk",
    field: issue.path.join("."),
    message: `${issue.code}: ${issue.message}`,
  }));
}

export function validateRegistry(registry: unknown): LayerValidationError[] {
  const result = RegistrySchema.safeParse(registry);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    layer: "registry",
    field: issue.path.join("."),
    message: `${issue.code}: ${issue.message}`,
  }));
}

export function validateOrchestration(orchestration: unknown): LayerValidationError[] {
  const result = OrchestrationSchema.safeParse(orchestration);
  if (result.success) return [];

  return result.error.issues.map((issue) => ({
    layer: "orchestration",
    field: issue.path.join("."),
    message: `${issue.code}: ${issue.message}`,
  }));
}
