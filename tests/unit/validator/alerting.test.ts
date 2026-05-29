import { describe, it, expect } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import {
  detectAnomaly,
  generatePagerDutyIncident,
  generateSlackWebhook,
  generateWebhookPayload,
  validateAlertingConfig,
} from "../../../src/validator/alerting.js";

function createBaseIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "test",
      surface: "# test",
      temporal_anchor: "dev",
      conventions: [],
    },
    personas: [],
    rules: [],
    skills: [],
    hooks: [],
    meta: {
      rule_precedence: [],
      conflict_resolution: "precedence-based",
      source_backend: "claude",
      target_backend: "claude",
    },
  };
}

describe("validateAlertingConfig", () => {
  it("returns no errors when alerting is absent", () => {
    const ir = createBaseIR();
    const errors = validateAlertingConfig(ir);
    expect(errors).toHaveLength(0);
  });

  it("accepts valid Slack notification channel", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      notification_channels: [
        {
          channel_type: "slack",
          endpoint: "https://hooks.slack.com/services/T000/B000/xxx",
          severity_filter: ["critical", "warning"],
        },
      ],
    };
    const errors = validateAlertingConfig(ir);
    expect(errors).toHaveLength(0);
  });

  it("flags missing endpoint on notification channel", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      notification_channels: [{ channel_type: "email", endpoint: "" }],
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.some((e) => e.type === "MISSING_ENDPOINT")).toBe(true);
  });

  it("warns when webhook has no auth", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      notification_channels: [{ channel_type: "webhook", endpoint: "https://example.com/hook" }],
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.some((e) => e.type === "MISSING_AUTH")).toBe(true);
    expect(errors.find((e) => e.type === "MISSING_AUTH")?.severity).toBe("warning");
  });

  it("does not warn when webhook has auth", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      notification_channels: [
        {
          channel_type: "webhook",
          endpoint: "https://example.com/hook",
          webhook_auth: "Bearer token123",
        },
      ],
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.filter((e) => e.type === "MISSING_AUTH")).toHaveLength(0);
  });

  it("flags invalid severity filter", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      notification_channels: [
        {
          channel_type: "slack",
          endpoint: "https://hooks.slack.com/xxx",
          severity_filter: ["debug" as "info"],
        },
      ],
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.some((e) => e.type === "INVALID_SEVERITY")).toBe(true);
  });

  it("flags policy violation missing policy_name", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      policy_violations: [
        {
          policy_name: "",
          condition: "cost > 100",
          action: "notify",
          severity: "warning",
        },
      ],
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.some((e) => e.type === "MISSING_POLICY_NAME")).toBe(true);
  });

  it("flags policy violation missing condition", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      policy_violations: [
        {
          policy_name: "cost_overrun",
          condition: "",
          action: "notify",
          severity: "critical",
        },
      ],
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.some((e) => e.type === "MISSING_CONDITION")).toBe(true);
  });

  it("accepts valid policy violation", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      policy_violations: [
        {
          policy_name: "cost_overrun",
          condition: "monthly_cost > budget",
          action: "send_alert",
          severity: "critical",
        },
      ],
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.filter((e) => e.type === "MISSING_POLICY_NAME" || e.type === "MISSING_CONDITION")).toHaveLength(0);
  });

  it("flags anomaly detection with non-positive std_dev_threshold", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      anomaly_detection: { enabled: true, std_dev_threshold: 0 },
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.some((e) => e.type === "INVALID_THRESHOLD")).toBe(true);
  });

  it("flags anomaly detection with min_baseline_samples < 2", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      anomaly_detection: { enabled: true, min_baseline_samples: 1 },
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.some((e) => e.type === "INVALID_BASELINE")).toBe(true);
  });

  it("accepts valid anomaly detection config", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      anomaly_detection: { enabled: true, std_dev_threshold: 2.5, min_baseline_samples: 10 },
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.filter((e) => e.type === "INVALID_THRESHOLD" || e.type === "INVALID_BASELINE")).toHaveLength(0);
  });

  it("flags invalid policy severity", () => {
    const ir = createBaseIR();
    ir.alerting = {
      alerting_enabled: true,
      policy_violations: [
        {
          policy_name: "cost_overrun",
          condition: "cost > 100",
          action: "notify",
          severity: "debug" as "info",
        },
      ],
    };
    const errors = validateAlertingConfig(ir);
    expect(errors.some((e) => e.type === "INVALID_POLICY_SEVERITY")).toBe(true);
  });
});

describe("generateSlackWebhook", () => {
  it("returns JSON string with severity in header", () => {
    const result = generateSlackWebhook("Alert title", "Alert body", "critical");
    const parsed = JSON.parse(result) as { blocks: Array<{ text?: { text?: string } }> };
    expect(parsed.blocks[0]?.text?.text).toContain("CRITICAL");
    expect(parsed.blocks[0]?.text?.text).toContain("Alert title");
  });

  it("includes message body in section block", () => {
    const result = generateSlackWebhook("Title", "Body text", "info");
    const parsed = JSON.parse(result) as { blocks: Array<{ text?: { text?: string } }> };
    expect(parsed.blocks[1]?.text?.text).toBe("Body text");
  });
});

describe("generatePagerDutyIncident", () => {
  it("returns JSON with routing_key placeholder and trigger action", () => {
    const result = generatePagerDutyIncident("Incident", "Something broke", "warning");
    const parsed = JSON.parse(result) as {
      routing_key: string;
      event_action: string;
      payload: { severity: string; summary: string };
    };
    expect(parsed.routing_key).toContain("PAGERDUTY_ROUTING_KEY");
    expect(parsed.event_action).toBe("trigger");
    expect(parsed.payload.severity).toBe("warning");
    expect(parsed.payload.summary).toBe("Incident");
  });
});

describe("generateWebhookPayload", () => {
  it("includes empty metadata when not provided", () => {
    const result = generateWebhookPayload("Title", "Msg", "info");
    const parsed = JSON.parse(result) as { metadata: Record<string, unknown> };
    expect(parsed.metadata).toEqual({});
  });

  it("includes provided metadata", () => {
    const result = generateWebhookPayload("Title", "Msg", "critical", { env: "prod" });
    const parsed = JSON.parse(result) as { metadata: Record<string, unknown> };
    expect(parsed.metadata).toEqual({ env: "prod" });
  });
});

describe("detectAnomaly", () => {
  it("returns no anomaly when fewer than 2 baseline values", () => {
    const result = detectAnomaly(100, [50]);
    expect(result.is_anomaly).toBe(false);
    expect(result.zscore).toBe(0);
  });

  it("returns no anomaly when stdDev is zero (all equal values)", () => {
    const result = detectAnomaly(5, [5, 5, 5, 5]);
    expect(result.is_anomaly).toBe(false);
    expect(result.zscore).toBe(0);
  });

  it("detects anomaly when value is far from mean", () => {
    const result = detectAnomaly(100, [1, 2, 1, 2], 2.0);
    expect(result.is_anomaly).toBe(true);
    expect(result.zscore).toBeGreaterThan(2.0);
  });

  it("no anomaly when value is within threshold", () => {
    const result = detectAnomaly(3, [1, 2, 3, 4, 5], 2.0);
    expect(result.is_anomaly).toBe(false);
  });

  it("respects custom stdDevThreshold", () => {
    const result = detectAnomaly(10, [1, 2, 3, 4, 5], 0.5);
    expect(result.threshold).toBe(0.5);
    expect(result.is_anomaly).toBe(true);
  });
});
