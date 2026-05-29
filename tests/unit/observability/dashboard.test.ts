import { describe, it, expect } from "bun:test";
import { generateCostDashboard, generateAgentCostTable } from "../../../src/observability/dashboard.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function makeIR(costOverrides: Partial<BlueprintIR["cost"]> = {}): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "test-project",
      project_root: "/tmp/test",
    },
    personas: [],
    rules: [],
    skills: [],
    hooks: [],
    meta: {
      generated_at: new Date().toISOString(),
      generator: "bp",
      source_tool: "claude",
    },
    cost: {
      cost_tracking_enabled: true,
      monthly_budget_usd: 100,
      cost_per_token_usd: 0.000001,
      estimated_monthly_tokens: 50000000,
      token_tracking_enabled: true,
      cost_attribution_level: "agent",
      ...costOverrides,
    },
  } as unknown as BlueprintIR;
}

describe("generateCostDashboard", () => {
  it("returns no-cost message when cost is undefined", () => {
    const ir = { ...makeIR(), cost: undefined } as unknown as BlueprintIR;
    const result = generateCostDashboard(ir);
    expect(result).toContain("No cost tracking configured");
  });

  it("includes project name in header", () => {
    const result = generateCostDashboard(makeIR());
    expect(result).toContain("test-project");
  });

  it("includes monthly budget in output", () => {
    const result = generateCostDashboard(makeIR({ monthly_budget_usd: 200 }));
    expect(result).toContain("200.00");
  });

  it("renders ASCII progress bar", () => {
    const result = generateCostDashboard(makeIR());
    expect(result).toMatch(/\[.*\]/);
    expect(result).toContain("█");
  });

  it("shows 0% when no tokens estimated", () => {
    const result = generateCostDashboard(
      makeIR({ estimated_monthly_tokens: 0, cost_per_token_usd: 0.000001 })
    );
    expect(result).toContain("0.0%");
  });

  it("shows per-agent budget table when configured", () => {
    const result = generateCostDashboard(
      makeIR({
        per_agent_budgets: [
          { agent_name: "agent-a", monthly_budget_usd: 30 },
          { agent_name: "agent-b", monthly_budget_usd: 20 },
        ],
      })
    );
    expect(result).toContain("agent-a");
    expect(result).toContain("agent-b");
    expect(result).toContain("By Agent");
  });

  it("shows configuration section", () => {
    const result = generateCostDashboard(makeIR());
    expect(result).toContain("Configuration");
    expect(result).toContain("enabled");
  });

  it("shows per-session limit when set", () => {
    const result = generateCostDashboard(makeIR({ per_session_limit_usd: 5 }));
    expect(result).toContain("5.00");
    expect(result).toContain("Per-Session Limit");
  });

  it("shows budget alert when spend > 80%", () => {
    // budget=100, tokens=100M, cost/token=0.000001 → spend=$100 = 100%
    const result = generateCostDashboard(
      makeIR({
        monthly_budget_usd: 100,
        cost_per_token_usd: 0.000001,
        estimated_monthly_tokens: 100_000_000,
      })
    );
    expect(result).toContain("Alerts");
  });

  it("no alert when spend is below 80%", () => {
    const result = generateCostDashboard(
      makeIR({
        monthly_budget_usd: 1000,
        cost_per_token_usd: 0.000001,
        estimated_monthly_tokens: 50_000_000,
      })
    );
    expect(result).not.toContain("Alerts");
  });

  it("progress bar is exactly 30 chars inside brackets", () => {
    const result = generateCostDashboard(makeIR());
    const match = result.match(/\[([█░]+)\]/);
    expect(match).toBeTruthy();
    expect(match![1].length).toBe(30);
  });

  it("handles zero budget gracefully (no division by zero)", () => {
    const result = generateCostDashboard(makeIR({ monthly_budget_usd: 0 }));
    expect(result).toContain("0.0%");
  });

  it("includes cost attribution level", () => {
    const result = generateCostDashboard(makeIR({ cost_attribution_level: "rule" }));
    expect(result).toContain("rule");
  });

  it("omits per-agent section when no agent budgets", () => {
    const result = generateCostDashboard(makeIR({ per_agent_budgets: [] }));
    expect(result).not.toContain("By Agent");
  });
});

describe("generateAgentCostTable", () => {
  it("renders agent table rows", () => {
    const result = generateAgentCostTable(
      [{ agent_name: "coder", monthly_budget_usd: 50 }],
      100
    );
    expect(result).toContain("coder");
    expect(result).toContain("50.00");
    expect(result).toContain("50.0%");
  });

  it("handles zero total budget", () => {
    const result = generateAgentCostTable(
      [{ agent_name: "coder", monthly_budget_usd: 50 }],
      0
    );
    expect(result).toContain("0.0%");
  });

  it("renders multiple agents", () => {
    const result = generateAgentCostTable(
      [
        { agent_name: "coder", monthly_budget_usd: 30 },
        { agent_name: "reviewer", monthly_budget_usd: 20 },
      ],
      100
    );
    expect(result).toContain("coder");
    expect(result).toContain("reviewer");
  });
});
