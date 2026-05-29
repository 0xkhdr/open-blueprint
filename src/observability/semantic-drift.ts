export interface RuntimeMetrics {
  timestamp: string;
  total_tokens: number;
  session_duration_ms: number;
  error_rate: number;
  success_rate: number;
  rule_success_rate: Record<string, number>;
  agent_action_distribution: Record<string, number>;
  skill_invocation_count: Record<string, number>;
}

export interface BehaviorBaseline {
  established_at: string;
  rule_success_rate: Record<string, number>;
  total_tokens: number;
  session_duration_ms: number;
  agent_action_distribution: Record<string, number>;
  skill_invocation_count: Record<string, number>;
}

export interface DriftEntry {
  type:
    | "rule_effectiveness"
    | "skill_degradation"
    | "agent_behavior"
    | "scope_creep"
    | "token_inflation";
  target: string;
  baseline: number;
  current: number;
  deviation: number;
  severity: "warning" | "critical";
}

export interface DriftReport {
  timestamp: string;
  drifts: DriftEntry[];
  summary: {
    total_drifts: number;
    critical: number;
    warning: number;
  };
}

export function establishBaseline(metrics: RuntimeMetrics[], windowDays = 7): BehaviorBaseline {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const windowed = metrics.filter((m) => new Date(m.timestamp).getTime() > cutoff);

  return {
    established_at: new Date().toISOString(),
    rule_success_rate: averageByKey(windowed, "rule_success_rate"),
    total_tokens: average(windowed.map((m) => m.total_tokens)),
    session_duration_ms: average(windowed.map((m) => m.session_duration_ms)),
    agent_action_distribution: averageByKey(windowed, "agent_action_distribution"),
    skill_invocation_count: averageByKey(windowed, "skill_invocation_count"),
  };
}

export function detectSemanticDrift(
  baseline: BehaviorBaseline,
  current: RuntimeMetrics,
  threshold = 0.15
): DriftReport {
  const drifts: DriftEntry[] = [];

  for (const [ruleId, baselineRate] of Object.entries(baseline.rule_success_rate)) {
    const currentRate = current.rule_success_rate?.[ruleId] ?? 0;
    const deviation = Math.abs(currentRate - baselineRate);
    if (deviation > threshold) {
      drifts.push({
        type: "rule_effectiveness",
        target: ruleId,
        baseline: baselineRate,
        current: currentRate,
        deviation,
        severity: currentRate < baselineRate * 0.5 ? "critical" : "warning",
      });
    }
  }

  if (baseline.total_tokens > 0) {
    const tokenGrowth = (current.total_tokens - baseline.total_tokens) / baseline.total_tokens;
    if (tokenGrowth > threshold) {
      drifts.push({
        type: "token_inflation",
        target: "global",
        baseline: baseline.total_tokens,
        current: current.total_tokens,
        deviation: tokenGrowth,
        severity: tokenGrowth > 0.5 ? "critical" : "warning",
      });
    }
  }

  for (const [skillId, baselineCount] of Object.entries(baseline.skill_invocation_count)) {
    const currentCount = current.skill_invocation_count?.[skillId] ?? 0;
    if (baselineCount > 10 && currentCount < baselineCount * 0.3) {
      drifts.push({
        type: "skill_degradation",
        target: skillId,
        baseline: baselineCount,
        current: currentCount,
        deviation: 1 - currentCount / baselineCount,
        severity: "warning",
      });
    }
  }

  return {
    timestamp: new Date().toISOString(),
    drifts,
    summary: {
      total_drifts: drifts.length,
      critical: drifts.filter((d) => d.severity === "critical").length,
      warning: drifts.filter((d) => d.severity === "warning").length,
    },
  };
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function averageByKey(
  metrics: RuntimeMetrics[],
  key: keyof Pick<
    RuntimeMetrics,
    "rule_success_rate" | "agent_action_distribution" | "skill_invocation_count"
  >
): Record<string, number> {
  const result: Record<string, number> = {};
  const allKeys = new Set<string>();
  for (const m of metrics) {
    const val = m[key] as Record<string, number> | undefined;
    if (val) {
      Object.keys(val).forEach((k) => {
        allKeys.add(k);
      });
    }
  }
  for (const k of allKeys) {
    const values = metrics
      .map((m) => (m[key] as Record<string, number> | undefined)?.[k])
      .filter((v): v is number => v !== undefined);
    result[k] = average(values);
  }

  return result;
}
