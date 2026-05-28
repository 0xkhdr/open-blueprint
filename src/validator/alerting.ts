import type { BlueprintIR } from "../translator/ir.js";
import type { ValidationError } from "./structural.js";

export interface AlertConfig {
  channel_type: "slack" | "pagerduty" | "webhook" | "email";
  endpoint: string;
  webhook_auth?: string;
  severity_filter?: string[];
}

export function validateAlertingConfig(ir: BlueprintIR): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!ir.alerting) return errors;

  // Validate notification channels
  for (const channel of ir.alerting.notification_channels ?? []) {
    if (!channel.endpoint) {
      errors.push({
        file: "alerting",
        type: "MISSING_ENDPOINT",
        severity: "error",
        message: `Alert channel "${channel.channel_type}" missing endpoint`,
        resolution: "Provide endpoint (URL or email address) for the alert channel",
      });
    }

    // Validate webhook auth if needed
    if (channel.channel_type === "webhook" && !channel.webhook_auth) {
      errors.push({
        file: "alerting",
        type: "MISSING_AUTH",
        severity: "warning",
        message: `Webhook alert channel at "${channel.endpoint}" has no authentication`,
        resolution: "Add webhook_auth header (e.g., Authorization token)",
      });
    }

    // Validate severity filters
    const validSeverities = ["info", "warning", "critical"];
    if (channel.severity_filter) {
      for (const severity of channel.severity_filter) {
        if (!validSeverities.includes(severity)) {
          errors.push({
            file: "alerting",
            type: "INVALID_SEVERITY",
            severity: "error",
            message: `Invalid severity filter "${severity}" for channel "${channel.channel_type}"`,
            resolution: `Use one of: ${validSeverities.join(", ")}`,
          });
        }
      }
    }
  }

  // Validate policy violations
  for (const policy of ir.alerting.policy_violations ?? []) {
    if (!policy.policy_name) {
      errors.push({
        file: "alerting",
        type: "MISSING_POLICY_NAME",
        severity: "error",
        message: "Policy violation missing policy_name",
        resolution: "Add policy_name to identify the policy",
      });
    }

    if (!policy.condition) {
      errors.push({
        file: "alerting",
        type: "MISSING_CONDITION",
        severity: "error",
        message: `Policy "${policy.policy_name}" missing condition`,
        resolution: "Add condition (e.g., 'cost > 100', 'error_rate > 0.05')",
      });
    }

    const validSeverities = ["info", "warning", "critical"];
    if (!validSeverities.includes(policy.severity)) {
      errors.push({
        file: "alerting",
        type: "INVALID_POLICY_SEVERITY",
        severity: "error",
        message: `Policy "${policy.policy_name}" has invalid severity "${policy.severity}"`,
        resolution: `Use one of: ${validSeverities.join(", ")}`,
      });
    }
  }

  // Validate anomaly detection
  if (ir.alerting.anomaly_detection?.enabled) {
    if (
      ir.alerting.anomaly_detection.std_dev_threshold !== undefined &&
      ir.alerting.anomaly_detection.std_dev_threshold <= 0
    ) {
      errors.push({
        file: "alerting",
        type: "INVALID_THRESHOLD",
        severity: "error",
        message: `Anomaly detection std_dev_threshold must be positive`,
        resolution: "Set std_dev_threshold to a positive value (e.g., 2.0)",
      });
    }

    if (
      ir.alerting.anomaly_detection.min_baseline_samples !== undefined &&
      ir.alerting.anomaly_detection.min_baseline_samples < 2
    ) {
      errors.push({
        file: "alerting",
        type: "INVALID_BASELINE",
        severity: "error",
        message: `Anomaly detection requires at least 2 baseline samples`,
        resolution: "Set min_baseline_samples to 2 or higher",
      });
    }
  }

  return errors;
}

export function generateSlackWebhook(
  alertTitle: string,
  alertMessage: string,
  severity: "info" | "warning" | "critical"
): string {
  const colorMap: Record<string, string> = {
    info: "#36a64f",
    warning: "#ff9900",
    critical: "#ff0000",
  };

  const payload = {
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: `${severity.toUpperCase()}: ${alertTitle}`,
        },
      },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: alertMessage,
        },
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: `⏱️ ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  return JSON.stringify(payload);
}

export function generatePagerDutyIncident(
  alertTitle: string,
  alertMessage: string,
  severity: "info" | "warning" | "critical"
): string {
  const severityMap: Record<string, string> = {
    info: "info",
    warning: "warning",
    critical: "critical",
  };

  const payload = {
    routing_key: "${PAGERDUTY_ROUTING_KEY}",
    event_action: "trigger",
    dedup_key: `${Date.now()}-${alertTitle}`,
    payload: {
      summary: alertTitle,
      severity: severityMap[severity],
      source: "open-blueprint",
      timestamp: new Date().toISOString(),
      custom_details: {
        message: alertMessage,
      },
    },
  };

  return JSON.stringify(payload, null, 2);
}

export function generateWebhookPayload(
  alertTitle: string,
  alertMessage: string,
  severity: "info" | "warning" | "critical",
  metadata?: Record<string, unknown>
): string {
  const payload = {
    alert: {
      title: alertTitle,
      message: alertMessage,
      severity,
      timestamp: new Date().toISOString(),
    },
    metadata: metadata || {},
  };

  return JSON.stringify(payload, null, 2);
}

export interface AnomalyDetectionResult {
  is_anomaly: boolean;
  zscore: number;
  threshold: number;
  message?: string | undefined;
}

export function detectAnomaly(
  currentValue: number,
  baselineValues: number[],
  stdDevThreshold: number = 2.0
): AnomalyDetectionResult {
  if (baselineValues.length < 2) {
    return { is_anomaly: false, zscore: 0, threshold: stdDevThreshold };
  }

  const mean = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
  const variance =
    baselineValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / baselineValues.length;
  const stdDev = Math.sqrt(variance);

  let zscore = 0;
  if (stdDev > 0) {
    zscore = Math.abs((currentValue - mean) / stdDev);
  }

  const isAnomaly = zscore > stdDevThreshold;

  return {
    is_anomaly: isAnomaly,
    zscore,
    threshold: stdDevThreshold,
    message: isAnomaly
      ? `Value ${currentValue} is ${zscore.toFixed(2)}σ away from baseline (mean: ${mean.toFixed(2)}, stdDev: ${stdDev.toFixed(2)})`
      : undefined,
  };
}
