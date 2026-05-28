import { describe, it, expect } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import { validateOrchestrationSemantic } from "../../../src/validator/orchestration.js";

function createBaseIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "test",
      surface: "# test",
      temporal_anchor: "dev",
      conventions: [],
    },
    personas: [{ name: "Agent1", role: "Worker", reasoning_style: "logical", constraints: [] }],
    rules: [],
    skills: [
      {
        name: "analyze",
        description: "Analyze code",
        when_to_use: "Code analysis tasks",
        tools_required: [],
        procedure: "Run analysis",
      },
    ],
    hooks: [],
    meta: {
      rule_precedence: [],
      conflict_resolution: "precedence-based",
      source_backend: "claude",
      target_backend: "claude",
    },
  };
}

describe("Cross-Layer Reference Validation", () => {
  describe("metrics.per_skill_metrics skill references", () => {
    it("passes when skill metric references existing skill", () => {
      const ir = createBaseIR();
      ir.metrics = {
        metrics_enabled: true,
        per_skill_metrics: [{ skill_name: "analyze", avg_latency_ms: 100 }],
      };
      const errors = validateOrchestrationSemantic(ir);
      expect(errors.filter((e) => e.type === "UNKNOWN_SKILL_METRIC")).toHaveLength(0);
    });

    it("warns when skill metric references unknown skill", () => {
      const ir = createBaseIR();
      ir.metrics = {
        metrics_enabled: true,
        per_skill_metrics: [{ skill_name: "nonexistent_skill", avg_latency_ms: 100 }],
      };
      const errors = validateOrchestrationSemantic(ir);
      expect(errors.some((e) => e.type === "UNKNOWN_SKILL_METRIC")).toBe(true);
      expect(errors.find((e) => e.type === "UNKNOWN_SKILL_METRIC")?.severity).toBe("warning");
    });

    it("passes with no per_skill_metrics", () => {
      const ir = createBaseIR();
      ir.metrics = { metrics_enabled: true };
      const errors = validateOrchestrationSemantic(ir);
      expect(errors.filter((e) => e.type === "UNKNOWN_SKILL_METRIC")).toHaveLength(0);
    });
  });

  describe("cost.per_agent_budgets agent references", () => {
    it("passes when budget references persona agent", () => {
      const ir = createBaseIR();
      ir.cost = {
        cost_tracking_enabled: true,
        cost_attribution_level: "agent",
        token_tracking_enabled: true,
        per_agent_budgets: [{ agent_name: "Agent1", monthly_budget_usd: 50 }],
      };
      const errors = validateOrchestrationSemantic(ir);
      expect(errors.filter((e) => e.type === "BUDGET_AGENT_NOT_FOUND")).toHaveLength(0);
    });

    it("passes when budget references agent_registry agent", () => {
      const ir = createBaseIR();
      ir.agent_registry = {
        agents: [{ name: "RegistryAgent", owner: "team", purpose: "Work", eval_status: "tested", registry_version: "1.0" }],
        registry_version: "1.0",
      };
      ir.cost = {
        cost_tracking_enabled: true,
        cost_attribution_level: "agent",
        token_tracking_enabled: true,
        per_agent_budgets: [{ agent_name: "RegistryAgent", monthly_budget_usd: 50 }],
      };
      const errors = validateOrchestrationSemantic(ir);
      expect(errors.filter((e) => e.type === "BUDGET_AGENT_NOT_FOUND")).toHaveLength(0);
    });

    it("warns when budget references unknown agent", () => {
      const ir = createBaseIR();
      ir.cost = {
        cost_tracking_enabled: true,
        cost_attribution_level: "agent",
        token_tracking_enabled: true,
        per_agent_budgets: [{ agent_name: "GhostAgent", monthly_budget_usd: 50 }],
      };
      const errors = validateOrchestrationSemantic(ir);
      expect(errors.some((e) => e.type === "BUDGET_AGENT_NOT_FOUND")).toBe(true);
    });

    it("passes when no per_agent_budgets defined", () => {
      const ir = createBaseIR();
      ir.cost = { cost_tracking_enabled: true, cost_attribution_level: "agent", token_tracking_enabled: true };
      const errors = validateOrchestrationSemantic(ir);
      expect(errors.filter((e) => e.type === "BUDGET_AGENT_NOT_FOUND")).toHaveLength(0);
    });
  });
});
