import { describe, expect, it } from "vitest";
import {
  generateMCPRiskReport,
  scoreMCPServer,
} from "../../../src/multiagent/mcp-governance.js";
import type { MCPServer } from "../../../src/translator/ir.js";

function makeServer(overrides: Partial<MCPServer> = {}): MCPServer {
  return {
    name: "test-server",
    endpoint: "http://localhost:8080",
    ...overrides,
  };
}

describe("scoreMCPServer", () => {
  it("returns low tier for minimal server", () => {
    const result = scoreMCPServer(makeServer({ auth_scope: ["read"] }));
    expect(result.tier).toBe("low");
    expect(result.score).toBeLessThan(3);
  });

  it("scores 0 with auth, no tools, no auto-approve, no high risk", () => {
    const result = scoreMCPServer(makeServer({ auth_scope: ["read"] }));
    expect(result.score).toBe(0);
  });

  it("adds 2 when auth_scope is empty", () => {
    const result = scoreMCPServer(makeServer({ auth_scope: [] }));
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("adds 2 when auth_scope is absent", () => {
    const result = scoreMCPServer(makeServer());
    expect(result.score).toBeGreaterThanOrEqual(2);
  });

  it("adds score for low-risk tool", () => {
    const s = makeServer({
      auth_scope: ["read"],
      tool_registry: [
        { tool_name: "t1", server_name: "s", auth_scopes: [], access_level: "public", risk_level: "low" },
      ],
    });
    expect(scoreMCPServer(s).score).toBe(1);
  });

  it("adds score for medium-risk tool", () => {
    const s = makeServer({
      auth_scope: ["read"],
      tool_registry: [
        { tool_name: "t1", server_name: "s", auth_scopes: [], access_level: "restricted", risk_level: "medium" },
      ],
    });
    expect(scoreMCPServer(s).score).toBe(2);
  });

  it("adds score for high-risk tool", () => {
    const s = makeServer({
      auth_scope: ["read"],
      tool_registry: [
        { tool_name: "t1", server_name: "s", auth_scopes: [], access_level: "admin", risk_level: "high" },
      ],
    });
    expect(scoreMCPServer(s).score).toBe(3);
  });

  it("adds 2 when governance.auto_approve is non-empty", () => {
    const s = makeServer({
      auth_scope: ["read"],
      governance: { permission_validation: false, auto_approve: ["file:read"] },
    });
    expect(scoreMCPServer(s).score).toBe(2);
  });

  it("does not add auto_approve penalty when empty", () => {
    const s = makeServer({
      auth_scope: ["read"],
      governance: { permission_validation: false, auto_approve: [] },
    });
    expect(scoreMCPServer(s).score).toBe(0);
  });

  it("adds 2 when server risk_level is high", () => {
    const s = makeServer({ auth_scope: ["read"], risk_level: "high" });
    expect(scoreMCPServer(s).score).toBe(2);
  });

  it("returns medium tier for score 3-4", () => {
    const s = makeServer({
      auth_scope: ["read"],
      tool_registry: [
        { tool_name: "t1", server_name: "s", auth_scopes: [], access_level: "restricted", risk_level: "medium" },
        { tool_name: "t2", server_name: "s", auth_scopes: [], access_level: "restricted", risk_level: "low" },
      ],
    });
    const result = scoreMCPServer(s);
    expect(result.score).toBe(3);
    expect(result.tier).toBe("medium");
  });

  it("returns high tier for score 5-7", () => {
    const s = makeServer({
      auth_scope: ["read"],
      risk_level: "high",
      governance: { permission_validation: false, auto_approve: ["*"] },
      tool_registry: [
        { tool_name: "t1", server_name: "s", auth_scopes: [], access_level: "admin", risk_level: "high" },
      ],
    });
    const result = scoreMCPServer(s);
    expect(result.tier).toBe("high");
  });

  it("returns critical tier for score >= 8", () => {
    const s = makeServer({
      // no auth (+2), auto_approve (+2), high server risk (+2), multiple high tools (+3+3 = 6) => 12
      governance: { permission_validation: false, auto_approve: ["*"] },
      risk_level: "high",
      tool_registry: [
        { tool_name: "t1", server_name: "s", auth_scopes: [], access_level: "admin", risk_level: "high" },
        { tool_name: "t2", server_name: "s", auth_scopes: [], access_level: "admin", risk_level: "high" },
      ],
    });
    const result = scoreMCPServer(s);
    expect(result.tier).toBe("critical");
  });

  it("max is always 10", () => {
    expect(scoreMCPServer(makeServer()).max).toBe(10);
  });

  it("handles server with no tool_registry gracefully", () => {
    expect(() => scoreMCPServer(makeServer({ tool_registry: undefined }))).not.toThrow();
  });
});

describe("generateMCPRiskReport", () => {
  it("returns empty array for no servers", () => {
    expect(generateMCPRiskReport([])).toEqual([]);
  });

  it("reports hasAuth=false when no auth_scope", () => {
    const reports = generateMCPRiskReport([makeServer()]);
    expect(reports[0].hasAuth).toBe(false);
  });

  it("reports hasAuth=true with auth_scope", () => {
    const reports = generateMCPRiskReport([makeServer({ auth_scope: ["read"] })]);
    expect(reports[0].hasAuth).toBe(true);
  });

  it("includes auth issue when no auth_scope", () => {
    const reports = generateMCPRiskReport([makeServer()]);
    expect(reports[0].issues.some((i) => i.includes("auth_scope"))).toBe(true);
  });

  it("reports requiresConfirmation correctly", () => {
    const s = makeServer({
      governance: { permission_validation: true, require_confirmation: ["file:write"] },
    });
    const reports = generateMCPRiskReport([s]);
    expect(reports[0].requiresConfirmation).toBe(true);
  });

  it("counts tool_registry and tools for toolCount", () => {
    const s = makeServer({
      tools: ["t1", "t2"],
      tool_registry: [
        { tool_name: "t3", server_name: "s", auth_scopes: [], access_level: "public" },
      ],
    });
    const reports = generateMCPRiskReport([s]);
    expect(reports[0].toolCount).toBe(3);
  });
});
