import type { BlueprintIR, Telemetry } from "../ir.js";

export interface TelemetryConfig {
  provider: string;
  config: Record<string, unknown>;
  filename: string;
  content: string;
}

export function generateOpenTelemetryConfig(ir: BlueprintIR): TelemetryConfig | null {
  if (!ir.telemetry) return null;

  const config: Record<string, unknown> = {
    receivers: {
      otlp: {
        protocols: {
          grpc: {
            endpoint: ir.telemetry.otel_config?.endpoint || "localhost:4317",
          },
        },
      },
    },
    processors: {
      batch: {
        timeout: "10s",
        send_batch_size: 1024,
      },
    },
    exporters: {
      jaeger: {
        endpoint: ir.telemetry.otel_config?.endpoint || "http://localhost:14250",
      },
    },
    service: {
      pipelines: {
        traces: {
          receivers: ["otlp"],
          processors: ["batch"],
          exporters: ["jaeger"],
        },
      },
    },
  };

  let yaml = "# OpenTelemetry Configuration\n";
  yaml += "receivers:\n";
  yaml += "  otlp:\n";
  yaml += "    protocols:\n";
  yaml += "      grpc:\n";
  yaml += `        endpoint: ${ir.telemetry.otel_config?.endpoint || "localhost:4317"}\n`;
  yaml += "processors:\n";
  yaml += "  batch:\n";
  yaml += "    timeout: 10s\n";
  yaml += "    send_batch_size: 1024\n";
  yaml += "exporters:\n";
  yaml += "  jaeger:\n";
  yaml += `    endpoint: ${ir.telemetry.otel_config?.endpoint || "http://localhost:14250"}\n`;
  yaml += "service:\n";
  yaml += "  pipelines:\n";
  yaml += "    traces:\n";
  yaml += "      receivers: [otlp]\n";
  yaml += "      processors: [batch]\n";
  yaml += "      exporters: [jaeger]\n";

  return {
    provider: "opentelemetry",
    config,
    filename: "otel-config.yaml",
    content: yaml,
  };
}

export function generateDatadogConfig(ir: BlueprintIR): TelemetryConfig | null {
  if (!ir.telemetry || !ir.telemetry.datadog_config) return null;

  let yaml = "# Datadog Configuration\n";
  yaml += "api_key: ${DD_API_KEY}\n";

  if (ir.telemetry.datadog_config.app_name) {
    yaml += `app_name: ${ir.telemetry.datadog_config.app_name}\n`;
  }
  if (ir.telemetry.datadog_config.service_name) {
    yaml += `service_name: ${ir.telemetry.datadog_config.service_name}\n`;
  }

  yaml += "apm:\n";
  yaml += "  enabled: true\n";
  yaml += "  hostname: localhost\n";
  yaml += "  port: 8126\n";
  yaml += "logs:\n";
  yaml += "  enabled: true\n";
  yaml += "metrics:\n";
  yaml += "  enabled: true\n";

  if (ir.telemetry.custom_attributes) {
    yaml += "tags:\n";
    for (const [key, val] of Object.entries(ir.telemetry.custom_attributes)) {
      yaml += `  ${key}: ${val}\n`;
    }
  }

  return {
    provider: "datadog",
    config: {},
    filename: "datadog.yaml",
    content: yaml,
  };
}

export function generateNewRelicConfig(ir: BlueprintIR): TelemetryConfig | null {
  if (!ir.telemetry || !ir.telemetry.newrelic_config) return null;

  let ini = "# New Relic Configuration\n";
  ini += "[newrelic]\n";
  ini += "license_key = ${NEW_RELIC_LICENSE_KEY}\n";

  if (ir.telemetry.newrelic_config.app_name) {
    ini += `app_name = ${ir.telemetry.newrelic_config.app_name}\n`;
  }

  ini += "monitor_mode = true\n";
  ini += "high_security = false\n";
  ini += "apm_enabled = true\n";
  ini += "logs_enabled = true\n";

  return {
    provider: "newrelic",
    config: {},
    filename: "newrelic.ini",
    content: ini,
  };
}

export function generatePrometheusConfig(ir: BlueprintIR): TelemetryConfig | null {
  if (!ir.telemetry || !ir.metrics) return null;

  let yaml = "# Prometheus Scrape Configuration\n";
  yaml += "global:\n";
  yaml += "  scrape_interval: 15s\n";
  yaml += "  evaluation_interval: 15s\n";
  yaml += "scrape_configs:\n";
  yaml += "  - job_name: agent-metrics\n";
  yaml += "    static_configs:\n";
  yaml += "      - targets: ['localhost:8888']\n";

  if (ir.metrics.custom_metrics && ir.metrics.custom_metrics.length > 0) {
    yaml += "\n# Custom Metrics\n";
    for (const metric of ir.metrics.custom_metrics) {
      yaml += `# ${metric.metric_name} (${metric.type})\n`;
      if (metric.description) {
        yaml += `# Description: ${metric.description}\n`;
      }
    }
  }

  return {
    provider: "prometheus",
    config: {},
    filename: "prometheus.yaml",
    content: yaml,
  };
}

export function generateCloudWatchConfig(ir: BlueprintIR): TelemetryConfig | null {
  if (!ir.telemetry) return null;

  let json = JSON.stringify(
    {
      agent: {
        metrics_collection_interval: 60,
        logfile: "/opt/aws/amazon-cloudwatch-agent/logs/amazon-cloudwatch-agent.log",
        debug: false,
      },
      logs: {
        logs_collected: {
          files: {
            collect_list: [
              {
                file_path: "/var/log/agent.log",
                log_group_name: ir.spatial_anchor.project_name,
                log_stream_name: "agent-logs",
              },
            ],
          },
        },
      },
      metrics: {
        metrics_collected: {
          cpu: {
            measurement: [{ name: "cpu_usage_idle", rename: "CPU_IDLE", unit: "Percent" }],
            metrics_collection_interval: 60,
          },
          disk: {
            measurement: [{ name: "used_percent", rename: "DISK_USED", unit: "Percent" }],
            metrics_collection_interval: 60,
            resources: ["*"],
          },
          mem: {
            measurement: [{ name: "mem_used_percent", rename: "MEM_USED", unit: "Percent" }],
            metrics_collection_interval: 60,
          },
        },
      },
    },
    null,
    2
  );

  return {
    provider: "cloudwatch",
    config: {},
    filename: "cloudwatch-config.json",
    content: json,
  };
}

export function generateAllTelemetryConfigs(ir: BlueprintIR): TelemetryConfig[] {
  const configs: TelemetryConfig[] = [];

  if (!ir.telemetry?.enabled) return configs;

  const providers = [
    generateOpenTelemetryConfig,
    generateDatadogConfig,
    generateNewRelicConfig,
    generatePrometheusConfig,
    generateCloudWatchConfig,
  ];

  for (const generator of providers) {
    const config = generator(ir);
    if (config) configs.push(config);
  }

  return configs;
}
