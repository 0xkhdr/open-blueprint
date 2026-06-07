# Observability & Cost Governance

Configure telemetry, cost budgets, behavioral drift detection, and alerting policy for your open-blueprint deployment.

---

## Telemetry Configuration

Add to your blueprint `settings` section:

```yaml
# .claude/blueprint.yaml
telemetry:
  enabled: true
  provider: datadog  # opentelemetry | newrelic | prometheus | cloudwatch
  sampling_rate: 0.1
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

Run `bp convert --target <backend>` to auto-generate provider configs.

---

## Cost Tracking & Budget Control

```yaml
cost:
  cost_tracking_enabled: true
  monthly_budget_usd: 1000
  per_session_limit_usd: 50
  cost_per_token_usd: 0.00001
  cost_attribution_level: agent
  per_agent_budgets:
    - agent_name: researcher
      monthly_budget_usd: 400
    - agent_name: reviewer
      monthly_budget_usd: 300
```

**Attribution levels:** `agent` | `skill` | `rule`

Generate a cost report:

```bash
bp doctor --cost
```

---

## Behavioral Drift Detection

Behavioral drift tracks runtime/behavioral changes (rule success rates, token
usage, skill invocation counts) that a file-level diff does not capture. It
operates on metrics you collect — not on the natural-language content of rules —
so it requires real metrics input.

```yaml
semantic_drift:
  semantic_drift_enabled: true
  behavioral_analysis_enabled: true
  rule_effectiveness_tracking: true
  cost_drift_detection: true
  similarity_threshold: 0.7
```

Run drift checks against real metrics files:

```bash
# 1. Build a baseline from collected runtime metrics (NDJSON, one record per line)
bp drift baseline --metrics metrics.ndjson --json > baseline.json

# 2. Compare the latest metrics snapshot against the baseline
bp drift behavioral --baseline baseline.json --current current.json
```

> The legacy `bp drift semantic` alias is deprecated in favor of
> `bp drift behavioral`, which names what it actually measures.

Three drift types are tracked:

- **Behavioral drift** — agent output similarity drops below `similarity_threshold`
- **Rule effectiveness drift** — a rule's success rate falls below 20%
- **Cost drift** — token usage exceeds 2σ from baseline

---

## Alerting & Anomaly Detection

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
  anomaly_detection:
    enabled: true
    std_dev_threshold: 2.0
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
```

---

## Performance Metrics

```yaml
metrics:
  metrics_enabled: true
  latency_baseline_ms: 1000
  error_rate_threshold: 0.05
  success_rate_baseline: 0.95
```

Detect a telemetry platform from your dependencies and generate an init snippet:

```bash
bp telemetry detect                 # inspect deps/env for OpenTelemetry, Datadog, etc.
bp telemetry init --platform otel   # print an init config snippet for the platform
```

---

## Command Reference

These are the observability- and cost-related commands that actually ship with `bp`:

| Command | Description |
|---------|-------------|
| `bp doctor --cost` | Cost dashboard from the blueprint's configured `cost` section |
| `bp cost report` | Print the cost dashboard |
| `bp cost budget [limit]` | View or set the monthly budget |
| `bp cost attribution [level]` | View/set cost attribution granularity |
| `bp drift behavioral --baseline <f> --current <f>` | Compare real metrics files for behavioral drift |
| `bp drift baseline --metrics <ndjson>` | Build a baseline from a real NDJSON metrics file |
| `bp telemetry detect` | Auto-detect telemetry platform from dependencies |
| `bp telemetry init --platform <p>` | Generate a telemetry init config snippet |

> **Note:** Cost figures are computed from the values you configure in the
> blueprint's `cost` section (e.g. `cost_per_token_usd`, `estimated_monthly_tokens`).
> `bp` does not meter live token usage — wire those values from your provider's
> billing/telemetry to keep the dashboard accurate.

---

## See Also

- [Diagnostics & Troubleshooting](troubleshooting.md) — exit codes and bp health checks
- [Configuration System](configuration.md) — full schema for `.bp.json`
- [CLI Reference](commands.md) — all bp commands
