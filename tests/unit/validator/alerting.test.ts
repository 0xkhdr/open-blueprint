import { describe, it, expect } from "vitest";
import type { BlueprintIR } from "../../../src/translator/ir.js";
import { validateAlertingConfig } from "../../../src/validator/alerting.js";

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
});
