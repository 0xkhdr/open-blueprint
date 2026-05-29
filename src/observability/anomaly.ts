import type { RuntimeMetrics } from "./semantic-drift.js";

export interface Anomaly {
  metric: string;
  value: number;
  zScore: number;
  timestamp: string;
  severity: "warning" | "critical";
}

export interface MetricStats {
  mean: number;
  stddev: number;
  p50: number;
  p99: number;
}

export interface PerformanceBaseline {
  established_at: string;
  metrics: Record<string, MetricStats>;
  sample_size: number;
}

const NUMERIC_KEYS: (keyof RuntimeMetrics)[] = [
  "total_tokens",
  "session_duration_ms",
  "error_rate",
  "success_rate",
];

export function establishPerformanceBaseline(
  metrics: RuntimeMetrics[],
  windowDays = 14
): PerformanceBaseline {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const windowed = metrics.filter((m) => new Date(m.timestamp).getTime() > cutoff);

  const result: Record<string, MetricStats> = {};

  for (const key of NUMERIC_KEYS) {
    const values = windowed
      .map((m) => m[key] as number)
      .filter((v): v is number => typeof v === "number");

    if (values.length > 0) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
      const stddev = Math.sqrt(variance);
      const sorted = [...values].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      result[key] = { mean, stddev, p50: p50 ?? 0, p99: p99 ?? 0 };
    }
  }

  return {
    established_at: new Date().toISOString(),
    metrics: result,
    sample_size: windowed.length,
  };
}

export function detectAnomalies(
  current: RuntimeMetrics,
  baseline: PerformanceBaseline,
  zThreshold = 3
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const [key, stats] of Object.entries(baseline.metrics)) {
    const value = current[key as keyof RuntimeMetrics] as number;
    if (value === undefined || stats.stddev === 0) continue;

    const zScore = Math.abs(value - stats.mean) / stats.stddev;
    if (zScore > zThreshold) {
      anomalies.push({
        metric: key,
        value,
        zScore,
        timestamp: current.timestamp,
        severity: zScore > zThreshold * 1.5 ? "critical" : "warning",
      });
    }
  }

  return anomalies;
}
