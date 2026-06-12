import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import cliui from "cliui";
import { Command } from "commander";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { BpError } from "../../errors.js";
import { collectGovernanceReport } from "../../report/build.js";
import type { GovernanceReport, ReportRule } from "../../report/model.js";
import { reportToSarif } from "../../report/sarif.js";
import { buildSnapshot, saveSnapshot } from "../../report/snapshot.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { normalizeError } from "../../utils/errors.js";
import { EXIT_CODES } from "../../validator/index.js";

const FAIL_ON_VALUES = ["hard", "soft", "none"] as const;
type FailOn = (typeof FAIL_ON_VALUES)[number];

const MAX_VIOLATIONS_SHOWN = 10;

/** Keep only packs of the framework and the rules those packs own. */
export function filterReportByFramework(
  report: GovernanceReport,
  framework: string
): GovernanceReport {
  const packs = report.packs.filter((p) => p.framework === framework);
  const packIds = new Set(packs.map((p) => p.id));
  const rules = report.rules.filter((r) => r.pack !== undefined && packIds.has(r.pack.id));
  const { packs_unsigned: _dropped, ...summaryRest } = report.summary;
  return {
    ...report,
    summary: {
      ...summaryRest,
      rules_total: rules.length,
      rules_enforced: rules.filter((r) => r.enforcement === "auto").length,
      rules_manual: rules.filter((r) => r.enforcement === "manual").length,
      violations_hard: rules.filter(
        (r) => r.status === "invalid" || (r.status === "fail" && r.severity === "hard")
      ).length,
      violations_soft: rules.filter((r) => r.status === "fail" && r.severity === "soft").length,
      packs_installed: packs.length,
      ...(packs.some((p) => p.trust === "unsigned-accepted")
        ? { packs_unsigned: packs.filter((p) => p.trust === "unsigned-accepted").length }
        : {}),
    },
    rules,
    packs,
  };
}

/** Exit code a report deserves under a --fail-on threshold. */
export function exitCodeForReport(report: GovernanceReport, failOn: FailOn): number {
  if (failOn === "none") return EXIT_CODES.SUCCESS;
  const { violations_hard, violations_soft } = report.summary;
  if (violations_hard > 0) return EXIT_CODES.STRUCTURAL_FAILURE;
  if (failOn === "soft" && violations_soft > 0) return EXIT_CODES.STRUCTURAL_FAILURE;
  return EXIT_CODES.SUCCESS;
}

function statusLabel(rule: ReportRule): string {
  switch (rule.status) {
    case "pass":
      return chalk.green("pass");
    case "fail":
      return rule.severity === "hard" ? chalk.red("FAIL (hard)") : chalk.yellow("fail (soft)");
    case "invalid":
      return chalk.red("INVALID");
    case "manual":
      return chalk.dim("manual");
  }
}

function printTerminalReport(report: GovernanceReport): void {
  const { summary } = report;
  console.log(
    chalk.bold(`\nGovernance report — ${report.project.name} (${report.project.backend})`)
  );
  console.log(chalk.dim(`Generated ${report.generated_at}\n`));

  console.log(
    `  Rules: ${summary.rules_total} total — ${summary.rules_enforced} enforced, ${summary.rules_manual} manual`
  );
  const hard = summary.violations_hard;
  const soft = summary.violations_soft;
  console.log(
    `  Violations: ${hard > 0 ? chalk.red(`${hard} hard`) : chalk.green("0 hard")}, ${
      soft > 0 ? chalk.yellow(`${soft} soft`) : "0 soft"
    }`
  );
  if (summary.skills_total !== undefined) {
    console.log(`  Skills: ${summary.skills_total}`);
  }
  console.log(`  Packs installed: ${summary.packs_installed}`);
  if (summary.packs_unsigned !== undefined && summary.packs_unsigned > 0) {
    console.log(
      chalk.yellow(`  ⚠ ${summary.packs_unsigned} pack(s) installed with trust 'unsigned-accepted'`)
    );
  }

  if (report.packs.length > 0) {
    console.log(chalk.bold("\nPacks (measured, not declared):\n"));
    const ui = cliui({ width: Math.min(process.stdout.columns || 100, 120) });
    ui.div(
      { text: chalk.bold("PACK"), width: 30, padding: [0, 1, 0, 2] },
      { text: chalk.bold("FRAMEWORK"), width: 12, padding: [0, 1, 0, 0] },
      { text: chalk.bold("PASS"), width: 6, padding: [0, 1, 0, 0] },
      { text: chalk.bold("FAIL"), width: 6, padding: [0, 1, 0, 0] },
      { text: chalk.bold("MANUAL"), width: 8, padding: [0, 1, 0, 0] },
      { text: chalk.bold("INTEGRITY"), width: 11, padding: [0, 1, 0, 0] },
      { text: chalk.bold("NOTES"), width: 24, padding: [0, 0, 0, 0] }
    );
    for (const pack of report.packs) {
      const notes: string[] = [];
      if (pack.declared_coverage !== undefined) {
        notes.push(`declared (unverified): ${pack.declared_coverage}%`);
      }
      if (pack.outdated) notes.push("outdated");
      if (pack.trust === "unsigned-accepted") notes.push("unsigned");
      ui.div(
        { text: `${pack.id} v${pack.version}`, width: 30, padding: [0, 1, 0, 2] },
        { text: pack.framework ?? "—", width: 12, padding: [0, 1, 0, 0] },
        { text: chalk.green(String(pack.measured.pass)), width: 6, padding: [0, 1, 0, 0] },
        {
          text:
            pack.measured.fail > 0
              ? chalk.red(String(pack.measured.fail))
              : String(pack.measured.fail),
          width: 6,
          padding: [0, 1, 0, 0],
        },
        { text: chalk.dim(String(pack.measured.manual)), width: 8, padding: [0, 1, 0, 0] },
        {
          text: pack.integrity === "ok" ? chalk.green("ok") : chalk.red(pack.integrity),
          width: 11,
          padding: [0, 1, 0, 0],
        },
        { text: chalk.dim(notes.join(", ") || "—"), width: 24, padding: [0, 0, 0, 0] }
      );
    }
    console.log(ui.toString());
  }

  const violations = report.rules.filter((r) => r.status === "fail" || r.status === "invalid");
  if (violations.length > 0) {
    console.log(chalk.bold(`\nTop violations (${violations.length} total):\n`));
    for (const rule of violations.slice(0, MAX_VIOLATIONS_SHOWN)) {
      const where =
        rule.evidence && rule.evidence.length > 0
          ? rule.evidence
              .slice(0, 3)
              .map((e) => (e.line !== undefined ? `${e.file}:${e.line}` : e.file))
              .join(", ")
          : rule.file;
      console.log(`  ${statusLabel(rule)} ${chalk.cyan(rule.id)} — ${where}`);
      if (rule.detail) console.log(chalk.dim(`    ${rule.detail}`));
    }
    if (violations.length > MAX_VIOLATIONS_SHOWN) {
      console.log(
        chalk.dim(`  … and ${violations.length - MAX_VIOLATIONS_SHOWN} more (use --json for all)`)
      );
    }
  }

  const staleRules = report.rules.filter((r) => r.stale);
  for (const rule of staleRules) {
    console.log(
      chalk.blue(
        `  ℹ [RULE_MANUAL_STALE] '${rule.id}' unchanged while its scoped files changed since the last snapshot — re-review it`
      )
    );
  }
  console.log("");
}

function emit(payload: string, target: string | boolean): void {
  if (typeof target === "string") {
    fs.mkdirSync(path.dirname(path.resolve(target)), { recursive: true });
    fs.writeFileSync(path.resolve(target), `${payload}\n`, "utf-8");
    console.log(chalk.dim(`Wrote ${target}`));
  } else {
    console.log(payload);
  }
}

export function createReportCommand(): Command {
  const cmd = new Command("report");

  cmd
    .description(
      "Measured governance posture: per-rule compliance, pack integrity, SARIF/JSON output"
    )
    .argument("[path]", "Repository path to report on", ".")
    .option("--json [file]", "Emit the full bp-report/1 JSON (to stdout or a file)")
    .option("--sarif [file]", "Emit SARIF 2.1.0 for code scanning (to stdout or a file)")
    .option("--fail-on <level>", "Exit non-zero on violations: hard | soft | none", "hard")
    .option("--framework <id>", "Only packs/rules of this compliance framework")
    .option("--snapshot", "Write .bp/report-snapshot.json as the staleness baseline", false)
    .action(
      async (
        pathArg: string,
        opts: {
          json?: string | boolean;
          sarif?: string | boolean;
          failOn: string;
          framework?: string;
          snapshot: boolean;
        }
      ) => {
        if (!FAIL_ON_VALUES.includes(opts.failOn as FailOn)) {
          console.error(
            chalk.red(`Invalid --fail-on: "${opts.failOn}". Valid: ${FAIL_ON_VALUES.join(", ")}`)
          );
          throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
        }
        const failOn = opts.failOn as FailOn;

        const projectRoot = path.resolve(pathArg);
        if (!fs.existsSync(projectRoot)) {
          console.error(chalk.red(`Path does not exist: ${pathArg}`));
          throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
        }

        const projectConfig = loadProjectConfig(projectRoot);
        const backend = projectConfig?.backend ?? loadUserConfig().default_backend;

        let collected: Awaited<ReturnType<typeof collectGovernanceReport>>;
        try {
          const fingerprint = await detect(projectRoot);
          const pack = resolveTemplatePack(fingerprint, backend);
          collected = await collectGovernanceReport({
            projectRoot,
            manifest: pack.manifest,
            backend,
            fingerprint,
          });
        } catch (e) {
          console.error(chalk.red(`Report failed: ${normalizeError(e).message}`));
          throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "REPORT_ERROR", "");
        }

        let report = collected.report;
        if (opts.framework) {
          report = filterReportByFramework(report, opts.framework);
        }

        if (opts.snapshot) {
          const snapshot = await buildSnapshot(projectRoot, collected.outcomes);
          await saveSnapshot(projectRoot, snapshot);
          console.log(chalk.dim("Wrote .bp/report-snapshot.json (manual-rule staleness baseline)"));
        }

        const jsonToStdout = opts.json === true;
        const sarifToStdout = opts.sarif === true;

        if (opts.json !== undefined) {
          emit(JSON.stringify(report, null, 2), opts.json);
        }
        if (opts.sarif !== undefined) {
          emit(JSON.stringify(reportToSarif(report), null, 2), opts.sarif);
        }
        if (!jsonToStdout && !sarifToStdout) {
          printTerminalReport(report);
        }

        const exitCode = exitCodeForReport(report, failOn);
        if (exitCode !== EXIT_CODES.SUCCESS) {
          throw new BpError(
            `Governance violations at or above '${failOn}' threshold`,
            exitCode,
            "REPORT_VIOLATIONS",
            ""
          );
        }
      }
    );

  return cmd;
}
