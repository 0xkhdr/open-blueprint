import { describe, it, expect } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import { validateOrchestrationSemantic } from "../../../src/validator/orchestration.js";

function createBasicIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "Test",
      surface: "# Test",
      temporal_anchor: "dev",
      conventions: [],
    },
    personas: [{ name: "Agent1", role: "Worker", reasoning_style: "logical", constraints: [] }],
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

describe("Agent Registry Validation", () => {
  it("should pass with valid agent registry", () => {
    const ir = createBasicIR();
    ir.agent_registry = {
      agents: [
        {
          name: "agent1",
          owner: "team-a",
          purpose: "Process data",
          eval_status: "tested",
        },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors).toHaveLength(0);
  });

  it("should flag duplicate agent names", () => {
    const ir = createBasicIR();
    ir.agent_registry = {
      agents: [
        { name: "agent", owner: "a", purpose: "x" },
        { name: "agent", owner: "b", purpose: "y" },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "DUPLICATE_AGENT")).toBe(true);
  });

  it("should warn when certified agent has no version", () => {
    const ir = createBasicIR();
    ir.agent_registry = {
      agents: [
        {
          name: "certified_agent",
          owner: "team",
          purpose: "x",
          eval_status: "certified",
        },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "CERTIFIED_NO_VERSION")).toBe(true);
    expect(errors.some((e) => e.severity === "warning")).toBe(true);
  });

  it("should pass when certified agent has version", () => {
    const ir = createBasicIR();
    ir.agent_registry = {
      agents: [
        {
          name: "certified_agent",
          owner: "team",
          purpose: "x",
          eval_status: "certified",
          version: "1.0.0",
        },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "CERTIFIED_NO_VERSION")).toHaveLength(0);
  });
});

describe("Tool Registry Validation", () => {
  it("should pass with valid tool registry", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [
      {
        name: "server1",
        endpoint: "@example/server",
        tool_registry: [{ tool_name: "tool1", server_name: "server1", access_level: "public" }],
      },
    ];
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "DUPLICATE_TOOL")).toHaveLength(0);
  });

  it("should flag duplicate tool names within server", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [
      {
        name: "server1",
        endpoint: "@example/server",
        tool_registry: [
          { tool_name: "tool", server_name: "server1", access_level: "public" },
          { tool_name: "tool", server_name: "server1", access_level: "restricted" },
        ],
      },
    ];
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "DUPLICATE_TOOL")).toBe(true);
  });

  it("should require auth_scopes for admin tools", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [
      {
        name: "server1",
        endpoint: "@example/server",
        tool_registry: [{ tool_name: "admin_tool", server_name: "server1", access_level: "admin" }],
      },
    ];
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "ADMIN_TOOL_NO_AUTH")).toBe(true);
    expect(errors.some((e) => e.severity === "error")).toBe(true);
  });

  it("should pass when admin tool has auth_scopes", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [
      {
        name: "server1",
        endpoint: "@example/server",
        tool_registry: [
          {
            tool_name: "admin_tool",
            server_name: "server1",
            access_level: "admin",
            auth_scopes: ["ADMIN_KEY"],
          },
        ],
      },
    ];
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "ADMIN_TOOL_NO_AUTH")).toHaveLength(0);
  });
});

describe("MCP Governance Validation", () => {
  it("should warn when high-risk server lacks permission_validation", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [
      {
        name: "risky_server",
        endpoint: "@example/risky",
        risk_level: "high",
        governance: { permission_validation: false },
      },
    ];
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "HIGH_RISK_NO_GOVERNANCE")).toBe(true);
  });

  it("should pass when high-risk server has permission_validation", () => {
    const ir = createBasicIR();
    ir.mcp_servers = [
      {
        name: "safe_server",
        endpoint: "@example/safe",
        risk_level: "high",
        governance: { permission_validation: true },
      },
    ];
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "HIGH_RISK_NO_GOVERNANCE")).toHaveLength(0);
  });
});

describe("Teams Validation", () => {
  it("should warn when team has empty agents list", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_teams: [{ team_name: "empty_team", agents: [] }],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "EMPTY_TEAM")).toBe(true);
  });

  it("should info-warn when team lacks owner or purpose", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_teams: [
        { team_name: "team1", agents: ["agent1"] },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "MISSING_TEAM_METADATA")).toBe(true);
    expect(errors.some((e) => e.severity === "info")).toBe(true);
  });

  it("should pass with well-formed teams", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_teams: [
        {
          team_name: "good_team",
          agents: ["agent1", "agent2"],
          owner: "alice",
          purpose: "Do stuff",
        },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "MISSING_TEAM_METADATA")).toHaveLength(0);
  });
});

describe("Chains Validation", () => {
  it("should warn when chain sequence references unknown agent", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_chains: [
        {
          chain_name: "bad_chain",
          sequence: ["unknown_agent", "Agent1"],
        },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "UNKNOWN_CHAIN_AGENT")).toBe(true);
  });

  it("should pass when all agents in chain are known", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_chains: [
        {
          chain_name: "good_chain",
          sequence: ["Agent1"],
        },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "UNKNOWN_CHAIN_AGENT")).toHaveLength(0);
  });

  it("should warn when error_handler is unknown", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      agent_chains: [
        {
          chain_name: "chain_with_bad_handler",
          sequence: ["Agent1"],
          error_handler: "ghost_agent",
        },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "UNKNOWN_ERROR_HANDLER")).toBe(true);
  });

  it("should pass with valid error_handler", () => {
    const ir = createBasicIR();
    ir.personas.push({ name: "ErrorHandler", role: "Handler", reasoning_style: "defensive", constraints: [] });
    ir.orchestration = {
      agent_chains: [
        {
          chain_name: "chain",
          sequence: ["Agent1"],
          error_handler: "ErrorHandler",
        },
      ],
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "UNKNOWN_ERROR_HANDLER")).toHaveLength(0);
  });
});

describe("Memory Validation", () => {
  it("should warn when memory access_control references unknown agent", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      persistent_memory: {
        enabled: true,
        access_control: ["unknown_agent"],
      },
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "UNKNOWN_MEMORY_AGENT")).toBe(true);
  });

  it("should pass when all memory agents are known", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      persistent_memory: {
        enabled: true,
        access_control: ["Agent1"],
      },
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "UNKNOWN_MEMORY_AGENT")).toHaveLength(0);
  });
});

describe("Cross-Agent Communication Validation", () => {
  it("should warn when validation enabled but no schemas", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      cross_agent_communication: {
        inter_agent_validation: true,
      },
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.some((e) => e.type === "VALIDATION_NO_SCHEMAS")).toBe(true);
  });

  it("should pass when validation enabled with schemas", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      cross_agent_communication: {
        inter_agent_validation: true,
        shared_state_schemas: { message: "string" },
      },
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "VALIDATION_NO_SCHEMAS")).toHaveLength(0);
  });

  it("should pass when validation disabled", () => {
    const ir = createBasicIR();
    ir.orchestration = {
      cross_agent_communication: {
        inter_agent_validation: false,
      },
    };
    const errors = validateOrchestrationSemantic(ir);
    expect(errors.filter((e) => e.type === "VALIDATION_NO_SCHEMAS")).toHaveLength(0);
  });
});
