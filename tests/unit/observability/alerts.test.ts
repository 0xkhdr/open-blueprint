import { describe, it, expect } from "bun:test";
import {
  evaluateAlertRules,
  formatAlertForChannel,
  type AlertEvent,
  type AlertChannel,
} from "../../../src/observability/alerts.js";
import type { Alerting } from "../../../src/translator/ir.js";

function makeAlerting(overrides: Partial<Alerting> = {}): Alerting {
  return {
    alerting_enabled: true,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<AlertEvent> = {}): AlertEvent {
  return {
    rule: "test-rule",
    severity: "warning",
    message: "Test alert message",
    timestamp: "2026-01-01T00:00:00.000Z",
    metadata: {},
    ...overrides,
  };
}

describe("evaluateAlertRules", () => {
  it("returns no events when no rules defined", () => {
    const events = evaluateAlertRules(makeAlerting(), {});
    expect(events).toHaveLength(0);
  });

  it("triggers policy violation when condition met (> operator)", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "high-error", condition: "error_rate > 0.1", action: "alert", severity: "warning" },
      ],
    });
    const events = evaluateAlertRules(alerting, { error_rate: 0.2 });
    expect(events).toHaveLength(1);
    expect(events[0].rule).toBe("high-error");
  });

  it("does not trigger when condition not met", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "high-error", condition: "error_rate > 0.5", action: "alert", severity: "warning" },
      ],
    });
    const events = evaluateAlertRules(alerting, { error_rate: 0.02 });
    expect(events).toHaveLength(0);
  });

  it("handles < operator", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "low-success", condition: "success_rate < 0.9", action: "alert", severity: "critical" },
      ],
    });
    const events = evaluateAlertRules(alerting, { success_rate: 0.7 });
    expect(events[0].rule).toBe("low-success");
    expect(events[0].severity).toBe("critical");
  });

  it("handles >= operator", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "budget-80", condition: "budget_percent >= 80", action: "alert", severity: "warning" },
      ],
    });
    const events = evaluateAlertRules(alerting, { budget_percent: 80 });
    expect(events).toHaveLength(1);
  });

  it("handles <= operator", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "min-success", condition: "success_rate <= 0.5", action: "alert", severity: "critical" },
      ],
    });
    const events = evaluateAlertRules(alerting, { success_rate: 0.5 });
    expect(events).toHaveLength(1);
  });

  it("handles == operator", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "exact-zero", condition: "error_count == 0", action: "alert", severity: "info" },
      ],
    });
    const events = evaluateAlertRules(alerting, { error_count: 0 });
    expect(events).toHaveLength(1);
  });

  it("skips malformed conditions gracefully", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "bad", condition: "not a valid condition", action: "alert", severity: "warning" },
      ],
    });
    expect(() => evaluateAlertRules(alerting, {})).not.toThrow();
  });

  it("triggers budget overrun alert when > 100%", () => {
    const alerting = makeAlerting({ budget_overrun_alerts: true });
    const events = evaluateAlertRules(alerting, { budget_percent: 105 });
    const overrun = events.find((e) => e.rule === "budget_overrun");
    expect(overrun).toBeDefined();
    expect(overrun?.severity).toBe("critical");
  });

  it("triggers budget warning when > 80% but <= 100%", () => {
    const alerting = makeAlerting({ budget_overrun_alerts: true });
    const events = evaluateAlertRules(alerting, { budget_percent: 85 });
    const warning = events.find((e) => e.rule === "budget_warning");
    expect(warning).toBeDefined();
    expect(warning?.severity).toBe("warning");
  });

  it("no budget alert when budget_overrun_alerts is false", () => {
    const alerting = makeAlerting({ budget_overrun_alerts: false });
    const events = evaluateAlertRules(alerting, { budget_percent: 110 });
    expect(events).toHaveLength(0);
  });

  it("policy violation event includes condition metadata", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "err", condition: "error_rate > 0.1", action: "notify", severity: "warning" },
      ],
    });
    const events = evaluateAlertRules(alerting, { error_rate: 0.5 });
    expect(events[0].metadata).toBeDefined();
  });

  it("metric defaults to 0 when not in metrics map", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "missing-metric", condition: "unknown_metric > 100", action: "alert", severity: "info" },
      ],
    });
    const events = evaluateAlertRules(alerting, {});
    expect(events).toHaveLength(0); // 0 > 100 is false
  });

  it("multiple policy violations evaluated independently", () => {
    const alerting = makeAlerting({
      policy_violations: [
        { policy_name: "a", condition: "error_rate > 0.1", action: "alert", severity: "warning" },
        { policy_name: "b", condition: "success_rate < 0.9", action: "alert", severity: "critical" },
      ],
    });
    const events = evaluateAlertRules(alerting, { error_rate: 0.5, success_rate: 0.5 });
    expect(events).toHaveLength(2);
  });
});

describe("formatAlertForChannel", () => {
  it("slack format is valid JSON with blocks", () => {
    const event = makeEvent({ severity: "critical" });
    const output = formatAlertForChannel(event, "slack");
    const parsed = JSON.parse(output) as { text: string; blocks: unknown[] };
    expect(parsed.text).toContain("🚨");
    expect(parsed.blocks).toBeDefined();
  });

  it("slack format uses ⚠️ for warning severity", () => {
    const event = makeEvent({ severity: "warning" });
    const output = formatAlertForChannel(event, "slack");
    const parsed = JSON.parse(output) as { text: string };
    expect(parsed.text).toContain("⚠️");
  });

  it("pagerduty format is valid JSON with event_action", () => {
    const event = makeEvent();
    const output = formatAlertForChannel(event, "pagerduty");
    const parsed = JSON.parse(output) as { event_action: string; payload: { summary: string } };
    expect(parsed.event_action).toBe("trigger");
    expect(parsed.payload.summary).toBe(event.message);
  });

  it("pagerduty format includes severity", () => {
    const event = makeEvent({ severity: "critical" });
    const output = formatAlertForChannel(event, "pagerduty");
    const parsed = JSON.parse(output) as { payload: { severity: string } };
    expect(parsed.payload.severity).toBe("critical");
  });

  it("email format includes subject line", () => {
    const event = makeEvent({ severity: "critical", rule: "my-rule" });
    const output = formatAlertForChannel(event, "email");
    expect(output).toContain("Subject:");
    expect(output).toContain("CRITICAL");
    expect(output).toContain("my-rule");
  });

  it("email format includes message body", () => {
    const event = makeEvent({ message: "Something bad happened" });
    const output = formatAlertForChannel(event, "email");
    expect(output).toContain("Something bad happened");
  });

  it("email format includes timestamp", () => {
    const event = makeEvent({ timestamp: "2026-01-01T00:00:00.000Z" });
    const output = formatAlertForChannel(event, "email");
    expect(output).toContain("2026-01-01T00:00:00.000Z");
  });

  it("webhook/unknown channel returns JSON of event", () => {
    const event = makeEvent();
    const output = formatAlertForChannel(event, "webhook");
    const parsed = JSON.parse(output) as AlertEvent;
    expect(parsed.rule).toBe(event.rule);
    expect(parsed.message).toBe(event.message);
  });

  it("slack format includes severity in blocks text", () => {
    const event = makeEvent({ severity: "warning" });
    const output = formatAlertForChannel(event, "slack");
    expect(output).toContain("warning");
  });

  it("pagerduty format source is bp-cli", () => {
    const event = makeEvent();
    const output = formatAlertForChannel(event, "pagerduty");
    const parsed = JSON.parse(output) as { payload: { source: string } };
    expect(parsed.payload.source).toBe("bp-cli");
  });
});
