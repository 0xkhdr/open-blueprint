# Domain: Observability & Cost Governance
**Priority:** P2 · **Status:** ⚠️ SCHEMAS ONLY — Algorithms + dashboard missing · **Dependencies:** `01-IR-SCHEMA-FOUNDATION.md`, `07-MULTIAGENT-MCP.md`
**Agent Boundary:** IR schemas exist. Your job is implementing the actual detection algorithms, dashboard generator, and CLI integration.

---

## 1. Current State (Verified from Repo)

Already implemented in `src/translator/ir.ts`:
- ✅ `TelemetrySchema` — OpenTelemetry, Datadog, New Relic, Prometheus, CloudWatch configs
- ✅ `CostSchema` — cost_tracking, budgets, per-agent budgets, token tracking
- ✅ `MetricsSchema` — latency baselines, error rates, per-skill metrics, custom metrics
- ✅ `AlertingSchema` — policy violations, budget overrun, anomaly detection, notification channels
- ✅ `SemanticDriftSchema` — behavioral analysis, rule effectiveness, cost drift, output comparison

Already implemented in `src/validator/index.ts`:
- ✅ `validateCostConfig()` — cost validation
- ✅ `validateAlertingConfig()` — alerting validation

**Missing:**
- ❌ Semantic drift detection algorithm
- ❌ Anomaly detection algorithm (z-score)
- ❌ Cost dashboard generator
- ❌ Telemetry config auto-detection
- ❌ Alert rule engine
- ❌ Baseline establishment

---

## 2. Implementation Tasks

### Task 8.1: Semantic Drift Detection Algorithm
Create `src/observability/semantic-drift.ts`:

```typescript
import type { SemanticDrift, Metrics } from "../translator/ir.js";

export interface BehaviorBaseline {
  established_at: string;
  rule_success_rate: Record<string, number>;
  total_tokens: number;
  session_duration_ms: number;
  agent_action_distribution: Record<string, number>;
  skill_invocation_count: Record<string, number>;
}

export interface DriftReport {
  timestamp: string;
  drifts: Array<{
    type: "rule_effectiveness" | "skill_degradation" | "agent_behavior" | "scope_creep" | "token_inflation";
    target: string;
    baseline: number;
    current: number;
    deviation: number;
    severity: "warning" | "critical";
  }>;
  summary: {
    total_drifts: number;
    critical: number;
    warning: number;
  };
}

export function establishBaseline(
  metrics: Metrics[],
  windowDays: number = 7
): BehaviorBaseline {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const windowed = metrics.filter(m => new Date(m.timestamp).getTime() > cutoff);

  return {
    established_at: new Date().toISOString(),
    rule_success_rate: averageByKey(windowed, "rule_success_rate"),
    total_tokens: average(windowed.map(m => m.total_tokens)),
    session_duration_ms: average(windowed.map(m => m.session_duration_ms)),
    agent_action_distribution: averageByKey(windowed, "agent_action_distribution"),
    skill_invocation_count: averageByKey(windowed, "skill_invocation_count"),
  };
}

export function detectSemanticDrift(
  baseline: BehaviorBaseline,
  current: Metrics,
  threshold: number = 0.15
): DriftReport {
  const drifts = [];

  // Rule effectiveness drift
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

  // Token inflation
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

  // Skill degradation
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
      critical: drifts.filter(d => d.severity === "critical").length,
      warning: drifts.filter(d => d.severity === "warning").length,
    },
  };
}

function average(values: number[]): number {
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
}

function averageByKey(
  metrics: Metrics[],
  key: keyof Metrics
): Record<string, number> {
  const result: Record<string, number> = {};
  const allKeys = new Set<string>();

  for (const m of metrics) {
    const val = m[key] as Record<string, number> | undefined;
    if (val) Object.keys(val).forEach(k => allKeys.add(k));
  }

  for (const k of allKeys) {
    const values = metrics
      .map(m => (m[key] as Record<string, number> | undefined)?.[k])
      .filter((v): v is number => v !== undefined);
    result[k] = average(values);
  }

  return result;
}
```

### Task 8.2: Anomaly Detection Algorithm
Create `src/observability/anomaly.ts`:

```typescript
import type { Metrics } from "../translator/ir.js";

export interface Anomaly {
  metric: string;
  value: number;
  zScore: number;
  timestamp: string;
  severity: "warning" | "critical";
}

export interface PerformanceBaseline {
  established_at: string;
  metrics: Record<string, { mean: number; stddev: number; p50: number; p99: number }>;
  sample_size: number;
}

export function establishPerformanceBaseline(
  metrics: Metrics[],
  windowDays: number = 14
): PerformanceBaseline {
  const cutoff = Date.now() - windowDays * 24 * 60 * 60 * 1000;
  const windowed = metrics.filter(m => new Date(m.timestamp).getTime() > cutoff);

  const metricKeys: (keyof Metrics)[] = [
    "total_tokens",
    "session_duration_ms",
    "error_rate",
    "success_rate",
  ];

  const result: PerformanceBaseline["metrics"] = {};

  for (const key of metricKeys) {
    const values = windowed
      .map(m => m[key] as number)
      .filter((v): v is number => typeof v === "number");

    if (values.length > 0) {
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
      const stddev = Math.sqrt(variance);
      const sorted = [...values].sort((a, b) => a - b);
      const p50 = sorted[Math.floor(sorted.length * 0.5)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      result[key] = { mean, stddev, p50, p99 };
    }
  }

  return {
    established_at: new Date().toISOString(),
    metrics: result,
    sample_size: windowed.length,
  };
}

export function detectAnomalies(
  current: Metrics,
  baseline: PerformanceBaseline,
  zThreshold: number = 3
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  for (const [key, stats] of Object.entries(baseline.metrics)) {
    const value = current[key as keyof Metrics] as number;
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
```

### Task 8.3: Cost Dashboard Generator
Create `src/observability/dashboard.ts`:

```typescript
import type { BlueprintIR, Cost } from "../translator/ir.js";

export function generateCostDashboard(ir: BlueprintIR): string {
  const cost = ir.cost;
  if (!cost) return "# No cost tracking configured\n";

  const totalBudget = cost.budgets?.monthly_total ?? 0;
  const totalSpent = Object.values(cost.per_agent ?? {}).reduce(
    (sum, a) => sum + (a.cost_usd ?? 0), 0
  );
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  let md = `# Cost Dashboard: ${ir.spatial_anchor.project_name}\n\n`;
  md += `**Period:** Monthly | **Budget:** $${totalBudget.toFixed(2)} | **Spent:** $${totalSpent.toFixed(2)} (${percentUsed.toFixed(1)}%)\n\n`;

  // Progress bar
  const barLength = 30;
  const filled = Math.round((percentUsed / 100) * barLength);
  const bar = "█".repeat(filled) + "░".repeat(barLength - filled);
  md += `\`[${bar}]\` ${percentUsed.toFixed(1)}%\n\n`;

  // Per-agent breakdown
  md += "## By Agent\n\n";
  md += "| Agent | Tokens | Cost | % of Budget |\n";
  md += "|-------|--------|------|-------------|\n";
  for (const [agentId, data] of Object.entries(cost.per_agent ?? {})) {
    const agentPercent = totalBudget > 0 ? ((data.cost_usd ?? 0) / totalBudget) * 100 : 0;
    md += `| ${agentId} | ${data.tokens ?? 0} | $${(data.cost_usd ?? 0).toFixed(2)} | ${agentPercent.toFixed(1)}% |\n`;
  }

  // Per-rule breakdown
  md += "\n## By Rule\n\n";
  md += "| Rule | Invocations | Avg Tokens |\n";
  md += "|------|-------------|------------|\n";
  for (const [ruleId, data] of Object.entries(cost.per_rule ?? {})) {
    md += `| ${ruleId} | ${data.invocations ?? 0} | ${(data.avg_tokens ?? 0).toFixed(0)} |\n`;
  }

  // Alerts
  if (cost.budgets?.alert_threshold_percent && percentUsed > cost.budgets.alert_threshold_percent) {
    md += `\n## ⚠️ Alerts\n\n`;
    md += `- **Budget Alert:** Spending at ${percentUsed.toFixed(1)}% of monthly budget (threshold: ${cost.budgets.alert_threshold_percent}%)\n`;
  }

  return md;
}
```

### Task 8.4: Telemetry Auto-Detection
Create `src/observability/telemetry-detect.ts`:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";

export type TelemetryPlatform = "opentelemetry" | "datadog" | "newrelic" | "prometheus" | "cloudwatch";

export function detectTelemetryPlatform(projectRoot: string): TelemetryPlatform | undefined {
  const pkgPath = path.join(projectRoot, "package.json");
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };

    if (deps["@opentelemetry/api"] || deps["@opentelemetry/sdk-node"]) return "opentelemetry";
    if (deps["dd-trace"] || deps["datadog-lambda-js"]) return "datadog";
    if (deps["newrelic"]) return "newrelic";
    if (deps["prom-client"]) return "prometheus";
  }

  // Check config files
  if (fs.existsSync(path.join(projectRoot, "otel-collector-config.yaml"))) return "opentelemetry";
  if (fs.existsSync(path.join(projectRoot, "datadog.yaml"))) return "datadog";
  if (fs.existsSync(path.join(projectRoot, ".newrelic.js"))) return "newrelic";

  // Check env vars (if available)
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return "opentelemetry";
  if (process.env.DD_API_KEY) return "datadog";
  if (process.env.NEW_RELIC_LICENSE_KEY) return "newrelic";

  return undefined;
}
```

### Task 8.5: Alert Rule Engine
Create `src/observability/alerts.ts`:

```typescript
import type { Alerting, NotificationChannel } from "../translator/ir.js";

export interface AlertEvent {
  rule: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export function evaluateAlertRules(
  alerting: Alerting,
  metrics: Record<string, number>
): AlertEvent[] {
  const events: AlertEvent[] = [];

  for (const rule of alerting.policy_violations ?? []) {
    // Evaluate each rule condition
    const condition = parseCondition(rule.condition);
    if (evaluateCondition(condition, metrics)) {
      events.push({
        rule: rule.rule_id,
        severity: rule.severity,
        message: `Policy violation: ${rule.rule_id} — ${rule.condition}`,
        timestamp: new Date().toISOString(),
        metadata: { condition, metrics },
      });
    }
  }

  for (const rule of alerting.budget_overrun ?? []) {
    const threshold = rule.threshold;
    const current = metrics[`budget_${rule.budget_type}`] ?? 0;
    if (current > threshold) {
      events.push({
        rule: `budget_${rule.budget_type}`,
        severity: "critical",
        message: `Budget overrun: ${rule.budget_type} at ${current}% (threshold: ${threshold}%)`,
        timestamp: new Date().toISOString(),
        metadata: { threshold, current },
      });
    }
  }

  return events;
}

function parseCondition(condition: string): { metric: string; operator: string; value: number } {
  const match = condition.match(/(\w+)\s*(>|<|>=|<=|==)\s*(\d+(?:\.\d+)?)/);
  if (!match) throw new Error(`Invalid condition: ${condition}`);
  return { metric: match[1], operator: match[2], value: parseFloat(match[3]) };
}

function evaluateCondition(
  condition: { metric: string; operator: string; value: number },
  metrics: Record<string, number>
): boolean {
  const actual = metrics[condition.metric] ?? 0;
  switch (condition.operator) {
    case ">": return actual > condition.value;
    case "<": return actual < condition.value;
    case ">=": return actual >= condition.value;
    case "<=": return actual <= condition.value;
    case "==": return actual === condition.value;
    default: return false;
  }
}

export function formatAlertForChannel(
  event: AlertEvent,
  channel: NotificationChannel
): string {
  switch (channel) {
    case "slack":
      return JSON.stringify({
        text: `${event.severity === "critical" ? "🚨" : "⚠️"} Blueprint Alert: ${event.rule}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Severity:* ${event.severity}\n*Message:* ${event.message}\n*Time:* ${event.timestamp}`,
            },
          },
        ],
      });
    case "pagerduty":
      return JSON.stringify({
        routing_key: "{{key}}",
        event_action: "trigger",
        payload: {
          summary: event.message,
          severity: event.severity,
          source: "bp-cli",
        },
      });
    case "email":
      return `Subject: [${event.severity.toUpperCase()}] Blueprint Alert: ${event.rule}\n\n${event.message}\n\nTimestamp: ${event.timestamp}`;
    default:
      return JSON.stringify(event);
  }
}
```

### Task 8.6: CLI Integration
Update `src/cli/commands/`:
- [ ] `telemetry.ts` — `bp telemetry init`, `bp telemetry detect`
- [ ] `cost.ts` — `bp cost report`, `bp cost budget set`
- [ ] `drift.ts` — `bp drift semantic`, `bp drift baseline`
- [ ] `metrics.ts` — `bp metrics show`, `bp metrics baseline`
- [ ] `alert.ts` — `bp alert list`, `bp alert test`

---

## 3. Acceptance Criteria

- [ ] Semantic drift detection identifies rule effectiveness and token inflation
- [ ] Drift detection accuracy ≥ 85% on synthetic data
- [ ] Anomaly detection (z-score) catches deviations > 3 stddev
- [ ] Cost dashboard generated as markdown with progress bars
- [ ] Telemetry platform auto-detected from package.json deps
- [ ] Alert rules evaluated against metrics with correct severity
- [ ] Slack/PagerDuty/Email alert formatting correct
- [ ] All new CLI commands functional with `--json` output
- [ ] 80+ new tests, all passing
- [ ] Coverage for `src/observability/` ≥ 95%

---

## 4. Cross-References

| Concern | File | Status |
|---------|------|--------|
| IR schema for telemetry/cost | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Risk tier for alert severity | `03-DETECTOR-ENHANCEMENT.md` | ⚠️ Partial |
| Enterprise audit logging | `06-ENTERPRISE-GOVERNANCE.md` | ⚠️ Partial |
| Multi-agent cost per agent | `07-MULTIAGENT-MCP.md` | ⚠️ Partial |
| Production hardening (performance) | `09-PRODUCTION-HARDENING.md` | ❌ Not started |

---

*Domain Spec: Observability & Cost · open-blueprint v2.0*
