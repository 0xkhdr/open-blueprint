import type { BlueprintIR } from "../translator/ir.js";
import type { ValidationError } from "./structural.js";

export function validateCostConfig(ir: BlueprintIR): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!ir.cost) return errors;

  // Validate monthly budget is positive if set
  if (ir.cost.monthly_budget_usd !== undefined && ir.cost.monthly_budget_usd <= 0) {
    errors.push({
      file: "cost",
      type: "INVALID_BUDGET",
      severity: "error",
      message: `Monthly budget must be positive, got ${ir.cost.monthly_budget_usd}`,
      resolution: "Set monthly_budget_usd to a positive value or omit it",
    });
  }

  // Validate per-session limit is positive if set
  if (ir.cost.per_session_limit_usd !== undefined && ir.cost.per_session_limit_usd <= 0) {
    errors.push({
      file: "cost",
      type: "INVALID_SESSION_LIMIT",
      severity: "error",
      message: `Per-session limit must be positive, got ${ir.cost.per_session_limit_usd}`,
      resolution: "Set per_session_limit_usd to a positive value or omit it",
    });
  }

  // Validate cost per token
  if (ir.cost.cost_per_token_usd !== undefined && ir.cost.cost_per_token_usd <= 0) {
    errors.push({
      file: "cost",
      type: "INVALID_COST_PER_TOKEN",
      severity: "error",
      message: `Cost per token must be positive, got ${ir.cost.cost_per_token_usd}`,
      resolution: "Set cost_per_token_usd to a positive value or omit it",
    });
  }

  // Validate per-agent budgets
  if (ir.cost.per_agent_budgets && ir.cost.per_agent_budgets.length > 0) {
    const agentNames = new Set(ir.personas?.map((p) => p.name) ?? []);

    for (const budget of ir.cost.per_agent_budgets) {
      if (!agentNames.has(budget.agent_name)) {
        errors.push({
          file: "cost",
          type: "BUDGET_AGENT_NOT_FOUND",
          severity: "warning",
          message: `Per-agent budget references unknown agent "${budget.agent_name}"`,
          resolution: "Remove the budget entry or add the agent to personas",
        });
      }

      if (budget.monthly_budget_usd <= 0) {
        errors.push({
          file: "cost",
          type: "INVALID_AGENT_BUDGET",
          severity: "error",
          message: `Agent budget for "${budget.agent_name}" must be positive`,
          resolution: "Set a positive budget or remove the entry",
        });
      }
    }
  }

  // Validate cost attribution level
  const validLevels = ["agent", "skill", "rule"];
  if (ir.cost.cost_attribution_level && !validLevels.includes(ir.cost.cost_attribution_level)) {
    errors.push({
      file: "cost",
      type: "INVALID_ATTRIBUTION_LEVEL",
      severity: "error",
      message: `Invalid cost_attribution_level "${ir.cost.cost_attribution_level}"`,
      resolution: `Use one of: ${validLevels.join(", ")}`,
    });
  }

  return errors;
}

export interface CostReport {
  total_estimated_tokens: number;
  total_estimated_cost: number;
  cost_per_token: number;
  agents: Array<{ name: string; budget_usd?: number; estimated_cost: number }>;
  skills: Array<{ name: string; tokens: number; cost: number }>;
  rules: Array<{ id: string; tokens: number; cost: number }>;
  warnings: string[];
}

export function generateCostReport(ir: BlueprintIR): CostReport {
  const costPerToken = ir.cost?.cost_per_token_usd ?? 0.00001;
  const estimatedTokens = ir.cost?.estimated_monthly_tokens ?? 500_000;
  const estimatedCost = estimatedTokens * costPerToken;

  const warnings: string[] = [];

  // Check budget violations
  if (ir.cost?.monthly_budget_usd && estimatedCost > ir.cost.monthly_budget_usd) {
    warnings.push(
      `Estimated monthly cost $${estimatedCost.toFixed(2)} exceeds budget $${ir.cost.monthly_budget_usd.toFixed(2)}`
    );
  }

  // Per-agent budgets
  const agentCosts = (ir.personas ?? []).map((persona) => {
    const agentBudget = ir.cost?.per_agent_budgets?.find((b) => b.agent_name === persona.name);
    const agentShare = estimatedCost / (ir.personas?.length ?? 1);
    if (agentBudget && agentShare > agentBudget.monthly_budget_usd) {
      warnings.push(
        `Agent "${persona.name}" estimated cost $${agentShare.toFixed(2)} exceeds budget $${agentBudget.monthly_budget_usd.toFixed(2)}`
      );
    }
    const cost: { name: string; budget_usd?: number; estimated_cost: number } = {
      name: persona.name,
      estimated_cost: agentShare,
    };
    if (agentBudget) {
      cost.budget_usd = agentBudget.monthly_budget_usd;
    }
    return cost;
  });

  // Skill costs (rough split)
  const skillCosts = (ir.skills ?? []).map((skill) => {
    const skillShare = estimatedCost / (ir.skills?.length ?? 1);
    const skillTokens = estimatedTokens / (ir.skills?.length ?? 1);
    return {
      name: skill.name,
      tokens: Math.round(skillTokens),
      cost: skillShare,
    };
  });

  // Rule costs (rough split)
  const ruleCosts = (ir.rules ?? []).map((rule) => {
    const ruleShare = estimatedCost / (ir.rules?.length ?? 1);
    const ruleTokens = estimatedTokens / (ir.rules?.length ?? 1);
    return {
      id: rule.id,
      tokens: Math.round(ruleTokens),
      cost: ruleShare,
    };
  });

  return {
    total_estimated_tokens: estimatedTokens,
    total_estimated_cost: estimatedCost,
    cost_per_token: costPerToken,
    agents: agentCosts,
    skills: skillCosts,
    rules: ruleCosts,
    warnings,
  };
}
