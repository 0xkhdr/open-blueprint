import { describe, it, expect } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import { auditPerformance } from "../../../src/validator/performance.js";

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

function makeRule(id: string, scope: string) {
  return { id, scope, severity: "suggestion" as const, action: "Do something" };
}

describe("auditPerformance", () => {
  it("returns no warnings and zero metrics for empty IR", () => {
    const ir = baseIR();
    const result = auditPerformance(ir, FILE);
    expect(result.warnings).toHaveLength(0);
    expect(result.metrics.total_rules).toBe(0);
    expect(result.metrics.total_glob_patterns).toBe(0);
  });

  it("counts a single-scope rule as 1 pattern", () => {
    const ir = baseIR();
    ir.rules = [makeRule("r1", "**/*.ts")];
    const result = auditPerformance(ir, FILE);
    expect(result.metrics.total_glob_patterns).toBe(1);
    expect(result.metrics.total_rules).toBe(1);
  });

  it("counts pipe-separated scope as multiple patterns", () => {
    const ir = baseIR();
    ir.rules = [makeRule("r1", "**/*.ts|**/*.js|**/*.tsx")];
    const result = auditPerformance(ir, FILE);
    expect(result.metrics.total_glob_patterns).toBe(3);
  });

  it("counts comma-separated scope as multiple patterns", () => {
    const ir = baseIR();
    ir.rules = [makeRule("r1", "src/**,tests/**,docs/**")];
    const result = auditPerformance(ir, FILE);
    expect(result.metrics.total_glob_patterns).toBe(3);
  });

  it("does not warn on 1000 patterns (at threshold, no warn)", () => {
    const ir = baseIR();
    // 10 rules × 100 patterns each = 1000, but threshold is >1000
    const scope = Array.from({ length: 100 }, (_, i) => `**/${i}/*.ts`).join("|");
    ir.rules = Array.from({ length: 10 }, (_, i) => makeRule(`r${i}`, scope));
    const result = auditPerformance(ir, FILE);
    expect(result.metrics.total_glob_patterns).toBe(1000);
    expect(result.warnings.filter((w) => w.type === "GLOB_PATTERN_EXPLOSION")).toHaveLength(0);
  });

  it("warns when total patterns exceed 1000", () => {
    const ir = baseIR();
    const scope = Array.from({ length: 102 }, (_, i) => `**/${i}/*.ts`).join("|");
    ir.rules = Array.from({ length: 10 }, (_, i) => makeRule(`r${i}`, scope));
    const result = auditPerformance(ir, FILE);
    expect(result.warnings.some((w) => w.type === "GLOB_PATTERN_EXPLOSION")).toBe(true);
    expect(result.warnings.find((w) => w.type === "GLOB_PATTERN_EXPLOSION")?.severity).toBe("warning");
  });

  it("does not warn when rule count is exactly 100", () => {
    const ir = baseIR();
    ir.rules = Array.from({ length: 100 }, (_, i) => makeRule(`r${i}`, "**/*.ts"));
    const result = auditPerformance(ir, FILE);
    expect(result.warnings.filter((w) => w.type === "RULE_COUNT_HIGH")).toHaveLength(0);
  });

  it("warns when rule count exceeds 100", () => {
    const ir = baseIR();
    ir.rules = Array.from({ length: 101 }, (_, i) => makeRule(`r${i}`, "**/*.ts"));
    const result = auditPerformance(ir, FILE);
    expect(result.warnings.some((w) => w.type === "RULE_COUNT_HIGH")).toBe(true);
    expect(result.warnings.find((w) => w.type === "RULE_COUNT_HIGH")?.severity).toBe("warning");
  });

  it("warns when agent registry exceeds 50 agents", () => {
    const ir = baseIR();
    ir.agent_registry = {
      agents: Array.from({ length: 51 }, (_, i) => ({
        name: `Agent${i}`,
        owner: "team",
        purpose: "Work",
        eval_status: "tested" as const,
        registry_version: "1.0",
      })),
      registry_version: "1.0",
    };
    const result = auditPerformance(ir, FILE);
    expect(result.warnings.some((w) => w.type === "AGENT_REGISTRY_LARGE")).toBe(true);
  });

  it("does not warn when agent registry has exactly 50 agents", () => {
    const ir = baseIR();
    ir.agent_registry = {
      agents: Array.from({ length: 50 }, (_, i) => ({
        name: `Agent${i}`,
        owner: "team",
        purpose: "Work",
        eval_status: "tested" as const,
        registry_version: "1.0",
      })),
      registry_version: "1.0",
    };
    const result = auditPerformance(ir, FILE);
    expect(result.warnings.filter((w) => w.type === "AGENT_REGISTRY_LARGE")).toHaveLength(0);
  });

  it("estimated_validation_time_ms is non-negative", () => {
    const ir = baseIR();
    const result = auditPerformance(ir, FILE);
    expect(result.metrics.estimated_validation_time_ms).toBeGreaterThanOrEqual(0);
  });

  it("estimated_validation_time_ms caps at 5000", () => {
    const ir = baseIR();
    // 2000 rules × 5ms = 10000ms but should cap at 5000
    ir.rules = Array.from({ length: 2000 }, (_, i) => makeRule(`r${i}`, "**/*.ts"));
    const result = auditPerformance(ir, FILE);
    expect(result.metrics.estimated_validation_time_ms).toBeLessThanOrEqual(5000);
  });

  it("returns correct metrics object shape", () => {
    const ir = baseIR();
    ir.rules = [makeRule("r1", "**/*.ts"), makeRule("r2", "src/**|tests/**")];
    const result = auditPerformance(ir, FILE);
    expect(result.metrics).toHaveProperty("total_glob_patterns");
    expect(result.metrics).toHaveProperty("total_rules");
    expect(result.metrics).toHaveProperty("estimated_validation_time_ms");
    expect(result.metrics.total_rules).toBe(2);
    expect(result.metrics.total_glob_patterns).toBe(3);
  });
});
