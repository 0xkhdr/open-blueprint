import type { MCPServer } from "../translator/ir.js";

export interface MCPRiskScore {
  score: number;
  max: number;
  tier: "low" | "medium" | "high" | "critical";
}

export function scoreMCPServer(server: MCPServer): MCPRiskScore {
  let score = 0;
  const max = 10;

  for (const tool of server.tool_registry ?? []) {
    switch (tool.risk_level) {
      case "low":
        score += 1;
        break;
      case "medium":
        score += 2;
        break;
      case "high":
        score += 3;
        break;
    }
  }

  if (!server.auth_scope?.length) score += 2;

  // auto_approve non-empty = approval not required
  if ((server.governance?.auto_approve?.length ?? 0) > 0) score += 2;

  // data sensitivity via server risk_level
  if (server.risk_level === "high") score += 2;

  const tier = score >= 8 ? "critical" : score >= 5 ? "high" : score >= 3 ? "medium" : "low";
  return { score, max, tier };
}

export interface MCPRiskReport {
  server: string;
  endpoint: string;
  score: MCPRiskScore;
  toolCount: number;
  hasAuth: boolean;
  requiresConfirmation: boolean;
  issues: string[];
}

export function generateMCPRiskReport(servers: MCPServer[]): MCPRiskReport[] {
  return servers.map((server) => {
    const score = scoreMCPServer(server);
    const issues: string[] = [];

    if (!server.auth_scope?.length) {
      issues.push("No auth_scope defined — unrestricted access");
    }
    if ((server.governance?.auto_approve?.length ?? 0) > 0) {
      issues.push(
        `${server.governance?.auto_approve?.length} tools auto-approved without confirmation`
      );
    }
    if (server.risk_level === "high") {
      issues.push("Server risk_level is high — review data access");
    }
    if (!server.tool_registry?.length && server.tools?.length) {
      issues.push("Tools listed but no tool_registry with auth scopes");
    }

    return {
      server: server.name,
      endpoint: server.endpoint,
      score,
      toolCount: (server.tool_registry?.length ?? 0) + (server.tools?.length ?? 0),
      hasAuth: (server.auth_scope?.length ?? 0) > 0,
      requiresConfirmation: (server.governance?.require_confirmation?.length ?? 0) > 0,
      issues,
    };
  });
}
