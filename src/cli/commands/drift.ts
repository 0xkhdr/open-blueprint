import { Command } from "commander";
import {
  establishBaseline,
  detectSemanticDrift,
  type RuntimeMetrics,
  type BehaviorBaseline,
} from "../../observability/semantic-drift.js";

function makeSyntheticBaseline(): BehaviorBaseline {
  return {
    established_at: new Date().toISOString(),
    rule_success_rate: { "security-no-secrets": 0.95, "style-formatting": 0.88 },
    total_tokens: 50000,
    session_duration_ms: 120000,
    agent_action_distribution: { read: 0.6, write: 0.3, execute: 0.1 },
    skill_invocation_count: { "run-tests": 25, "deploy": 5 },
  };
}

function makeSyntheticCurrent(): RuntimeMetrics {
  return {
    timestamp: new Date().toISOString(),
    total_tokens: 52000,
    session_duration_ms: 125000,
    error_rate: 0.02,
    success_rate: 0.98,
    rule_success_rate: { "security-no-secrets": 0.92, "style-formatting": 0.85 },
    agent_action_distribution: { read: 0.55, write: 0.35, execute: 0.1 },
    skill_invocation_count: { "run-tests": 24, "deploy": 5 },
  };
}

export function createDriftCommand(): Command {
  const cmd = new Command("drift").description("Semantic drift detection commands");

  cmd
    .command("baseline")
    .description("Establish a behavior baseline from metrics (uses synthetic data if no metrics file)")
    .option("--metrics <file>", "Path to NDJSON metrics file")
    .option("--window <days>", "Window in days for baseline calculation", "7")
    .option("--json", "Output as JSON")
    .action((opts: { metrics?: string; window?: string; json?: boolean }) => {
      let metrics: RuntimeMetrics[] = [];

      if (opts.metrics) {
        try {
          const { readFileSync } = require("node:fs") as typeof import("node:fs");
          const lines = readFileSync(opts.metrics, "utf-8").split("\n").filter(Boolean);
          metrics = lines.map((l) => JSON.parse(l) as RuntimeMetrics);
        } catch {
          console.error("Failed to read metrics file.");
          process.exit(1);
        }
      } else {
        console.warn("No metrics file provided. Using synthetic baseline.");
        metrics = [
          {
            ...makeSyntheticCurrent(),
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          },
          {
            ...makeSyntheticCurrent(),
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          },
        ];
      }

      const window = parseInt(opts.window ?? "7", 10);
      const baseline = establishBaseline(metrics, window);

      if (opts.json) {
        console.log(JSON.stringify(baseline));
        return;
      }

      console.log("Baseline established:", baseline.established_at);
      console.log(`  Avg total tokens: ${baseline.total_tokens.toFixed(0)}`);
      console.log(`  Avg session duration: ${baseline.session_duration_ms.toFixed(0)}ms`);
      console.log(`  Rules tracked: ${Object.keys(baseline.rule_success_rate).length}`);
      console.log(`  Skills tracked: ${Object.keys(baseline.skill_invocation_count).length}`);
    });

  cmd
    .command("semantic")
    .description("Detect semantic drift against baseline")
    .option("--threshold <pct>", "Drift threshold (0-1)", "0.15")
    .option("--json", "Output as JSON")
    .action((opts: { threshold?: string; json?: boolean }) => {
      const baseline = makeSyntheticBaseline();
      const current = makeSyntheticCurrent();
      const threshold = parseFloat(opts.threshold ?? "0.15");

      const report = detectSemanticDrift(baseline, current, threshold);

      if (opts.json) {
        console.log(JSON.stringify(report));
        return;
      }

      console.log(`Drift Report — ${report.timestamp}`);
      console.log(
        `  Total drifts: ${report.summary.total_drifts} (critical: ${report.summary.critical}, warning: ${report.summary.warning})`
      );

      if (report.drifts.length === 0) {
        console.log("  No drift detected.");
        return;
      }

      console.log("\n  Drift entries:");
      for (const d of report.drifts) {
        const icon = d.severity === "critical" ? "🚨" : "⚠️";
        console.log(
          `  ${icon} [${d.type}] ${d.target}: baseline=${d.baseline.toFixed(3)}, current=${d.current.toFixed(3)}, deviation=${(d.deviation * 100).toFixed(1)}%`
        );
      }
    });

  return cmd;
}
