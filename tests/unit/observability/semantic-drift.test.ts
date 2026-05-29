import { describe, it, expect } from "vitest";
import {
  establishBaseline,
  detectSemanticDrift,
  type RuntimeMetrics,
  type BehaviorBaseline,
} from "../../../src/observability/semantic-drift.js";

function makeMetric(overrides: Partial<RuntimeMetrics> = {}): RuntimeMetrics {
  return {
    timestamp: new Date().toISOString(),
    total_tokens: 50000,
    session_duration_ms: 120000,
    error_rate: 0.02,
    success_rate: 0.98,
    rule_success_rate: { "rule-a": 0.9, "rule-b": 0.8 },
    agent_action_distribution: { read: 0.7, write: 0.3 },
    skill_invocation_count: { "skill-x": 20, "skill-y": 5 },
    ...overrides,
  };
}

function makeBaseline(overrides: Partial<BehaviorBaseline> = {}): BehaviorBaseline {
  return {
    established_at: new Date().toISOString(),
    rule_success_rate: { "rule-a": 0.9, "rule-b": 0.8 },
    total_tokens: 50000,
    session_duration_ms: 120000,
    agent_action_distribution: { read: 0.7, write: 0.3 },
    skill_invocation_count: { "skill-x": 20, "skill-y": 5 },
    ...overrides,
  };
}

describe("establishBaseline", () => {
  it("returns baseline with established_at", () => {
    const metrics = [makeMetric()];
    const baseline = establishBaseline(metrics, 7);
    expect(baseline.established_at).toBeTruthy();
  });

  it("computes average total_tokens", () => {
    const metrics = [
      makeMetric({ total_tokens: 40000 }),
      makeMetric({ total_tokens: 60000 }),
    ];
    const baseline = establishBaseline(metrics, 7);
    expect(baseline.total_tokens).toBe(50000);
  });

  it("averages rule_success_rate across metrics", () => {
    const metrics = [
      makeMetric({ rule_success_rate: { "rule-a": 0.8 } }),
      makeMetric({ rule_success_rate: { "rule-a": 1.0 } }),
    ];
    const baseline = establishBaseline(metrics, 7);
    expect(baseline.rule_success_rate["rule-a"]).toBeCloseTo(0.9);
  });

  it("averages skill_invocation_count", () => {
    const metrics = [
      makeMetric({ skill_invocation_count: { "skill-x": 10 } }),
      makeMetric({ skill_invocation_count: { "skill-x": 30 } }),
    ];
    const baseline = establishBaseline(metrics, 7);
    expect(baseline.skill_invocation_count["skill-x"]).toBeCloseTo(20);
  });

  it("filters out metrics outside window", () => {
    const old = makeMetric({
      total_tokens: 999999,
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const recent = makeMetric({ total_tokens: 50000 });
    const baseline = establishBaseline([old, recent], 7);
    expect(baseline.total_tokens).toBe(50000);
  });

  it("returns zeros for empty metrics array", () => {
    const baseline = establishBaseline([], 7);
    expect(baseline.total_tokens).toBe(0);
    expect(baseline.session_duration_ms).toBe(0);
  });

  it("handles multiple rules in rule_success_rate", () => {
    const metrics = [
      makeMetric({ rule_success_rate: { "rule-a": 0.8, "rule-b": 0.6 } }),
    ];
    const baseline = establishBaseline(metrics, 7);
    expect(baseline.rule_success_rate["rule-a"]).toBeCloseTo(0.8);
    expect(baseline.rule_success_rate["rule-b"]).toBeCloseTo(0.6);
  });

  it("aggregates keys from multiple metrics with different rules", () => {
    const m1 = makeMetric({ rule_success_rate: { "rule-a": 0.8 } });
    const m2 = makeMetric({ rule_success_rate: { "rule-b": 0.6 } });
    const baseline = establishBaseline([m1, m2], 7);
    expect(baseline.rule_success_rate["rule-a"]).toBeDefined();
    expect(baseline.rule_success_rate["rule-b"]).toBeDefined();
  });
});

describe("detectSemanticDrift", () => {
  it("returns empty drifts when no deviation", () => {
    const baseline = makeBaseline();
    const current = makeMetric();
    const report = detectSemanticDrift(baseline, current);
    expect(report.drifts.filter((d) => d.type === "rule_effectiveness")).toHaveLength(0);
    expect(report.drifts.filter((d) => d.type === "token_inflation")).toHaveLength(0);
  });

  it("detects rule_effectiveness drift", () => {
    const baseline = makeBaseline({ rule_success_rate: { "rule-a": 0.9 } });
    const current = makeMetric({ rule_success_rate: { "rule-a": 0.5 } });
    const report = detectSemanticDrift(baseline, current, 0.15);
    const drift = report.drifts.find((d) => d.type === "rule_effectiveness" && d.target === "rule-a");
    expect(drift).toBeDefined();
    expect(drift!.deviation).toBeCloseTo(0.4);
  });

  it("marks rule drift as critical when current < 50% of baseline", () => {
    const baseline = makeBaseline({ rule_success_rate: { "rule-a": 1.0 } });
    const current = makeMetric({ rule_success_rate: { "rule-a": 0.3 } });
    const report = detectSemanticDrift(baseline, current, 0.1);
    const drift = report.drifts.find((d) => d.target === "rule-a");
    expect(drift?.severity).toBe("critical");
  });

  it("marks rule drift as warning when current >= 50% of baseline", () => {
    const baseline = makeBaseline({ rule_success_rate: { "rule-a": 0.9 } });
    const current = makeMetric({ rule_success_rate: { "rule-a": 0.7 } });
    const report = detectSemanticDrift(baseline, current, 0.1);
    const drift = report.drifts.find((d) => d.target === "rule-a");
    expect(drift?.severity).toBe("warning");
  });

  it("detects token_inflation drift", () => {
    const baseline = makeBaseline({ total_tokens: 50000 });
    const current = makeMetric({ total_tokens: 80000 });
    const report = detectSemanticDrift(baseline, current, 0.15);
    const drift = report.drifts.find((d) => d.type === "token_inflation");
    expect(drift).toBeDefined();
    expect(drift!.deviation).toBeCloseTo(0.6);
  });

  it("marks token inflation as critical when > 50% growth", () => {
    const baseline = makeBaseline({ total_tokens: 50000 });
    const current = makeMetric({ total_tokens: 100000 });
    const report = detectSemanticDrift(baseline, current, 0.1);
    const drift = report.drifts.find((d) => d.type === "token_inflation");
    expect(drift?.severity).toBe("critical");
  });

  it("detects skill_degradation drift", () => {
    const baseline = makeBaseline({ skill_invocation_count: { "skill-x": 100 } });
    const current = makeMetric({ skill_invocation_count: { "skill-x": 10 } });
    const report = detectSemanticDrift(baseline, current, 0.15);
    const drift = report.drifts.find((d) => d.type === "skill_degradation");
    expect(drift).toBeDefined();
  });

  it("does not flag skill degradation for low baseline counts (<=10)", () => {
    const baseline = makeBaseline({ skill_invocation_count: { "skill-y": 5 } });
    const current = makeMetric({ skill_invocation_count: { "skill-y": 0 } });
    const report = detectSemanticDrift(baseline, current, 0.15);
    const drift = report.drifts.find((d) => d.type === "skill_degradation");
    expect(drift).toBeUndefined();
  });

  it("summary counts match drift array", () => {
    const baseline = makeBaseline({
      rule_success_rate: { "rule-a": 1.0 },
      total_tokens: 50000,
    });
    const current = makeMetric({
      rule_success_rate: { "rule-a": 0.2 },
      total_tokens: 120000,
    });
    const report = detectSemanticDrift(baseline, current, 0.1);
    expect(report.summary.total_drifts).toBe(report.drifts.length);
    const criticals = report.drifts.filter((d) => d.severity === "critical").length;
    expect(report.summary.critical).toBe(criticals);
  });

  it("returns timestamp in report", () => {
    const report = detectSemanticDrift(makeBaseline(), makeMetric());
    expect(report.timestamp).toBeTruthy();
    expect(new Date(report.timestamp).getTime()).toBeGreaterThan(0);
  });

  it("respects custom threshold", () => {
    const baseline = makeBaseline({ rule_success_rate: { "rule-a": 0.9 } });
    const current = makeMetric({ rule_success_rate: { "rule-a": 0.88 } });
    const reportStrict = detectSemanticDrift(baseline, current, 0.01);
    const reportLoose = detectSemanticDrift(baseline, current, 0.5);
    expect(reportStrict.drifts.length).toBeGreaterThan(reportLoose.drifts.length);
  });

  it("handles missing rule in current metrics (uses 0)", () => {
    const baseline = makeBaseline({ rule_success_rate: { "rule-a": 0.9 } });
    const current = makeMetric({ rule_success_rate: {} });
    const report = detectSemanticDrift(baseline, current, 0.1);
    const drift = report.drifts.find((d) => d.target === "rule-a");
    expect(drift).toBeDefined();
    expect(drift!.current).toBe(0);
  });

  it("no token inflation when baseline is 0", () => {
    const baseline = makeBaseline({ total_tokens: 0 });
    const current = makeMetric({ total_tokens: 100000 });
    const report = detectSemanticDrift(baseline, current, 0.15);
    const tokenDrift = report.drifts.find((d) => d.type === "token_inflation");
    expect(tokenDrift).toBeUndefined();
  });

  it("multiple drifts detected simultaneously", () => {
    const baseline = makeBaseline({
      rule_success_rate: { "rule-a": 1.0 },
      total_tokens: 50000,
      skill_invocation_count: { "skill-x": 100 },
    });
    const current = makeMetric({
      rule_success_rate: { "rule-a": 0.2 },
      total_tokens: 120000,
      skill_invocation_count: { "skill-x": 5 },
    });
    const report = detectSemanticDrift(baseline, current, 0.1);
    expect(report.drifts.length).toBeGreaterThanOrEqual(3);
  });

  it("drift deviation is always positive", () => {
    const baseline = makeBaseline({ rule_success_rate: { "rule-a": 0.5, "rule-b": 0.9 } });
    const current = makeMetric({ rule_success_rate: { "rule-a": 0.9, "rule-b": 0.1 } });
    const report = detectSemanticDrift(baseline, current, 0.1);
    for (const d of report.drifts) {
      expect(d.deviation).toBeGreaterThan(0);
    }
  });
});
