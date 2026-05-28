import type { BlueprintIR } from "../translator/ir.js";

export function generateEnvTemplate(ir: BlueprintIR): string {
  const lines: string[] = ["# Generated .env.template for open-blueprint"];
  lines.push(`# Generated at: ${new Date().toISOString()}`);
  lines.push("");

  const envVars = new Set<string>();

  // Scan MCP servers for auth scopes
  if (ir.mcp_servers && ir.mcp_servers.length > 0) {
    lines.push("# MCP Server Credentials");
    for (const server of ir.mcp_servers) {
      if (server.auth_scope && server.auth_scope.length > 0) {
        for (const scope of server.auth_scope) {
          const envKey = scope
            .toUpperCase()
            .replace(/[^A-Z0-9_]/g, "_");
          if (!envVars.has(envKey)) {
            lines.push(`${envKey}=# ${server.name}: ${scope} credentials`);
            envVars.add(envKey);
          }
        }
      }
    }
    lines.push("");
  }

  // Scan settings for cost controls and model configs
  if (ir.settings) {
    if (ir.settings.cost_controls) {
      lines.push("# Cost Control Settings");
      lines.push("COST_BUDGET_USD=# Monthly spend limit in USD");
      lines.push("COST_ALERT_THRESHOLD=# Alert when spending exceeds this % of budget");
      lines.push("");
    }

    if (ir.settings.model_config) {
      lines.push("# Model Configuration");
      for (const [key] of Object.entries(ir.settings.model_config)) {
        const envKey = `MODEL_${key.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
        if (!envVars.has(envKey)) {
          lines.push(`${envKey}=# Model configuration for ${key}`);
          envVars.add(envKey);
        }
      }
      lines.push("");
    }

    if (ir.settings.safety_modes && ir.settings.safety_modes.length > 0) {
      lines.push("# Safety Mode Configuration");
      for (const mode of ir.settings.safety_modes) {
        const envKey = `SAFETY_${mode.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
        if (!envVars.has(envKey)) {
          lines.push(`${envKey}=# Enable/disable ${mode} safety checks`);
          envVars.add(envKey);
        }
      }
      lines.push("");
    }
  }

  // Scan compliance for framework-specific credentials
  if (ir.compliance && ir.compliance.frameworks) {
    lines.push("# Compliance Framework Credentials");
    for (const framework of ir.compliance.frameworks) {
      switch (framework) {
        case "soc2":
          lines.push("SOC2_AUDIT_LOG_ENDPOINT=# SOC 2 audit logging endpoint");
          envVars.add("SOC2_AUDIT_LOG_ENDPOINT");
          break;
        case "hipaa":
          lines.push("HIPAA_ENCRYPTION_KEY=# HIPAA encryption key");
          lines.push("HIPAA_AUDIT_ENDPOINT=# HIPAA audit logging endpoint");
          envVars.add("HIPAA_ENCRYPTION_KEY");
          envVars.add("HIPAA_AUDIT_ENDPOINT");
          break;
        case "gdpr":
          lines.push("GDPR_DATA_PROCESSOR_ID=# GDPR data processor identifier");
          envVars.add("GDPR_DATA_PROCESSOR_ID");
          break;
        default:
          lines.push(`# ${framework.toUpperCase()} configuration`);
      }
    }
    lines.push("");
  }

  lines.push("# Standard Blueprint Variables");
  lines.push(
    "BP_PROJECT_ROOT=# Root directory of this blueprint (usually '.')"
  );
  lines.push("BP_BACKEND=# Primary backend (claude, cursor, codex, pi, etc.)");
  lines.push(
    "BP_ENVIRONMENT=# Deployment environment (dev, staging, production)"
  );

  return lines.join("\n");
}

export function generateNeverCommitRules(ir: BlueprintIR): string[] {
  const globs: string[] = [];

  // Never commit .env files
  globs.push(".env*");
  globs.push(".env.*.local");

  // Never commit backup/temporary files
  globs.push("*.backup");
  globs.push("*.tmp");
  globs.push("*.bak");

  // Never commit private keys or certificates
  globs.push("**/*.pem");
  globs.push("**/*.key");
  globs.push("**/*.p12");
  globs.push("**/*.pfx");
  globs.push("**/*.jks");

  // Never commit sensitive credentials
  globs.push("**/secrets.json");
  globs.push("**/credentials.json");
  globs.push("**/tokens.json");

  // If HIPAA compliance required, protect PHI directories
  if (ir.compliance?.frameworks?.includes("hipaa")) {
    globs.push("**/*-phi/**");
    globs.push("**/*-pii/**");
    globs.push("**/protected-health/**");
  }

  // If GDPR compliance required, protect PII directories
  if (ir.compliance?.frameworks?.includes("gdpr")) {
    globs.push("**/*-pii/**");
    globs.push("**/*-personal-data/**");
    globs.push("**/user-data/**");
  }

  // Never commit audit logs with sensitive data
  if (ir.audit?.audit_enabled) {
    globs.push(".bp/audit-*.log");
    globs.push(".bp/audit.log");
  }

  // Never commit MCP server credentials
  if (ir.mcp_servers && ir.mcp_servers.length > 0) {
    globs.push("**/.mcp-credentials");
    globs.push("**/.mcp-auth");
  }

  // If RBAC enabled, protect role/policy files
  if (ir.identity?.rbac_enabled) {
    globs.push("**/.rbac-*.json");
    globs.push("**/*.policy.json");
  }

  return globs;
}
