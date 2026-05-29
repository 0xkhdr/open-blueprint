import type { Alerting } from "../translator/ir.js";

export interface AlertEvent {
  rule: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: string;
  metadata: Record<string, unknown>;
}

interface ParsedCondition {
  metric: string;
  operator: string;
  value: number;
}

export function evaluateAlertRules(
  alerting: Alerting,
  metrics: Record<string, number>
): AlertEvent[] {
  const events: AlertEvent[] = [];

  for (const rule of alerting.policy_violations ?? []) {
    try {
      const condition = parseCondition(rule.condition);
      if (evaluateCondition(condition, metrics)) {
        events.push({
          rule: rule.policy_name,
          severity: rule.severity,
          message: `Policy violation: ${rule.policy_name} — ${rule.condition}`,
          timestamp: new Date().toISOString(),
          metadata: { condition, action: rule.action },
        });
      }
    } catch {
      // skip malformed condition
    }
  }

  if (alerting.budget_overrun_alerts) {
    const budgetPercent = metrics["budget_percent"] ?? 0;
    if (budgetPercent > 100) {
      events.push({
        rule: "budget_overrun",
        severity: "critical",
        message: `Budget overrun: at ${budgetPercent.toFixed(1)}% of budget`,
        timestamp: new Date().toISOString(),
        metadata: { budget_percent: budgetPercent },
      });
    } else if (budgetPercent > 80) {
      events.push({
        rule: "budget_warning",
        severity: "warning",
        message: `Budget warning: at ${budgetPercent.toFixed(1)}% of budget`,
        timestamp: new Date().toISOString(),
        metadata: { budget_percent: budgetPercent },
      });
    }
  }

  return events;
}

function parseCondition(condition: string): ParsedCondition {
  const match = condition.match(/(\w+)\s*(>=|<=|==|>|<)\s*(\d+(?:\.\d+)?)/);
  if (!match || !match[1] || !match[2] || !match[3]) throw new Error(`Invalid condition: ${condition}`);
  return { metric: match[1], operator: match[2], value: parseFloat(match[3]) };
}

function evaluateCondition(condition: ParsedCondition, metrics: Record<string, number>): boolean {
  const actual = metrics[condition.metric] ?? 0;
  switch (condition.operator) {
    case ">":
      return actual > condition.value;
    case "<":
      return actual < condition.value;
    case ">=":
      return actual >= condition.value;
    case "<=":
      return actual <= condition.value;
    case "==":
      return actual === condition.value;
    default:
      return false;
  }
}

export type AlertChannel = "slack" | "pagerduty" | "email" | "webhook";

export function formatAlertForChannel(event: AlertEvent, channel: AlertChannel): string {
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
          timestamp: event.timestamp,
        },
      });
    case "email":
      return `Subject: [${event.severity.toUpperCase()}] Blueprint Alert: ${event.rule}\n\n${event.message}\n\nTimestamp: ${event.timestamp}`;
    default:
      return JSON.stringify(event);
  }
}
