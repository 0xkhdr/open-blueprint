import { describe, it, expect } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import { validateCostConfig, generateCostReport } from "../../../src/validator/cost.js";

function createBaseIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "test",
      surface: "# test",
      temporal_anchor: "dev",
      conventions: [],
    },
    personas: [
      { name: "Agent1", role: "Worker", reasoning_style: "logical", constraints: [] },
      { name: "Agent2", role: "Reviewer", reasoning_style: "critical", constraints: [] },
    ],
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

describe("validateCostConfig", () => {
  it("returns no errors when cost is absent", () => {
    const ir = createBaseIR();
    const errors = validateCostConfig(ir);
    expect(errors).toHaveLength(0);
  });

  it("accepts valid cost config", () => {
    const ir = createBaseIR();
    ir.cost = {
      cost_tracking_enabled: true,
      monthly_budget_usd: 100,
      per_session_limit_usd: 5,
      cost_per_token_usd: 0.00001,
      cost_attribution_level: "agent",
      token_tracking_enabled: true,
    };
    const errors = validateCostConfig(ir);
    expect(errors).toHaveLength(0);
  });

  it("flags non-positive monthly budget", () => {
    const ir = createBaseIR();
    ir.cost = { cost_tracking_enabled: true, monthly_budget_usd: 0, cost_attribution_level: "agent", token_tracking_enabled: true };
    const errors = validateCostConfig(ir);
    expect(errors.some((e) => e.type === "INVALID_BUDGET")).toBe(true);
  });

  it("flags non-positive per-session limit", () => {
    const ir = createBaseIR();
    ir.cost = { cost_tracking_enabled: true, per_session_limit_usd: -1, cost_attribution_level: "agent", token_tracking_enabled: true };
    const errors = validateCostConfig(ir);
    expect(errors.some((e) => e.type === "INVALID_SESSION_LIMIT")).toBe(true);
  });

  it("flags non-positive cost per token", () => {
    const ir = createBaseIR();
    ir.cost = { cost_tracking_enabled: true, cost_per_token_usd: 0, cost_attribution_level: "agent", token_tracking_enabled: true };
    const errors = validateCostConfig(ir);
    expect(errors.some((e) => e.type === "INVALID_COST_PER_TOKEN")).toBe(true);
  });

  it("flags non-positive per-agent budget", () => {
    const ir = createBaseIR();
    ir.cost = {
      cost_tracking_enabled: true,
      cost_attribution_level: "agent",
      token_tracking_enabled: true,
      per_agent_budgets: [{ agent_name: "Agent1", monthly_budget_usd: 0 }],
    };
    const errors = validateCostConfig(ir);
    expect(errors.some((e) => e.type === "INVALID_AGENT_BUDGET")).toBe(true);
  });

  it("accepts positive per-agent budget regardless of agent existence (cross-layer handles that)", () => {
    const ir = createBaseIR();
    ir.cost = {
      cost_tracking_enabled: true,
      cost_attribution_level: "agent",
      token_tracking_enabled: true,
      per_agent_budgets: [{ agent_name: "UnknownAgent", monthly_budget_usd: 50 }],
    };
    const errors = validateCostConfig(ir);
    expect(errors.filter((e) => e.type === "INVALID_AGENT_BUDGET")).toHaveLength(0);
  });
});

describe("generateCostReport", () => {
  it("generates report with default cost per token", () => {
    const ir = createBaseIR();
    ir.cost = { cost_tracking_enabled: true, cost_attribution_level: "agent", token_tracking_enabled: true };
    const report = generateCostReport(ir);
    expect(report.total_estimated_tokens).toBeGreaterThan(0);
    expect(report.cost_per_token).toBe(0.00001);
    expect(typeof report.total_estimated_cost).toBe("number");
  });

  it("generates budget warning when estimated cost exceeds budget", () => {
    const ir = createBaseIR();
    ir.cost = {
      cost_tracking_enabled: true,
      cost_attribution_level: "agent",
      token_tracking_enabled: true,
      monthly_budget_usd: 0.01,
      estimated_monthly_tokens: 10_000_000,
      cost_per_token_usd: 0.00001,
    };
    const report = generateCostReport(ir);
    expect(report.warnings.length).toBeGreaterThan(0);
    expect(report.warnings[0]).toContain("exceeds budget");
  });

  it("generates per-agent cost breakdown", () => {
    const ir = createBaseIR();
    ir.cost = {
      cost_tracking_enabled: true,
      cost_attribution_level: "agent",
      token_tracking_enabled: true,
      per_agent_budgets: [{ agent_name: "Agent1", monthly_budget_usd: 50 }],
    };
    const report = generateCostReport(ir);
    expect(report.agents.length).toBeGreaterThan(0);
    const agent1 = report.agents.find((a) => a.name === "Agent1");
    expect(agent1).toBeDefined();
    expect(agent1?.budget_usd).toBe(50);
  });
});
