import type { Fingerprint } from "./fingerprint.js";

export interface CostEstimate {
  estimated_monthly_tokens: number;
  estimated_monthly_usd: number;
  cost_per_token_usd: number;
  drivers: string[];
}

// Cost factors (rough estimates based on agent complexity)
const COST_FACTORS = {
  base_monthly_tokens: 100_000, // baseline
  per_rule_tokens: 5_000, // each rule adds overhead
  per_skill_tokens: 10_000, // each skill adds overhead
  per_language_tokens: 20_000, // polyglot projects cost more
  external_api_multiplier: 1.5, // projects with APIs cost more
  auth_layer_multiplier: 1.3, // auth adds complexity
  data_sensitive_multiplier: 1.2, // sensitive data adds validation overhead
  cost_per_token_usd: 0.00001, // ~1M tokens per $10 (Claude pricing estimate)
};

export function estimateCost(
  fingerprint: Fingerprint,
  ruleCount: number = 10,
  skillCount: number = 5
): CostEstimate {
  let tokens = COST_FACTORS.base_monthly_tokens;
  const drivers: string[] = [];

  // Add per-rule overhead
  tokens += ruleCount * COST_FACTORS.per_rule_tokens;
  if (ruleCount > 5) drivers.push(`${ruleCount} rules`);

  // Add per-skill overhead
  tokens += skillCount * COST_FACTORS.per_skill_tokens;
  if (skillCount > 3) drivers.push(`${skillCount} skills`);

  // Language multiplier (polyglot projects are more expensive)
  const languageCount = fingerprint.languages.length;
  if (languageCount > 1) {
    tokens += languageCount * COST_FACTORS.per_language_tokens;
    drivers.push(`${languageCount} languages`);
  }

  // API integration multiplier
  if (fingerprint.security_signals.has_external_apis) {
    tokens *= COST_FACTORS.external_api_multiplier;
    drivers.push("external APIs");
  }

  // Auth layer multiplier
  if (fingerprint.security_signals.has_auth) {
    tokens *= COST_FACTORS.auth_layer_multiplier;
    drivers.push("auth layer");
  }

  // Secrets manager multiplier (proxy for sensitive data handling)
  if (fingerprint.security_signals.has_secrets_manager) {
    tokens *= COST_FACTORS.data_sensitive_multiplier;
    drivers.push("secrets management");
  }

  const estimatedUsd = tokens * COST_FACTORS.cost_per_token_usd;

  return {
    estimated_monthly_tokens: Math.round(tokens),
    estimated_monthly_usd: Math.round(estimatedUsd * 100) / 100,
    cost_per_token_usd: COST_FACTORS.cost_per_token_usd,
    drivers,
  };
}

export interface TokenAttribution {
  agent_name?: string;
  skill_name?: string;
  rule_id?: string;
  tokens_used: number;
  percentage: number;
}

export function attributeTokens(
  totalTokens: number,
  agentCounts: Record<string, number> = {},
  skillCounts: Record<string, number> = {},
  ruleCounts: Record<string, number> = {}
): TokenAttribution[] {
  const attributions: TokenAttribution[] = [];

  // Agent-level attribution
  const agents = Object.entries(agentCounts);
  if (agents.length > 0) {
    const totalAgents = agents.reduce((sum, [_, count]) => sum + count, 0);
    for (const [agentName, count] of agents) {
      const percentage = (count / totalAgents) * 100;
      attributions.push({
        agent_name: agentName,
        tokens_used: Math.round((totalTokens * percentage) / 100),
        percentage,
      });
    }
  }

  // Skill-level attribution
  const skills = Object.entries(skillCounts);
  if (skills.length > 0) {
    const totalSkills = skills.reduce((sum, [_, count]) => sum + count, 0);
    for (const [skillName, count] of skills) {
      const percentage = (count / totalSkills) * 100;
      attributions.push({
        skill_name: skillName,
        tokens_used: Math.round((totalTokens * percentage) / 100),
        percentage,
      });
    }
  }

  // Rule-level attribution
  const rules = Object.entries(ruleCounts);
  if (rules.length > 0) {
    const totalRules = rules.reduce((sum, [_, count]) => sum + count, 0);
    for (const [ruleId, count] of rules) {
      const percentage = (count / totalRules) * 100;
      attributions.push({
        rule_id: ruleId,
        tokens_used: Math.round((totalTokens * percentage) / 100),
        percentage,
      });
    }
  }

  return attributions;
}

export function checkBudgetViolation(
  tokensUsed: number,
  costPerToken: number,
  monthlyBudgetUsd?: number,
  perSessionLimit?: number
): { violated: boolean; message?: string } {
  const costIncurred = tokensUsed * costPerToken;

  if (perSessionLimit && costIncurred > perSessionLimit) {
    return {
      violated: true,
      message: `Session cost $${costIncurred.toFixed(2)} exceeds per-session limit $${perSessionLimit.toFixed(2)}`,
    };
  }

  return { violated: false };
}
