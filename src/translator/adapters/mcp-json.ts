import type { BlueprintIR } from "../ir.js";

export function generateMCPJson(ir: BlueprintIR): string {
  const mcpServers: Record<string, unknown> = {};

  for (const server of ir.mcp_servers ?? []) {
    const cfg: Record<string, unknown> = {
      command: "npx",
      args: ["-y", server.endpoint],
    };

    if (server.auth_scope?.length) {
      cfg.env = Object.fromEntries(
        server.auth_scope.map((s) => [s.toUpperCase().replace(/\W/g, "_"), `<${s}>`])
      );
    }

    if (server.governance?.permission_validation) {
      cfg.permission_validation = true;
    }
    if (server.governance?.auto_approve?.length) {
      cfg.auto_approve = server.governance.auto_approve;
    }
    if (server.governance?.require_confirmation?.length) {
      cfg.require_confirmation = server.governance.require_confirmation;
    }

    if (server.tool_registry?.length) {
      cfg.tool_registry = server.tool_registry.map((t) => ({
        name: t.tool_name,
        access_level: t.access_level,
        auth_scopes: t.auth_scopes,
        ...(t.risk_level && { risk_level: t.risk_level }),
      }));
    }

    mcpServers[server.name] = cfg;
  }

  return JSON.stringify({ mcpServers }, null, 2);
}
