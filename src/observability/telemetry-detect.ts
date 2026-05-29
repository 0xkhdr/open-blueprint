import * as fs from "node:fs";
import * as path from "node:path";

export type TelemetryPlatform =
  | "opentelemetry"
  | "datadog"
  | "newrelic"
  | "prometheus"
  | "cloudwatch";

export function detectTelemetryPlatform(projectRoot: string): TelemetryPlatform | undefined {
  const pkgPath = path.join(projectRoot, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps["@opentelemetry/api"] || deps["@opentelemetry/sdk-node"]) return "opentelemetry";
      if (deps["dd-trace"] || deps["datadog-lambda-js"]) return "datadog";
      if (deps.newrelic) return "newrelic";
      if (deps["prom-client"]) return "prometheus";
    } catch {
      // malformed package.json — continue to file checks
    }
  }

  if (fs.existsSync(path.join(projectRoot, "otel-collector-config.yaml"))) return "opentelemetry";
  if (fs.existsSync(path.join(projectRoot, "datadog.yaml"))) return "datadog";
  if (fs.existsSync(path.join(projectRoot, ".newrelic.js"))) return "newrelic";
  if (fs.existsSync(path.join(projectRoot, "prometheus.yml"))) return "prometheus";
  if (fs.existsSync(path.join(projectRoot, "cloudwatch-config.json"))) return "cloudwatch";

  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT) return "opentelemetry";
  if (process.env.DD_API_KEY) return "datadog";
  if (process.env.NEW_RELIC_LICENSE_KEY) return "newrelic";
  if (process.env.AWS_CLOUDWATCH_LOG_GROUP) return "cloudwatch";

  return undefined;
}

export function getTelemetryInitConfig(platform: TelemetryPlatform): string {
  switch (platform) {
    case "opentelemetry":
      return `telemetry:
  platform: opentelemetry
  endpoint: "\${OTEL_EXPORTER_OTLP_ENDPOINT}"
  service_name: "\${OTEL_SERVICE_NAME}"`;
    case "datadog":
      return `telemetry:
  platform: datadog
  api_key: "\${DD_API_KEY}"
  site: datadoghq.com`;
    case "newrelic":
      return `telemetry:
  platform: newrelic
  license_key: "\${NEW_RELIC_LICENSE_KEY}"`;
    case "prometheus":
      return `telemetry:
  platform: prometheus
  scrape_interval: 15s
  metrics_path: /metrics`;
    case "cloudwatch":
      return `telemetry:
  platform: cloudwatch
  region: "\${AWS_REGION}"
  log_group: "\${AWS_CLOUDWATCH_LOG_GROUP}"`;
  }
}
