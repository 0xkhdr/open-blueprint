import type { BlueprintIR } from "../translator/ir.js";
import type { ValidationError } from "./structural.js";

export interface PerformanceAuditResult {
  warnings: ValidationError[];
  metrics: {
    total_glob_patterns: number;
    total_rules: number;
    estimated_validation_time_ms: number;
  };
}

export function auditPerformance(ir: BlueprintIR, file: string): PerformanceAuditResult {
  const warnings: ValidationError[] = [];

  const totalPatterns = ir.rules.reduce((sum, r) => {
    return sum + r.scope.split(/[,|]/).length;
  }, 0);

  if (totalPatterns > 1000) {
    warnings.push({
      file,
      type: "GLOB_PATTERN_EXPLOSION",
      severity: "warning",
      message: `Total glob patterns: ${totalPatterns} — may impact performance`,
      resolution: "Consolidate rules or use broader scope patterns",
    });
  }

  if (ir.rules.length > 100) {
    warnings.push({
      file,
      type: "RULE_COUNT_HIGH",
      severity: "warning",
      message: `Rule count: ${ir.rules.length} — consider splitting into multiple blueprints`,
      resolution: "Use blueprint inheritance or domain-specific blueprints",
    });
  }

  if (ir.agent_registry && ir.agent_registry.agents.length > 50) {
    warnings.push({
      file,
      type: "AGENT_REGISTRY_LARGE",
      severity: "warning",
      message: `Agent registry: ${ir.agent_registry.agents.length} agents — may be unwieldy`,
      resolution: "Split into team-specific registries",
    });
  }

  const estimatedTime = Math.min(totalPatterns * 2 + ir.rules.length * 5, 5000);

  return {
    warnings,
    metrics: {
      total_glob_patterns: totalPatterns,
      total_rules: ir.rules.length,
      estimated_validation_time_ms: estimatedTime,
    },
  };
}
