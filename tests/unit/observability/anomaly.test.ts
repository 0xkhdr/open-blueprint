import { describe, it, expect } from "bun:test";
import {
  establishPerformanceBaseline,
  detectAnomalies,
  type PerformanceBaseline,
} from "../../../src/observability/anomaly.js";
import type { RuntimeMetrics } from "../../../src/observability/semantic-drift.js";

function makeMetric(overrides: Partial<RuntimeMetrics> = {}): RuntimeMetrics {
  return {
    timestamp: new Date().toISOString(),
    total_tokens: 50000,
    session_duration_ms: 120000,
    error_rate: 0.02,
    success_rate: 0.98,
    rule_success_rate: {},
    agent_action_distribution: {},
    skill_invocation_count: {},
    ...overrides,
  };
}

function makeRecent(overrides: Partial<RuntimeMetrics> = {}): RuntimeMetrics {
  return makeMetric({
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  });
}

describe("establishPerformanceBaseline", () => {
  it("returns established_at timestamp", () => {
    const baseline = establishPerformanceBaseline([makeRecent()], 14);
    expect(baseline.established_at).toBeTruthy();
  });

  it("computes mean correctly for total_tokens", () => {
    const metrics = [
      makeRecent({ total_tokens: 40000 }),
      makeRecent({ total_tokens: 60000 }),
    ];
    const baseline = establishPerformanceBaseline(metrics, 14);
    expect(baseline.metrics["total_tokens"]?.mean).toBeCloseTo(50000);
  });

  it("computes stddev correctly", () => {
    const metrics = [
      makeRecent({ total_tokens: 50000 }),
      makeRecent({ total_tokens: 50000 }),
    ];
    const baseline = establishPerformanceBaseline(metrics, 14);
    expect(baseline.metrics["total_tokens"]?.stddev).toBeCloseTo(0);
  });

  it("computes p50 and p99", () => {
    const values = Array.from({ length: 100 }, (_, i) =>
      makeRecent({ total_tokens: (i + 1) * 1000 })
    );
    const baseline = establishPerformanceBaseline(values, 14);
    expect(baseline.metrics["total_tokens"]?.p50).toBeGreaterThan(0);
    expect(baseline.metrics["total_tokens"]?.p99).toBeGreaterThanOrEqual(
      baseline.metrics["total_tokens"]?.p50 ?? 0
    );
  });

  it("tracks sample_size", () => {
    const metrics = [makeRecent(), makeRecent(), makeRecent()];
    const baseline = establishPerformanceBaseline(metrics, 14);
    expect(baseline.sample_size).toBe(3);
  });

  it("filters metrics outside window", () => {
    const old = makeMetric({
      total_tokens: 999999,
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    });
    const recent = makeRecent({ total_tokens: 50000 });
    const baseline = establishPerformanceBaseline([old, recent], 14);
    expect(baseline.metrics["total_tokens"]?.mean).toBeCloseTo(50000);
    expect(baseline.sample_size).toBe(1);
  });

  it("handles empty metrics array", () => {
    const baseline = establishPerformanceBaseline([], 14);
    expect(baseline.sample_size).toBe(0);
    expect(Object.keys(baseline.metrics)).toHaveLength(0);
  });

  it("tracks error_rate metric", () => {
    const metrics = [makeRecent({ error_rate: 0.05 }), makeRecent({ error_rate: 0.03 })];
    const baseline = establishPerformanceBaseline(metrics, 14);
    expect(baseline.metrics["error_rate"]?.mean).toBeCloseTo(0.04);
  });

  it("tracks success_rate metric", () => {
    const metrics = [makeRecent({ success_rate: 0.95 }), makeRecent({ success_rate: 0.97 })];
    const baseline = establishPerformanceBaseline(metrics, 14);
    expect(baseline.metrics["success_rate"]?.mean).toBeCloseTo(0.96);
  });

  it("tracks session_duration_ms metric", () => {
    const metrics = [
      makeRecent({ session_duration_ms: 100000 }),
      makeRecent({ session_duration_ms: 140000 }),
    ];
    const baseline = establishPerformanceBaseline(metrics, 14);
    expect(baseline.metrics["session_duration_ms"]?.mean).toBeCloseTo(120000);
  });
});

describe("detectAnomalies", () => {
  function makeStableBaseline(overrides: Partial<PerformanceBaseline["metrics"]> = {}): PerformanceBaseline {
    return {
      established_at: new Date().toISOString(),
      sample_size: 50,
      metrics: {
        total_tokens: { mean: 50000, stddev: 5000, p50: 50000, p99: 65000 },
        session_duration_ms: { mean: 120000, stddev: 10000, p50: 120000, p99: 145000 },
        error_rate: { mean: 0.02, stddev: 0.005, p50: 0.02, p99: 0.035 },
        success_rate: { mean: 0.98, stddev: 0.01, p50: 0.98, p99: 0.99 },
        ...overrides,
      },
    };
  }

  it("returns no anomalies for normal values", () => {
    const baseline = makeStableBaseline();
    const current = makeMetric({ total_tokens: 50000, session_duration_ms: 120000 });
    const anomalies = detectAnomalies(current, baseline, 3);
    expect(anomalies).toHaveLength(0);
  });

  it("detects anomaly when z-score exceeds threshold", () => {
    const baseline = makeStableBaseline();
    const current = makeMetric({ total_tokens: 500000 }); // 90 stddevs away
    const anomalies = detectAnomalies(current, baseline, 3);
    const anomaly = anomalies.find((a) => a.metric === "total_tokens");
    expect(anomaly).toBeDefined();
    expect(anomaly!.zScore).toBeGreaterThan(3);
  });

  it("marks severity as critical when z-score > threshold * 1.5", () => {
    const baseline = makeStableBaseline();
    const current = makeMetric({ total_tokens: 500000 }); // extreme outlier
    const anomalies = detectAnomalies(current, baseline, 3);
    const anomaly = anomalies.find((a) => a.metric === "total_tokens");
    expect(anomaly?.severity).toBe("critical");
  });

  it("marks severity as warning when z-score is between threshold and threshold*1.5", () => {
    const baseline = makeStableBaseline({
      total_tokens: { mean: 50000, stddev: 5000, p50: 50000, p99: 65000 },
    });
    // 3.2 stddevs above mean: z=3.2, threshold=3, threshold*1.5=4.5 → warning
    const current = makeMetric({ total_tokens: 50000 + 5000 * 3.2 });
    const anomalies = detectAnomalies(current, baseline, 3);
    const anomaly = anomalies.find((a) => a.metric === "total_tokens");
    expect(anomaly?.severity).toBe("warning");
  });

  it("skips metric with stddev of 0 (no baseline variance)", () => {
    const baseline = makeStableBaseline({
      total_tokens: { mean: 50000, stddev: 0, p50: 50000, p99: 50000 },
    });
    const current = makeMetric({ total_tokens: 999999 });
    const anomalies = detectAnomalies(current, baseline, 3);
    const anomaly = anomalies.find((a) => a.metric === "total_tokens");
    expect(anomaly).toBeUndefined();
  });

  it("includes timestamp from current metrics", () => {
    const baseline = makeStableBaseline();
    const ts = "2026-01-01T00:00:00.000Z";
    const current = makeMetric({ total_tokens: 500000, timestamp: ts });
    const anomalies = detectAnomalies(current, baseline, 3);
    if (anomalies.length > 0) {
      expect(anomalies[0].timestamp).toBe(ts);
    }
  });

  it("detects anomaly on error_rate", () => {
    const baseline = makeStableBaseline();
    const current = makeMetric({ error_rate: 0.5 }); // very high error rate
    const anomalies = detectAnomalies(current, baseline, 3);
    const anomaly = anomalies.find((a) => a.metric === "error_rate");
    expect(anomaly).toBeDefined();
  });

  it("respects custom zThreshold", () => {
    const baseline = makeStableBaseline();
    const current = makeMetric({ total_tokens: 65000 }); // 3 stddevs
    const tight = detectAnomalies(current, baseline, 2);
    const loose = detectAnomalies(current, baseline, 4);
    expect(tight.length).toBeGreaterThanOrEqual(loose.length);
  });

  it("can detect multiple anomalies simultaneously", () => {
    const baseline = makeStableBaseline();
    const current = makeMetric({
      total_tokens: 500000,
      session_duration_ms: 1000000,
      error_rate: 0.5,
    });
    const anomalies = detectAnomalies(current, baseline, 3);
    expect(anomalies.length).toBeGreaterThanOrEqual(2);
  });

  it("anomaly value matches current metric value", () => {
    const baseline = makeStableBaseline();
    const current = makeMetric({ total_tokens: 999999 });
    const anomalies = detectAnomalies(current, baseline, 3);
    const anomaly = anomalies.find((a) => a.metric === "total_tokens");
    expect(anomaly?.value).toBe(999999);
  });
});
