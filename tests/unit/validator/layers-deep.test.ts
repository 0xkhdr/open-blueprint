import { describe, it, expect } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import {
  validateCommandsDeep,
  validateMCPServersDeep,
  validateSettingsDeep,
} from "../../../src/validator/layers-deep.js";

const FILE = "/project/.claude/blueprint.json";

function baseIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "test",
      surface: "# test",
      temporal_anchor: "dev",
      conventions: [],
    },
    personas: [],
    rules: [],
    skills: [],
    hooks: [],
    meta: {
      rule_precedence: [],
      conflict_resolution: "precedence-based",
      source_backend: "claude",
      target_backend: "claude",
    },
  };
}

describe("validateSettingsDeep", () => {
  it("returns empty when no settings", () => {
    const ir = baseIR();
    expect(validateSettingsDeep(ir, FILE)).toHaveLength(0);
  });

  it("passes when approval_mode matches risk_tier low→auto", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "low" };
    ir.settings = { approval_mode: "auto" };
    expect(validateSettingsDeep(ir, FILE)).toHaveLength(0);
  });

  it("passes when approval_mode matches risk_tier medium→confirm", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "medium" };
    ir.settings = { approval_mode: "confirm" };
    expect(validateSettingsDeep(ir, FILE)).toHaveLength(0);
  });

  it("passes when approval_mode matches risk_tier high→read-only", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "high" };
    ir.settings = { approval_mode: "read-only" };
    expect(validateSettingsDeep(ir, FILE)).toHaveLength(0);
  });

  it("passes when approval_mode matches risk_tier critical→read-only", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "critical" };
    ir.settings = { approval_mode: "read-only" };
    expect(validateSettingsDeep(ir, FILE)).toHaveLength(0);
  });

  it("warns when approval_mode mismatches risk_tier (low project using confirm)", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "low" };
    ir.settings = { approval_mode: "confirm" };
    const errors = validateSettingsDeep(ir, FILE);
    expect(errors.some((e) => e.type === "SETTINGS_RISK_MISMATCH")).toBe(true);
    expect(errors.find((e) => e.type === "SETTINGS_RISK_MISMATCH")?.severity).toBe("warning");
  });

  it("warns when high-risk project uses auto approval", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "high" };
    ir.settings = { approval_mode: "auto" };
    const errors = validateSettingsDeep(ir, FILE);
    expect(errors.some((e) => e.type === "SETTINGS_RISK_MISMATCH")).toBe(true);
  });

  it("passes when no approval_mode set (no mismatch possible)", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "high" };
    ir.settings = {};
    expect(validateSettingsDeep(ir, FILE)).toHaveLength(0);
  });

  it("errors when monthly_budget_usd is zero", () => {
    const ir = baseIR();
    ir.settings = { cost_controls: { monthly_budget_usd: 0 } };
    const errors = validateSettingsDeep(ir, FILE);
    expect(errors.some((e) => e.type === "INVALID_BUDGET")).toBe(true);
    expect(errors.find((e) => e.type === "INVALID_BUDGET")?.severity).toBe("error");
  });

  it("errors when monthly_budget_usd is negative", () => {
    const ir = baseIR();
    ir.settings = { cost_controls: { monthly_budget_usd: -50 } };
    expect(validateSettingsDeep(ir, FILE).some((e) => e.type === "INVALID_BUDGET")).toBe(true);
  });

  it("passes when monthly_budget_usd is positive", () => {
    const ir = baseIR();
    ir.settings = { cost_controls: { monthly_budget_usd: 100 } };
    expect(validateSettingsDeep(ir, FILE).filter((e) => e.type === "INVALID_BUDGET")).toHaveLength(0);
  });
});

describe("validateCommandsDeep", () => {
  it("returns empty when no commands", () => {
    const ir = baseIR();
    expect(validateCommandsDeep(ir, FILE)).toHaveLength(0);
  });

  it("returns empty when commands array is empty", () => {
    const ir = baseIR();
    ir.commands = [];
    expect(validateCommandsDeep(ir, FILE)).toHaveLength(0);
  });

  it("passes with unique command names", () => {
    const ir = baseIR();
    ir.commands = [
      { name: "build", description: "Build", command: "npm run build" },
      { name: "test", description: "Test", command: "npm test" },
      { name: "lint", description: "Lint", command: "npm run lint" },
    ];
    expect(validateCommandsDeep(ir, FILE)).toHaveLength(0);
  });

  it("errors on duplicate command name", () => {
    const ir = baseIR();
    ir.commands = [
      { name: "build", description: "Build 1", command: "npm run build" },
      { name: "build", description: "Build 2", command: "bun run build" },
    ];
    const errors = validateCommandsDeep(ir, FILE);
    expect(errors.some((e) => e.type === "DUPLICATE_COMMAND")).toBe(true);
    expect(errors.find((e) => e.type === "DUPLICATE_COMMAND")?.severity).toBe("error");
  });

  it("includes command name in error message", () => {
    const ir = baseIR();
    ir.commands = [
      { name: "deploy", description: "Deploy 1", command: "deploy.sh" },
      { name: "deploy", description: "Deploy 2", command: "deploy2.sh" },
    ];
    const err = validateCommandsDeep(ir, FILE).find((e) => e.type === "DUPLICATE_COMMAND");
    expect(err?.message).toContain("deploy");
  });

  it("detects multiple duplicate names independently", () => {
    const ir = baseIR();
    ir.commands = [
      { name: "build", description: "a", command: "x" },
      { name: "build", description: "b", command: "y" },
      { name: "test", description: "c", command: "z" },
      { name: "test", description: "d", command: "w" },
    ];
    const errors = validateCommandsDeep(ir, FILE).filter((e) => e.type === "DUPLICATE_COMMAND");
    expect(errors).toHaveLength(2);
  });
});

describe("validateMCPServersDeep", () => {
  it("returns empty when no mcp_servers", () => {
    const ir = baseIR();
    expect(validateMCPServersDeep(ir, FILE)).toHaveLength(0);
  });

  it("returns empty for valid server config", () => {
    const ir = baseIR();
    ir.mcp_servers = [{ name: "db-server", description: "Database access", transport: "sse", auth_scopes: [] }];
    expect(validateMCPServersDeep(ir, FILE)).toHaveLength(0);
  });

  it("warns when low-risk project has high-risk MCP server", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "low" };
    ir.mcp_servers = [{ name: "dangerous-server", description: "Risky", transport: "sse", auth_scopes: [], risk_level: "high" }];
    const errors = validateMCPServersDeep(ir, FILE);
    expect(errors.some((e) => e.type === "MCP_RISK_MISMATCH")).toBe(true);
    expect(errors.find((e) => e.type === "MCP_RISK_MISMATCH")?.severity).toBe("warning");
  });

  it("does not warn when medium-risk project has high-risk server", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "medium" };
    ir.mcp_servers = [{ name: "server", description: "s", transport: "sse", auth_scopes: [], risk_level: "high" }];
    expect(validateMCPServersDeep(ir, FILE).filter((e) => e.type === "MCP_RISK_MISMATCH")).toHaveLength(0);
  });

  it("warns when high-risk tool registry entry lacks auth_scope", () => {
    const ir = baseIR();
    ir.mcp_servers = [{
      name: "my-server",
      description: "Server",
      transport: "sse",
      auth_scopes: [],
      tool_registry: [{ name: "dangerous-op", description: "Deletes data", risk_level: "high", auth_scopes: [] }],
    }];
    const errors = validateMCPServersDeep(ir, FILE);
    expect(errors.some((e) => e.type === "MCP_AUTH_MISSING")).toBe(true);
    expect(errors.find((e) => e.type === "MCP_AUTH_MISSING")?.severity).toBe("warning");
  });

  it("passes when high-risk tool has auth_scope on server", () => {
    const ir = baseIR();
    ir.mcp_servers = [{
      name: "my-server",
      description: "Server",
      transport: "sse",
      auth_scopes: [],
      auth_scope: ["admin"],
      tool_registry: [{ name: "dangerous-op", description: "Deletes data", risk_level: "high", auth_scopes: [] }],
    }];
    expect(validateMCPServersDeep(ir, FILE).filter((e) => e.type === "MCP_AUTH_MISSING")).toHaveLength(0);
  });

  it("includes server name in risk mismatch message", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "low" };
    ir.mcp_servers = [{ name: "super-server", description: "s", transport: "sse", auth_scopes: [], risk_level: "high" }];
    const err = validateMCPServersDeep(ir, FILE).find((e) => e.type === "MCP_RISK_MISMATCH");
    expect(err?.message).toContain("super-server");
  });

  it("validates multiple servers and reports all issues", () => {
    const ir = baseIR();
    ir.risk = { risk_tier: "low" };
    ir.mcp_servers = [
      { name: "s1", description: "s", transport: "sse", auth_scopes: [], risk_level: "high" },
      { name: "s2", description: "s", transport: "sse", auth_scopes: [], risk_level: "high" },
    ];
    const errors = validateMCPServersDeep(ir, FILE).filter((e) => e.type === "MCP_RISK_MISMATCH");
    expect(errors).toHaveLength(2);
  });
});
