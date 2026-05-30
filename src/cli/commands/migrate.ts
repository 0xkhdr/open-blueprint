import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { listBackendIds } from "../../backends/registry.js";
import { isV1Config } from "../../config/project.js";
import { generateMigrationPlan, generateMigrationReport } from "../../dx/migrate.js";
import { BpError, ConfigError, TranslationError } from "../../errors.js";
import { normalizeError } from "../../utils/errors.js";
import { resolveAndValidatePath } from "../../utils/paths.js";
import { loadStoredFingerprint, storeFingerprint } from "../../validator/drift.js";

export function createMigrateCommand(): Command {
  const cmd = new Command("migrate");

  // --- bp migrate config subcommand ---
  cmd
    .command("config")
    .description(
      "Upgrade .bp.json from v1 (backend string) to v2 (backends array + primary_backend)"
    )
    .option("--dry-run", "Print what would change without writing", false)
    .option("--json", "Output result as JSON", false)
    .action((opts: { dryRun: boolean; json: boolean }) => {
      const cwd = process.cwd();
      const configPath = path.join(cwd, ".bp.json");

      if (!fs.existsSync(configPath)) {
        const msg = "No .bp.json found in current directory";
        if (opts.json) console.log(JSON.stringify({ status: "error", error: msg }));
        else console.error(chalk.red(msg));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      let raw: Record<string, unknown>;
      try {
        raw = JSON.parse(fs.readFileSync(configPath, "utf-8")) as Record<string, unknown>;
      } catch (e) {
        const msg = `Cannot parse .bp.json: ${normalizeError(e).message}`;
        if (opts.json) console.log(JSON.stringify({ status: "error", error: msg }));
        else console.error(chalk.red(msg));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }

      if (!isV1Config(raw)) {
        const msg = ".bp.json is already in v2 format (has backends array)";
        if (opts.json) console.log(JSON.stringify({ status: "ok", message: msg, changed: false }));
        else console.log(chalk.green(`✔ ${msg}`));
        return;
      }

      const backend = raw.backend as string;
      const { backend: _dropped, ...rawWithout } = raw;
      const v2 = {
        ...rawWithout,
        backends: [backend],
        primary_backend: backend,
      };

      if (opts.dryRun) {
        if (opts.json) console.log(JSON.stringify({ status: "ok", dryRun: true, result: v2 }));
        else {
          console.log(chalk.yellow("[DRY RUN] Would rewrite .bp.json to:"));
          console.log(JSON.stringify(v2, null, 2));
        }
        return;
      }

      fs.writeFileSync(configPath, JSON.stringify(v2, null, 2), "utf-8");

      if (opts.json) {
        console.log(JSON.stringify({ status: "ok", changed: true, result: v2 }));
      } else {
        console.log(
          chalk.green(
            `✔ Migrated .bp.json: backend "${backend}" → backends: ["${backend}"], primary_backend: "${backend}"`
          )
        );
      }
    });

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
          const fingerprint = await loadStoredFingerprint(cwd);

          if (!fingerprint) {
            console.log(
              chalk.yellow(
                "No stored blueprint fingerprint found. Use --from/--to for cross-backend migration."
              )
            );
            return;
          }

          const spinner = ora({ text: "Checking schema version...", color: "cyan" }).start();
          if (fingerprint.version === "1.0") {
            fingerprint.version = "1.0";
            fingerprint.detected_at = new Date().toISOString();
            await storeFingerprint(cwd, fingerprint);
            spinner.succeed(chalk.green("Blueprint is up to date."));
          } else {
            spinner.succeed(chalk.green("Blueprint is already at latest schema version."));
          }
          return;
        }

        const fromBackend = opts.from.toLowerCase();
        const toBackend = opts.to.toLowerCase();
        const inputDir = resolveAndValidatePath(opts.input, process.cwd());
        const outputDir = resolveAndValidatePath(opts.output, process.cwd());

        const validIds = listBackendIds();
        if (!validIds.includes(fromBackend)) {
          throw new ConfigError(
            `Unsupported source backend: "${opts.from}". Valid: ${validIds.join(", ")}. Fix: Use one of the listed backends.`
          );
        }

        if (!validIds.includes(toBackend)) {
          throw new ConfigError(
            `Unsupported target backend: "${opts.to}". Valid: ${validIds.join(", ")}. Fix: Use one of the listed backends.`
          );
        }

        if (!fs.existsSync(inputDir)) {
          throw new ConfigError(
            `Input directory does not exist: ${inputDir}. Fix: Check the --input path.`
          );
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
          if (e instanceof ConfigError || e instanceof TranslationError) throw e;
          spinner.fail(chalk.red(`Migration failed: ${normalizeError(e).message}`));
          throw new TranslationError(
            `Migration failed: ${normalizeError(e).message}. See: docs/errors.md#code-7`
          );
        }
      }
    );

  return cmd;
}
