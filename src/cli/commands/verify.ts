import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import type { ValidationLevel } from "../../validator/index.js";
import { EXIT_CODES, exitCodeForResult, runValidator } from "../../validator/index.js";
import type { ValidationError } from "../../validator/structural.js";

const VALID_LEVELS = ["structural", "semantic", "logical", "drift", "all"] as const;

function formatError(err: ValidationError, cwd: string): void {
  const loc = err.line ? `:${err.line}` : "";
  const relPath = path.relative(cwd, err.file);
  if (err.severity === "error") {
    console.error(chalk.red(`  ✗ [${err.type}] ${relPath}${loc}`));
    console.error(chalk.red(`    ${err.message}`));
    console.error(chalk.yellow(`    → ${err.resolution}`));
  } else if (err.severity === "warning") {
    console.warn(chalk.yellow(`  ⚠ [${err.type}] ${relPath}${loc}`));
    console.warn(chalk.yellow(`    ${err.message}`));
    console.warn(chalk.dim(`    → ${err.resolution}`));
  } else {
    console.log(chalk.blue(`  ℹ [${err.type}] ${relPath}${loc}: ${err.message}`));
  }
}

export function createVerifyCommand(): Command {
  const cmd = new Command("verify");

  cmd
    .description("Validate blueprint integrity")
    .option("--level <level>", "structural | semantic | logical | drift | all", "all")
    .option("--json", "Machine-readable JSON output", false)
    .option("--fix", "Auto-correct unambiguous issues (Phase 2)", false)
    .option("--watch", "Re-validate on file change (Phase 2)", false)
    .option("--fail-on <level>", "Exit non-zero only at this severity level", "logical")
    .action(
      async (opts: {
        level: string;
        json: boolean;
        fix: boolean;
        watch: boolean;
        failOn: string;
      }) => {
        const cwd = process.cwd();

        if (!VALID_LEVELS.includes(opts.level as ValidationLevel)) {
          console.error(
            chalk.red(`Invalid level: "${opts.level}". Valid: ${VALID_LEVELS.join(", ")}`)
          );
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }

        const level = opts.level as ValidationLevel;

        const userConfig = loadUserConfig();
        const projectConfig = loadProjectConfig(cwd);
        const backend = projectConfig?.backend ?? userConfig.default_backend;

        const spinner = opts.json
          ? null
          : ora({ text: `Validating blueprint (${level})...`, color: "cyan" }).start();

        try {
          const fingerprint = await detect(cwd);
          const pack = resolveTemplatePack(fingerprint, backend);

          const result = await runValidator({
            level,
            projectRoot: cwd,
            manifest: pack.manifest,
          });

          if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
            process.exit(exitCodeForResult(result));
          }

          const _total = result.errors.length + result.warnings.length;

          if (result.passed && result.warnings.length === 0) {
            spinner?.succeed(
              chalk.green(`All checks passed (${result.filesChecked} files, ${level} level)`)
            );
          } else if (result.passed) {
            spinner?.warn(
              chalk.yellow(
                `Passed with ${result.warnings.length} warning(s) (${result.filesChecked} files)`
              )
            );
          } else {
            spinner?.fail(
              chalk.red(
                `${result.errors.length} error(s), ${result.warnings.length} warning(s) (${result.filesChecked} files)`
              )
            );
          }

          if (result.errors.length > 0) {
            console.error(chalk.red(`\nErrors (${result.errors.length}):`));
            for (const err of result.errors) formatError(err, cwd);
          }
          if (result.warnings.length > 0) {
            console.warn(chalk.yellow(`\nWarnings (${result.warnings.length}):`));
            for (const warn of result.warnings) formatError(warn, cwd);
          }

          process.exit(exitCodeForResult(result));
        } catch (e) {
          spinner?.fail(`Validation error: ${e instanceof Error ? e.message : String(e)}`);
          if (opts.json) {
            console.log(
              JSON.stringify({
                error: e instanceof Error ? e.message : String(e),
                passed: false,
              })
            );
          }
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }
      }
    );

  return cmd;
}
