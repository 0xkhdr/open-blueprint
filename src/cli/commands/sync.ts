import * as fs from "node:fs";
import * as path from "node:path";
import * as readline from "node:readline";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { BpError } from "../../errors.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { normalizeError } from "../../utils/errors.js";
import { FINGERPRINT_FILE, storeFingerprint, validateDrift } from "../../validator/drift.js";
import { EXIT_CODES } from "../../validator/index.js";
import type { ValidationError } from "../../validator/structural.js";
import { validateStructuralBatch } from "../../validator/structural.js";

// ---------------------------------------------------------------------------
// Safe auto-apply fixes for drift issues
// ---------------------------------------------------------------------------

function canAutoFix(err: ValidationError): boolean {
  return (
    err.type === "FINGERPRINT_DELTA" ||
    err.type === "TEST_COMMAND_DRIFT" ||
    err.type === "DEPENDENCY_DRIFT"
  );
}

function applyDriftFix(err: ValidationError, projectRoot: string, currentFpJson: string): boolean {
  try {
    switch (err.type) {
      case "FINGERPRINT_DELTA":
      case "TEST_COMMAND_DRIFT":
      case "DEPENDENCY_DRIFT": {
        // Store the current fingerprint (already computed)
        fs.writeFileSync(path.join(projectRoot, FINGERPRINT_FILE), currentFpJson, "utf-8");
        return true;
      }
      default:
        return false;
    }
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Interactive prompt (readline-based, ink-compatible fallback)
// ---------------------------------------------------------------------------

async function promptUser(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

async function interactiveSync(
  driftErrors: ValidationError[],
  projectRoot: string,
  currentFpJson: string,
  autoApply: boolean
): Promise<number> {
  let fixedCount = 0;
  let fpUpdated = false;

  for (const err of driftErrors) {
    const relFile = err.file === projectRoot ? "." : path.relative(projectRoot, err.file);
    const isAutoFixable = canAutoFix(err);

    console.log(chalk.yellow(`\n⚠ [${err.type}] ${relFile}`));
    console.log(chalk.white(`  ${err.message}`));
    console.log(chalk.dim(`  → ${err.resolution}`));

    if (!isAutoFixable) {
      console.log(chalk.dim("  (Manual fix required — skipping)"));
      continue;
    }

    let apply = autoApply;
    if (!autoApply) {
      const answer = await promptUser(chalk.cyan(`  Apply fix? [y/n/a(all)/s(skip all)] `));
      if (answer === "a") {
        apply = true;
        // Signal to apply all remaining
      } else if (answer === "s") {
        console.log(chalk.dim("  Skipping all remaining fixes."));
        break;
      } else {
        apply = answer === "y" || answer === "yes";
      }
    }

    if (apply) {
      // Fingerprint-related fixes are all consolidated into one write
      if ((err.type === "FINGERPRINT_DELTA" || err.type === "TEST_COMMAND_DRIFT") && !fpUpdated) {
        const ok = applyDriftFix(err, projectRoot, currentFpJson);
        if (ok) {
          fpUpdated = true;
          fixedCount++;
          console.log(chalk.green(`  ✔ Updated ${FINGERPRINT_FILE}`));
        }
      } else if (err.type === "DEPENDENCY_DRIFT" && !fpUpdated) {
        const ok = applyDriftFix(err, projectRoot, currentFpJson);
        if (ok) {
          fpUpdated = true;
          fixedCount++;
          console.log(chalk.green(`  ✔ Updated ${FINGERPRINT_FILE}`));
        }
      }
    } else {
      console.log(chalk.dim("  Skipped."));
    }
  }

  return fixedCount;
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export function createSyncCommand(): Command {
  const cmd = new Command("sync");

  cmd
    .description("Detect and resolve repository drift")
    .option("--auto-apply", "Apply all safe fixes without prompting", false)
    .option("--report", "Generate drift report only; no changes", false)
    .option("--json", "Machine-readable JSON output", false)
    .action(async (opts: { autoApply: boolean; report: boolean; json: boolean }) => {
      const cwd = process.cwd();
      const userConfig = loadUserConfig();
      const projectConfig = loadProjectConfig(cwd);
      const backend = projectConfig?.backend ?? userConfig.default_backend;

      const spinner = opts.json
        ? null
        : ora({ text: "Detecting repository drift...", color: "cyan" }).start();

      try {
        const fingerprint = await detect(cwd);
        const pack = resolveTemplatePack(fingerprint, backend);
        const currentFpJson = JSON.stringify(fingerprint, null, 2);

        // Collect blueprint files for drift analysis
        const fg = await import("fast-glob");
        const patterns: string[] = [
          ...pack.manifest.file_patterns.anchor.map((p: string) => path.join(cwd, p)),
          path.join(cwd, pack.manifest.file_patterns.rules),
          path.join(cwd, pack.manifest.file_patterns.skills),
          path.join(cwd, pack.manifest.file_patterns.agents),
        ];
        const files = await fg.default(patterns, {
          onlyFiles: true,
          dot: true,
          ignore: ["**/node_modules/**", "**/dist/**"],
        });

        // Run structural check first (required for meaningful drift analysis)
        const structuralErrors = await validateStructuralBatch(files, pack.manifest);
        const structuralHardFail = structuralErrors.some((e) => e.severity === "error");

        // Run drift analysis
        const driftErrors = await validateDrift(files, {
          projectRoot: cwd,
          currentFingerprint: fingerprint,
        });

        spinner?.stop();

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                driftIssues: driftErrors.length,
                structuralIssues: structuralErrors.filter((e) => e.severity === "error").length,
                issues: driftErrors,
              },
              null,
              2
            )
          );
          if (driftErrors.length > 0)
            throw new BpError("Command failed", EXIT_CODES.DRIFT_DETECTED, "CMD_ERROR", "");
        }

        if (structuralHardFail) {
          console.warn(
            chalk.yellow(
              `⚠ Blueprint has ${structuralErrors.filter((e) => e.severity === "error").length} structural error(s). Fix these before syncing.`
            )
          );
          console.warn(chalk.dim("  Run `bp verify --level structural` for details."));
        }

        if (driftErrors.length === 0) {
          console.log(chalk.green("✔ No drift detected. Blueprint is up to date."));
          return;
        }

        // Separate auto-fixable from manual
        const autoFixable = driftErrors.filter(canAutoFix);
        const manual = driftErrors.filter((e) => !canAutoFix(e));

        console.log(chalk.bold(`\nDrift Report — ${driftErrors.length} issue(s) found:`));
        console.log(
          chalk.dim(
            `  ${autoFixable.length} auto-fixable, ${manual.length} require manual intervention`
          )
        );

        if (opts.report) {
          // Report-only mode: just display
          for (const err of driftErrors) {
            const relFile = err.file === cwd ? "." : path.relative(cwd, err.file);
            console.log(
              `\n  ${err.severity === "error" ? chalk.red("✗") : chalk.yellow("⚠")} [${err.type}] ${relFile}`
            );
            console.log(chalk.white(`    ${err.message}`));
            console.log(chalk.dim(`    → ${err.resolution}`));
          }
          throw new BpError("Drift detected", EXIT_CODES.DRIFT_DETECTED, "DRIFT_DETECTED", "");
        }

        // Store current fingerprint baseline after sync
        const fixedCount = await interactiveSync(driftErrors, cwd, currentFpJson, opts.autoApply);

        // Always update fingerprint after a successful sync session
        if (fixedCount > 0 || opts.autoApply) {
          await storeFingerprint(cwd, fingerprint);
        }

        if (fixedCount > 0) {
          console.log(
            chalk.green(`\n✔ Applied ${fixedCount} fix(es). Run \`bp verify\` to confirm.`)
          );
        } else {
          console.log(chalk.dim("\nNo changes applied."));
        }

        if (driftErrors.length > fixedCount) {
          throw new BpError("Drift detected", EXIT_CODES.DRIFT_DETECTED, "DRIFT_DETECTED", "");
        }
      } catch (e) {
        spinner?.fail(`Sync error: ${normalizeError(e).message}`);
        if (opts.json) {
          console.log(JSON.stringify({ error: normalizeError(e).message }));
        }
        throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
      }
    });

  return cmd;
}
