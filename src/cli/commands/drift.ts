import { readFileSync } from "node:fs";
import chalk from "chalk";
import { Command } from "commander";
import { loadProjectConfig } from "../../config/project.js";
import { BpError } from "../../errors.js";
import {
  type BehaviorBaseline,
  detectBehavioralDrift,
  establishBaseline,
  type RuntimeMetrics,
} from "../../observability/semantic-drift.js";
import { detectMultiBackendDrift, saveDriftBaseline } from "../../validator/multi-backend-drift.js";

function readJsonFile<T>(filePath: string, label: string): T {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new BpError(
      `Could not read ${label} file: ${filePath}`,
      1,
      "CMD_ERROR",
      `Provide a valid path to a ${label} JSON file.`
    );
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new BpError(`${label} file is not valid JSON: ${filePath}`, 1, "CMD_ERROR", "");
  }
}

export function createDriftCommand(): Command {
  const cmd = new Command("drift").description("Drift detection commands");

  cmd
    .command("backends")
    .description("Detect drift across all configured backends in .bp.json")
    .option("--json", "Output as JSON")
    .option("--save-baseline", "Save current file state as the new drift baseline")
    .action((opts: { json?: boolean; saveBaseline?: boolean }) => {
      const cwd = process.cwd();
      const projectConfig = loadProjectConfig(cwd);

      if (!projectConfig) {
        if (opts.json) {
          console.log(
            JSON.stringify({ status: "error", error: "No .bp.json found in current directory" })
          );
        } else {
          console.error(chalk.red("No .bp.json found. Run bp init first."));
        }
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      const configuredBackends =
        projectConfig.backends ?? (projectConfig.backend ? [projectConfig.backend] : []);

      if (opts.saveBaseline) {
        saveDriftBaseline(cwd, configuredBackends);
        if (opts.json) {
          console.log(
            JSON.stringify({
              status: "ok",
              message: "Baseline saved",
              backends: configuredBackends,
            })
          );
        } else {
          console.log(chalk.green(`✔ Baseline saved for: ${configuredBackends.join(", ")}`));
        }
        return;
      }

      const results = detectMultiBackendDrift(cwd, projectConfig);

      if (opts.json) {
        console.log(JSON.stringify({ status: "ok", backends: results }));
        return;
      }

      for (const result of results) {
        const icon =
          result.status === "in sync"
            ? chalk.green("✔")
            : result.status === "drifted"
              ? chalk.yellow("~")
              : result.status === "missing"
                ? chalk.red("!")
                : chalk.dim("?");
        console.log(`${icon} ${chalk.bold(result.backend)}: ${result.message}`);
      }

      const drifted = results.filter((r) => r.status === "drifted" || r.status === "missing");
      if (drifted.length > 0) {
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }
    });

  cmd
    .command("baseline")
    .description("Establish a behavior baseline from a real NDJSON metrics file")
    .requiredOption("--metrics <file>", "Path to NDJSON metrics file (one RuntimeMetrics per line)")
    .option("--window <days>", "Window in days for baseline calculation", "7")
    .option("--json", "Output as JSON")
    .action((opts: { metrics: string; window?: string; json?: boolean }) => {
      let metrics: RuntimeMetrics[];
      try {
        const lines = readFileSync(opts.metrics, "utf-8").split("\n").filter(Boolean);
        metrics = lines.map((l) => JSON.parse(l) as RuntimeMetrics);
      } catch {
        throw new BpError(
          `Could not read metrics file: ${opts.metrics}`,
          1,
          "CMD_ERROR",
          "Provide a valid NDJSON file with one RuntimeMetrics object per line."
        );
      }

      if (metrics.length === 0) {
        throw new BpError(
          "Metrics file contains no records.",
          1,
          "CMD_ERROR",
          "Collect runtime metrics before establishing a baseline."
        );
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

  function behavioralAction(opts: {
    baseline: string;
    current: string;
    threshold?: string;
    json?: boolean;
  }): void {
    const baseline = readJsonFile<BehaviorBaseline>(opts.baseline, "baseline");
    const current = readJsonFile<RuntimeMetrics>(opts.current, "current metrics");
    const threshold = parseFloat(opts.threshold ?? "0.15");

    const report = detectBehavioralDrift(baseline, current, threshold);

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
  }

  cmd
    .command("behavioral")
    .description(
      "Compare a real current-metrics file against a baseline to detect behavioral drift"
    )
    .requiredOption("--baseline <file>", "Path to a baseline JSON file (from `bp drift baseline`)")
    .requiredOption("--current <file>", "Path to a current RuntimeMetrics JSON file")
    .option("--threshold <pct>", "Drift threshold (0-1)", "0.15")
    .option("--json", "Output as JSON")
    .action(behavioralAction);

  // Deprecated alias: "semantic" implied natural-language analysis, but this
  // command measures behavioral metrics. Kept for backward compatibility.
  cmd
    .command("semantic", { hidden: true })
    .description("Deprecated alias for `drift behavioral`")
    .requiredOption("--baseline <file>", "Path to a baseline JSON file (from `bp drift baseline`)")
    .requiredOption("--current <file>", "Path to a current RuntimeMetrics JSON file")
    .option("--threshold <pct>", "Drift threshold (0-1)", "0.15")
    .option("--json", "Output as JSON")
    .action((opts: { baseline: string; current: string; threshold?: string; json?: boolean }) => {
      console.warn(
        chalk.yellow("`bp drift semantic` is deprecated; use `bp drift behavioral` instead.")
      );
      behavioralAction(opts);
    });

  return cmd;
}
