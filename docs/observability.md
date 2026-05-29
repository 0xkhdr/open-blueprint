# Observability & Cost Governance

Configure telemetry, cost budgets, semantic drift detection, and alerting for your open-blueprint deployment.

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

## Semantic Drift Detection

Semantic drift tracks behavioral changes that file-level diff does not capture.

```yaml
semantic_drift:
  semantic_drift_enabled: true
  behavioral_analysis_enabled: true
  rule_effectiveness_tracking: true
  cost_drift_detection: true
  similarity_threshold: 0.7
```

Run drift checks:

```bash
bp verify --drift semantic
```

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

Generate dashboards:

```bash
bp generate-dashboard --platform grafana --output grafana-dashboard.json
bp generate-monitors --platform datadog --output datadog-monitors.yaml
bp generate-alerts --platform prometheus --output prometheus-rules.yaml
```

---

## Command Reference

| Command | Description |
|---------|-------------|
| `bp doctor --cost` | Cost report with per-agent/skill/rule breakdown |
| `bp verify --drift semantic` | Semantic drift check |
| `bp generate-dashboard --platform <p>` | Generate dashboard config |
| `bp generate-monitors --platform <p>` | Generate alerting rules |
| `bp config cost --monthly-budget 1000` | Set monthly budget |

---

## See Also

- [Diagnostics & Troubleshooting](troubleshooting.md) — exit codes and bp health checks
- [Configuration System](configuration.md) — full schema for `.bp.json`
- [CLI Reference](commands.md) — all bp commands
