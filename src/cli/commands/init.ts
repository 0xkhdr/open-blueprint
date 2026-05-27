import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { initProjectConfig, loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import type { Fingerprint } from "../../detector/fingerprint.js";
import { detect } from "../../detector/index.js";
import { runTemplater } from "../../templater/index.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { EXIT_CODES, runValidator } from "../../validator/index.js";

const SUPPORTED_BACKENDS = ["claude", "cursor", "opendev", "generic"] as const;
type Backend = (typeof SUPPORTED_BACKENDS)[number];

function validateBackend(value: string): Backend {
  if (!SUPPORTED_BACKENDS.includes(value as Backend)) {
    console.error(
      chalk.red(`Unsupported backend: "${value}". Valid: ${SUPPORTED_BACKENDS.join(", ")}`)
    );
    process.exit(EXIT_CODES.UNSUPPORTED_BACKEND);
  }
  return value as Backend;
}

export function createInitCommand(): Command {
  const cmd = new Command("init");

  cmd
    .description("Scaffold blueprint for current repository")
    .argument("[tool]", "Backend tool: claude | cursor | opendev | generic")
    .option("--tool <backend>", "Backend (alias for positional arg)")
    .option("--template <name>", "Use specific template pack")
    .option("--force", "Overwrite existing blueprint files", false)
    .option("--dry-run", "Show diff of what would be generated", false)
    .option("--no-verify", "Skip post-init validation", false)
    .action(
      async (
        toolArg: string | undefined,
        opts: {
          tool?: string;
          template?: string;
          force: boolean;
          dryRun: boolean;
          verify: boolean;
        }
      ) => {
        const cwd = process.cwd();
        const userConfig = loadUserConfig();

        const backendRaw = toolArg ?? opts.tool ?? userConfig.default_backend;
        const backend = validateBackend(backendRaw);

        const spinner = ora({
          text: `Detecting repository fingerprint...`,
          color: "cyan",
        }).start();

        let fingerprint: Fingerprint;
        try {
          fingerprint = await detect(cwd);
          spinner.succeed(
            `Detected: ${chalk.bold(fingerprint.project.name)} ` +
              `[${fingerprint.languages
                .filter((l) => l.primary)
                .map((l) => l.name)
                .join(", ")}]` +
              (fingerprint.frameworks[0] ? ` + ${fingerprint.frameworks[0].name}` : "")
          );
        } catch (e) {
          spinner.fail(`Detection failed: ${e instanceof Error ? e.message : String(e)}`);
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }

        const templateSpinner = ora({
          text: `Generating ${backend} blueprint...`,
          color: "cyan",
        }).start();

        try {
          const result = await runTemplater(fingerprint, cwd, {
            backend,
            templateOverride: opts.template ?? undefined,
            dryRun: opts.dryRun,
            force: opts.force,
          });

          templateSpinner.succeed(
            `Blueprint generated using pack: ${chalk.bold(result.templatePack)}`
          );

          const createdFiles = result.files.filter((f) => f.action === "created");
          const updatedFiles = result.files.filter((f) => f.action === "updated");
          const skippedFiles = result.files.filter((f) => f.action === "skipped");

          if (createdFiles.length > 0) {
            console.log(chalk.green(`  Created (${createdFiles.length}):`));
            for (const f of createdFiles) {
              console.log(chalk.green(`    + ${path.relative(cwd, f.path)}`));
            }
          }
          if (updatedFiles.length > 0) {
            console.log(chalk.blue(`  Updated (${updatedFiles.length}):`));
            for (const f of updatedFiles) {
              console.log(chalk.blue(`    ~ ${path.relative(cwd, f.path)}`));
            }
          }
          if (skippedFiles.length > 0) {
            console.log(
              chalk.gray(`  Skipped (${skippedFiles.length}) — use --force to overwrite`)
            );
          }

          if (opts.dryRun) {
            console.log(
              chalk.yellow("\n[DRY RUN] No files written. Use without --dry-run to apply.")
            );
            for (const f of result.files) {
              if (f.diff) {
                console.log(chalk.dim(`\n--- diff: ${path.relative(cwd, f.path)} ---`));
                console.log(chalk.dim(f.diff));
              }
            }
          }
        } catch (e) {
          templateSpinner.fail(
            `Template generation failed: ${e instanceof Error ? e.message : String(e)}`
          );
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }

        // Post-init verification
        if (opts.verify && !opts.dryRun) {
          const verifySpinner = ora({ text: "Verifying blueprint...", color: "cyan" }).start();
          try {
            const projectConfig = loadProjectConfig(cwd);
            const effectiveBackend = projectConfig?.backend ?? backend;
            const pack = resolveTemplatePack(fingerprint, effectiveBackend, opts.template);

            const verifyResult = await runValidator({
              level: "structural",
              projectRoot: cwd,
              manifest: pack.manifest,
            });

            if (verifyResult.passed) {
              verifySpinner.succeed(
                `Verification passed (${verifyResult.filesChecked} files checked)`
              );
            } else {
              verifySpinner.warn(`Verification found ${verifyResult.errors.length} error(s)`);
              for (const err of verifyResult.errors) {
                console.error(
                  chalk.red(`  [${err.type}] ${err.file}:${err.line ?? "?"} — ${err.message}`)
                );
                console.error(chalk.yellow(`    Resolution: ${err.resolution}`));
              }
            }
          } catch (e) {
            verifySpinner.warn(
              `Verification failed: ${e instanceof Error ? e.message : String(e)}`
            );
          }
        }

        // Write .bp.json if not exists
        if (!opts.dryRun && !loadProjectConfig(cwd)) {
          initProjectConfig(cwd, backend);
          console.log(chalk.dim("  Created: .bp.json"));
        }

        console.log(chalk.green("\nBlueprint ready."));
      }
    );

  return cmd;
}
