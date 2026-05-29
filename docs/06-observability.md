# Observability & Cost Governance (Phase 4)

**Status:** Implementation complete | **Release:** v1.1.0 | **Effort:** 10 engineer-days

---

## Overview

Phase 4 adds production-grade observability and cost governance to open-blueprint. Enable telemetry, track costs per-agent/per-skill, detect semantic drift, and set up intelligent alerting—all declaratively.

### Key Capabilities

- **Telemetry Integration**: OpenTelemetry, Datadog, New Relic, Prometheus, CloudWatch
- **Cost Tracking**: Per-agent, per-session budgets with token attribution
- **Semantic Drift Detection**: Behavioral changes, rule effectiveness, output divergence
- **Alerting & Anomaly Detection**: PagerDuty, Slack webhooks; statistical anomaly detection
- **Performance Metrics**: Latency baselines, error rates, success rates; Grafana/Datadog dashboards

---

## Telemetry Configuration

### Enabling Telemetry

Add to your blueprint `settings` section:

```yaml
# .claude/blueprint.yaml
telemetry:
  enabled: true
  provider: datadog  # or: opentelemetry, newrelic, prometheus, cloudwatch
  sampling_rate: 0.1  # 10% of traces
  datadog_config:
    app_name: my-agents
    service_name: agent-core
```

### Supported Providers

| Provider | Config File | Best For |
|----------|-------------|----------|
| **OpenTelemetry** | `otel-config.yaml` | Multi-vendor, standard traces |
| **Datadog** | `datadog.yaml` | APM, full observability stack |
| **New Relic** | `newrelic.ini` | Enterprise APM, compliance |
| **Prometheus** | `prometheus.yaml` | Metrics-only, Kubernetes-native |
| **CloudWatch** | `cloudwatch-config.json` | AWS-native logging & metrics |

**Generation:** Run `bp convert --target <backend>` to auto-generate provider configs.

---

## Cost Tracking & Budget Control

### Setting Budgets

```yaml
cost:
  cost_tracking_enabled: true
  monthly_budget_usd: 1000
  per_session_limit_usd: 50
  cost_per_token_usd: 0.00001
  cost_attribution_level: agent  # track costs per agent
  per_agent_budgets:
    - agent_name: researcher
      monthly_budget_usd: 400
    - agent_name: reviewer
      monthly_budget_usd: 300
```

### Cost Estimation

```bash
bp doctor --cost
```

Output:
```
┌─ Cost Report ─────────────────────┐
│ Monthly Estimate: $650.25         │
│ Per-Token Cost:   $0.00001        │
│ Tokens/Month:     65,025,000      │
├─ By Agent ───────────────────────┤
│ researcher:  $400.10 (61.6%)     │
│ reviewer:    $250.15 (38.4%)     │
├─ Budget Status ──────────────────┤
│ ✓ researcher: $400 budget OK      │
│ ✓ reviewer:   $300 budget OK      │
└───────────────────────────────────┘
```

### Cost Attribution

Three attribution levels:

1. **agent** — Total cost per agent (recommended for multi-agent orchestration)
2. **skill** — Cost per skill (identify expensive operations)
3. **rule** — Cost per rule (optimize rule efficiency)

Set in `cost_attribution_level`.

---

## Semantic Drift Detection

### What is Semantic Drift?

**File-level drift** (Phase 1): Detected language/framework changes.  
**Semantic drift** (Phase 4): Behavioral changes that files don't capture.

### Types of Semantic Drift

#### 1. **Behavioral Drift**
Agent output changes unexpectedly (even if code is identical).

**Detected via:** Output similarity scoring. Tracks snapshots of generated code/responses.

```bash
bp verify --drift semantic
```

Output:
```
⚠️  Rule 'code-review' output divergence: 85% → 64% similarity
   Last 10 outputs show significant pattern shift
   Possible causes: Model update, rule context drift, instruction creep
```

#### 2. **Rule Effectiveness Drift**
Rules no longer catch the issues they were designed for.

**Metrics tracked:**
- Success rate (% of invocations where rule fired)
- False positive rate
- Time since last successful execution

#### 3. **Cost Drift**
Token usage anomalies (unusually high or low usage).

**Detected via:** Statistical anomaly detection (>2σ from baseline).

```bash
# Check cost history
cat .bp-cost-history.json | jq '.[] | select(.tokens_used > 100000)'
```

### Enabling Semantic Drift

```yaml
semantic_drift:
  semantic_drift_enabled: true
  behavioral_analysis_enabled: true
  rule_effectiveness_tracking: true
  cost_drift_detection: true
  output_comparison_enabled: true
  similarity_threshold: 0.7  # flag if < 70% similar
```

---

## Alerting & Anomaly Detection

### Policy Violations

Define rules that trigger alerts:

```yaml
alerting:
  alerting_enabled: true
  policy_violations:
    - policy_name: cost-overrun
      condition: "monthly_cost > budget"
      action: "notify-slack"
      severity: critical
    - policy_name: high-error-rate
      condition: "error_rate > 0.05"
      action: "page-oncall"
      severity: critical
    - policy_name: rule-ineffective
      condition: "rule_success_rate < 0.2"
      action: "notify-slack"
      severity: warning
  budget_overrun_alerts: true
  anomaly_detection:
    enabled: true
    std_dev_threshold: 2.0  # flag if > 2σ from baseline
    min_baseline_samples: 10
```

### Notification Channels

```yaml
notification_channels:
  - channel_type: slack
    endpoint: https://hooks.slack.com/services/YOUR/WEBHOOK/URL
    severity_filter: [warning, critical]
  - channel_type: pagerduty
    endpoint: https://events.pagerduty.com/v2/enqueue
    webhook_auth: "Authorization: Token token=YOUR_TOKEN"
    severity_filter: [critical]
  - channel_type: email
    endpoint: oncall@company.com
    severity_filter: [critical]
  - channel_type: webhook
    endpoint: https://custom-webhook.internal/alerts
    webhook_auth: "Authorization: Bearer YOUR_TOKEN"
```

### Slack Integration

Example alert message:

```
🚨 CRITICAL: Cost Overrun
Monthly spend ($1,250) exceeds budget ($1,000)
👤 researcher agent: $750 / $400 budget [OVER]
👤 reviewer agent: $500 / $300 budget [OVER]
⏱️ 2026-05-28T10:45:00Z
```

### PagerDuty Integration

```yaml
notification_channels:
  - channel_type: pagerduty
    endpoint: https://events.pagerduty.com/v2/enqueue
    webhook_auth: "Authorization: Token token=pd_rsa_xyz..."
    severity_filter: [critical]
```

Triggers incident with:
- Summary: Alert title
- Severity: critical/warning/info
- Source: open-blueprint
- Custom details: Alert context

---

## Performance Metrics

### Metrics Collection

Enable in `metrics` section:

```yaml
metrics:
  metrics_enabled: true
  latency_baseline_ms: 1000
  error_rate_threshold: 0.05
  success_rate_baseline: 0.95
  per_skill_metrics:
    - skill_name: research
      avg_latency_ms: 1500
      error_rate: 0.03
      execution_count: 1000
  custom_metrics:
    - metric_name: policy_violations_per_rule
      type: histogram
      description: "Distribution of violations per rule"
```

### Grafana Dashboards

Auto-generate Grafana dashboard:

```bash
bp generate-dashboard --platform grafana --output grafana-dashboard.json
```

Includes panels:
- P50, P95, P99 latency by skill
- Error rate trends
- Success rate by rule
- Custom metric timeseries

### Datadog Integration

Auto-generate Datadog monitors:

```bash
bp generate-monitors --platform datadog --output datadog-monitors.yaml
```

Datadog monitors:
- High latency alert (P95 > baseline × 1.5)
- High error rate alert (rate > threshold)
- Cost overage alerts

### Prometheus Rules

```bash
bp generate-alerts --platform prometheus --output prometheus-rules.yaml
```

Creates alert rules for:
- HighAgentLatency
- HighErrorRate
- CostDrift
- RuleIneffective

---

## Command Reference

### `bp doctor --cost`
Generate cost report with per-agent/skill/rule breakdown.

### `bp verify --drift semantic`
Check for semantic drift (behavioral, rule effectiveness, cost anomalies).

### `bp generate-dashboard --platform <platform>`
Generate observability dashboard config (grafana, datadog, prometheus).

### `bp generate-monitors --platform <platform>`
Generate alerting rules for observability platform.

### `bp config cost --monthly-budget 1000`
Set monthly budget (CLI shorthand).

---

## Best Practices

### 1. Start with Telemetry
Collect baseline metrics before setting strict budget/alert policies.

```bash
bp convert --target claude --include-telemetry
# Let run for 1–2 weeks, collect baselines
```

### 2. Set Conservative Budgets
Start at 150% of actual spend, then tighten.

```yaml
cost:
  monthly_budget_usd: 1500  # Actual: ~$1000
```

### 3. Use Multi-Level Alerting
- **info**: Informational changes (new rules added, drift detected)
- **warning**: Policy violations close to threshold
- **critical**: Hard limits (budget overrun, high error rates)

### 4. Track Rule Effectiveness Quarterly
Review which rules are catching issues; deprecate ineffective ones.

```bash
bp doctor --drift semantic | grep "RULE_INEFFECTIVE"
```

### 5. Separate Prod/Staging Budgets
Prod agents get lower error thresholds; staging can tolerate higher costs.

```yaml
per_agent_budgets:
  - agent_name: prod-researcher
    monthly_budget_usd: 500
  - agent_name: staging-researcher
    monthly_budget_usd: 200
```

---

## Troubleshooting

### "Cost estimates seem high/low"
**Cause:** Cost factors based on project complexity (languages, APIs, auth).  
**Fix:** Adjust `cost_per_token_usd` based on real usage:
```bash
# Track actual tokens in logs
bp doctor --cost --actual-usage
```

### "No anomalies detected but I see cost spikes"
**Cause:** Need more baseline samples (min 10 recommended).  
**Fix:** Increase `min_baseline_samples` and collect 1–2 weeks of data:
```yaml
anomaly_detection:
  min_baseline_samples: 20
```

### "Slack webhook returns 403"
**Cause:** Invalid webhook URL or expired token.  
**Fix:** Regenerate webhook in Slack app, test with curl:
```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"blocks":[{"type":"section","text":{"type":"plain_text","text":"Test"}}]}' \
  YOUR_WEBHOOK_URL
```

### "Datadog monitors not triggering"
**Cause:** Monitor thresholds too loose or query syntax wrong.  
**Fix:** Validate in Datadog UI first:
1. Go to Monitors → New Monitor
2. Test your query: `avg:agent.latency.ms{*}`
3. Set threshold and test condition
4. Export as YAML

---

## Metrics Schema Reference

### Telemetry Schema
```typescript
telemetry: {
  enabled: boolean;
  provider: "opentelemetry" | "datadog" | "newrelic" | "prometheus" | "cloudwatch";
  sampling_rate: number;  // 0-1
  custom_attributes: Record<string, string>;
}
```

### Cost Schema
```typescript
cost: {
  cost_tracking_enabled: boolean;
  cost_per_token_usd: number;
  monthly_budget_usd?: number;
  per_session_limit_usd?: number;
  cost_attribution_level: "agent" | "skill" | "rule";
  per_agent_budgets?: Array<{ agent_name: string; monthly_budget_usd: number }>;
}
```

### Metrics Schema
```typescript
metrics: {
  metrics_enabled: boolean;
  latency_baseline_ms: number;
  error_rate_threshold: number;  // 0-1
  success_rate_baseline: number;  // 0-1
  per_skill_metrics?: Array<{ skill_name: string; avg_latency_ms: number; error_rate: number }>;
  custom_metrics?: Array<{ metric_name: string; type: "gauge"|"counter"|"histogram" }>;
}
```

### Alerting Schema
```typescript
alerting: {
  alerting_enabled: boolean;
  policy_violations?: Array<{ policy_name: string; condition: string; severity: "info"|"warning"|"critical" }>;
  anomaly_detection?: { enabled: boolean; std_dev_threshold: number; min_baseline_samples: number };
  notification_channels?: Array<{ channel_type: string; endpoint: string; severity_filter: string[] }>;
}
```

---

## See Also

- [Cost Tracking Guide](#cost-tracking--budget-control)
- [Semantic Drift Detection](#semantic-drift-detection)
- [Alerting & Webhooks](#alerting--anomaly-detection)
- [Metrics Dashboard Setup](#performance-metrics)
- [REGRESSION_ANALYSIS.md Phase 4](../REGRESSION_ANALYSIS.md#phase-4-observability--cost-weeks-21-26)
