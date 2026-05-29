import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { generateMigrationPlan, generateMigrationReport } from "../../dx/migrate.js";
import { loadStoredFingerprint, storeFingerprint } from "../../validator/drift.js";
import { EXIT_CODES } from "../../validator/index.js";

const VALID_BACKENDS = [
  "claude",
  "cursor",
  "generic",
  "codex",
  "pi",
  "copilot",
  "gemini",
  "kiro",
  "antigravity",
  "opendev",
] as const;
type Backend = (typeof VALID_BACKENDS)[number];

export function createMigrateCommand(): Command {
  const cmd = new Command("migrate");

  cmd
    .description(
      "Migrate blueprint between backends or upgrade schema version (cross-backend and schema migration)"
    )
    .option(
      "--from <backend>",
      "Source backend (claude|cursor|codex|pi|kiro|antigravity|copilot|gemini|opendev|generic)"
    )
    .option(
      "--to <backend>",
      "Target backend (claude|cursor|codex|pi|kiro|antigravity|copilot|gemini|opendev|generic)"
    )
    .option("--input <path>", "Source directory (default: .)", ".")
    .option("--output <path>", "Output directory (default: same as input)", ".")
    .option("--report", "Write migration report to markdown file")
    .option("--json", "Output migration plan as JSON")
    .action(
      async (opts: {
        from?: string;
        to?: string;
        input: string;
        output: string;
        report?: boolean;
        json?: boolean;
      }) => {
        const cwd = process.cwd();

        if (!opts.from || !opts.to) {
          const fingerprint = loadStoredFingerprint(cwd);

          if (!fingerprint) {
            console.log(
              chalk.yellow(
                "No stored blueprint fingerprint found. Use --from/--to for cross-backend migration."
              )
            );
            process.exit(0);
          }

          const spinner = ora({ text: "Checking schema version...", color: "cyan" }).start();
          if (fingerprint.version === "1.0") {
            fingerprint.version = "1.0";
            fingerprint.detected_at = new Date().toISOString();
            storeFingerprint(cwd, fingerprint);
            spinner.succeed(chalk.green("Blueprint is up to date."));
          } else {
            spinner.succeed(chalk.green("Blueprint is already at latest schema version."));
          }
          return;
        }

        const fromBackend = opts.from.toLowerCase();
        const toBackend = opts.to.toLowerCase();
        const inputDir = path.resolve(opts.input);
        const outputDir = path.resolve(opts.output);

        if (!VALID_BACKENDS.includes(fromBackend as Backend)) {
          console.error(
            chalk.red(
              `Unsupported source backend: "${opts.from}". Valid: ${VALID_BACKENDS.join(", ")}`
            )
          );
          process.exit(EXIT_CODES.UNSUPPORTED_BACKEND);
        }

        if (!VALID_BACKENDS.includes(toBackend as Backend)) {
          console.error(
            chalk.red(
              `Unsupported target backend: "${opts.to}". Valid: ${VALID_BACKENDS.join(", ")}`
            )
          );
          process.exit(EXIT_CODES.UNSUPPORTED_BACKEND);
        }

        if (!fs.existsSync(inputDir)) {
          console.error(chalk.red(`Input directory does not exist: ${inputDir}`));
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }

        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const spinner = ora({
          text: `Analyzing migration from ${fromBackend} to ${toBackend}...`,
          color: "cyan",
        }).start();

        try {
          const plan = await generateMigrationPlan(inputDir, fromBackend, toBackend);
          spinner.succeed(chalk.green("Migration plan generated!"));

          if (opts.json) {
            console.log(JSON.stringify(plan, null, 2));
            return;
          }

          const report = generateMigrationReport(plan);
          console.log(`\n${report}`);

          if (plan.feature_gaps.length > 0) {
            console.log(
              chalk.yellow(
                `\n⚠ ${plan.feature_gaps.length} feature gap(s): ${plan.feature_gaps.join(", ")}`
              )
            );
          }

          if (opts.report) {
            const reportPath = path.join(outputDir, "MIGRATION_REPORT.md");
            fs.writeFileSync(reportPath, report, "utf-8");
            console.log(chalk.dim(`\nReport written: ${path.relative(cwd, reportPath)}`));
          }
        } catch (e) {
          spinner.fail(
            chalk.red(`Migration failed: ${e instanceof Error ? e.message : String(e)}`)
          );
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    );

  return cmd;
}
