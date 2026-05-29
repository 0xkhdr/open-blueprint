import type { BlueprintIR } from "../translator/ir.js";

export interface SkillMetrics {
  skill_name: string;
  avg_latency_ms: number;
  error_rate: number;
  success_rate: number;
  execution_count: number;
}

export interface PerformanceBaseline {
  measured_at: string;
  latency_baseline_ms: number;
  error_rate_threshold: number;
  success_rate_baseline: number;
  skill_metrics: SkillMetrics[];
  custom_metrics: Record<string, number>;
}

export function generateMetricsBaseline(ir: BlueprintIR): PerformanceBaseline {
  const baseline: PerformanceBaseline = {
    measured_at: new Date().toISOString(),
    latency_baseline_ms: ir.metrics?.latency_baseline_ms || 1000,
    error_rate_threshold: ir.metrics?.error_rate_threshold || 0.05,
    success_rate_baseline: ir.metrics?.success_rate_baseline || 0.95,
    skill_metrics: [],
    custom_metrics: {},
  };

  // Generate per-skill baselines
  if (ir.skills) {
    baseline.skill_metrics = ir.skills.map((skill) => ({
      skill_name: skill.name,
      avg_latency_ms: ir.metrics?.latency_baseline_ms || 1000,
      error_rate: ir.metrics?.error_rate_threshold || 0.05,
      success_rate: ir.metrics?.success_rate_baseline || 0.95,
      execution_count: 0,
    }));
  }

  // Add custom metrics
  if (ir.metrics?.custom_metrics) {
    for (const metric of ir.metrics.custom_metrics) {
      baseline.custom_metrics[metric.metric_name] = 0;
    }
  }

  return baseline;
}

export interface GrafanaDashboard {
  dashboard: {
    title: string;
    panels: GrafanaPanel[];
    refresh: string;
    time: { from: string; to: string };
  };
  overwrite: boolean;
}

interface GrafanaPanel {
  title: string;
  type: string;
  gridPos: { x: number; y: number; w: number; h: number };
  targets: Array<{ expr: string; legendFormat: string }>;
}

export function generateGrafanaDashboard(ir: BlueprintIR): GrafanaDashboard {
  const panels: GrafanaPanel[] = [];
  let yPos = 0;

  // Latency panel
  panels.push({
    title: "Agent Latency",
    type: "graph",
    gridPos: { x: 0, y: yPos, w: 12, h: 8 },
    targets: [
      {
        expr: "histogram_quantile(0.95, agent_latency_ms)",
        legendFormat: "P95 Latency (ms)",
      },
    ],
  });
  yPos += 8;

  // Error rate panel
  panels.push({
    title: "Error Rate",
    type: "graph",
    gridPos: { x: 12, y: yPos - 8, w: 12, h: 8 },
    targets: [
      {
        expr: "rate(agent_errors_total[5m])",
        legendFormat: "Error Rate",
      },
    ],
  });

  // Success rate panel
  panels.push({
    title: "Success Rate",
    type: "stat",
    gridPos: { x: 0, y: yPos, w: 12, h: 8 },
    targets: [
      {
        expr: "sum(rate(agent_successes_total[5m])) / (sum(rate(agent_successes_total[5m])) + sum(rate(agent_errors_total[5m])))",
        legendFormat: "Success Rate",
      },
    ],
  });

  // Per-skill metrics
  if (ir.skills) {
    for (const skill of ir.skills) {
      panels.push({
        title: `Skill: ${skill.name}`,
        type: "graph",
        gridPos: { x: 12, y: yPos, w: 12, h: 8 },
        targets: [
          {
            expr: `skill_latency_ms{skill="${skill.name}"}`,
            legendFormat: `${skill.name} Latency`,
          },
        ],
      });
      yPos += 8;
    }
  }

  return {
    dashboard: {
      title: `${ir.spatial_anchor.project_name} - Agent Metrics`,
      panels,
      refresh: "30s",
      time: { from: "now-1h", to: "now" },
    },
    overwrite: true,
  };
}

export interface DatadogMonitor {
  type: string;
  query: string;
  name: string;
  message: string;
  tags: string[];
  threshold: number;
}

export function generateDatadogMonitors(ir: BlueprintIR): DatadogMonitor[] {
  const monitors: DatadogMonitor[] = [];

  // Latency monitor
  monitors.push({
    type: "metric alert",
    query: `avg:agent.latency.ms{*}.rollup(avg, 300)`,
    name: `${ir.spatial_anchor.project_name}: High Latency`,
    message: "Agent latency exceeded threshold",
    tags: ["project:" + ir.spatial_anchor.project_name],
    threshold: ir.metrics?.latency_baseline_ms ? ir.metrics.latency_baseline_ms * 1.5 : 1500,
  });

  // Error rate monitor
  monitors.push({
    type: "metric alert",
    query: `avg:agent.error_rate{*}`,
    name: `${ir.spatial_anchor.project_name}: High Error Rate`,
    message: "Agent error rate exceeded threshold",
    tags: ["project:" + ir.spatial_anchor.project_name],
    threshold: ir.metrics?.error_rate_threshold || 0.1,
  });

  return monitors;
}

export interface PrometheusRules {
  groups: Array<{
    name: string;
    interval: string;
    rules: Array<{
      alert: string;
      expr: string;
      for: string;
      labels: Record<string, string>;
      annotations: Record<string, string>;
    }>;
  }>;
}

export function generatePrometheusRules(ir: BlueprintIR): PrometheusRules {
  return {
    groups: [
      {
        name: "agent_metrics",
        interval: "30s",
        rules: [
          {
            alert: "HighAgentLatency",
            expr: `histogram_quantile(0.95, agent_latency_ms) > ${ir.metrics?.latency_baseline_ms ? ir.metrics.latency_baseline_ms * 1.5 : 1500}`,
            for: "5m",
            labels: { severity: "warning" },
            annotations: {
              summary: "Agent latency is high",
              description: "P95 latency exceeded {{ $value }}ms",
            },
          },
          {
            alert: "HighErrorRate",
            expr: `rate(agent_errors_total[5m]) > ${ir.metrics?.error_rate_threshold || 0.1}`,
            for: "5m",
            labels: { severity: "critical" },
            annotations: {
              summary: "High agent error rate",
              description: "Error rate {{ $value }} exceeded threshold",
            },
          },
        ],
      },
    ],
  };
}
