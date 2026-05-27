import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import matter from "gray-matter";
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

// ---------------------------------------------------------------------------
// --fix: auto-correct unambiguous structural issues
// ---------------------------------------------------------------------------

function applyFix(err: ValidationError): boolean {
  try {
    if (!fs.existsSync(err.file)) return false;
    const content = fs.readFileSync(err.file, "utf-8");

    switch (err.type) {
      case "MISSING_FRONTMATTER": {
        // Prepend minimal frontmatter based on file type
        const isRule = err.file.includes("/rules/");
        const isSkill = err.file.includes("/skills/");
        const isAgent = err.file.includes("/agents/");

        let fm = "---\n";
        if (isRule) fm += 'scope: "**/*"\nseverity: soft\naction: ""\n';
        else if (isSkill) fm += 'name: ""\ndescription: ""\n';
        else if (isAgent) fm += 'name: ""\n';
        fm += "---\n\n";

        fs.writeFileSync(err.file, fm + content, "utf-8");
        return true;
      }

      case "INVALID_SEVERITY": {
        // Replace invalid severity with "soft"
        if (!content.startsWith("---")) return false;
        const parsed = matter(content);
        (parsed.data as Record<string, unknown>).severity = "soft";
        const lines = content.split("\n");
        const newLines = lines.map((l) => (l.match(/^severity\s*:/) ? "severity: soft" : l));
        fs.writeFileSync(err.file, newLines.join("\n"), "utf-8");
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
// --watch: file watcher with 300ms debounce
// ---------------------------------------------------------------------------

function startWatcher(
  projectRoot: string,
  level: ValidationLevel,
  runValidation: () => Promise<void>
): void {
  const watchDir = path.join(projectRoot, ".claude");
  if (!fs.existsSync(watchDir)) {
    console.warn(chalk.yellow(`Watch: .claude/ directory not found at ${watchDir}`));
    return;
  }

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  const onFileChange = (eventType: string, filename: string | null) => {
    if (!filename?.endsWith(".md") && !filename?.endsWith(".json")) return;
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      console.log(chalk.dim(`\n[watch] ${eventType}: ${filename} — re-validating...`));
      void runValidation();
    }, 300);
  };

  try {
    fs.watch(watchDir, { recursive: true }, onFileChange);
    console.log(
      chalk.dim(`Watching ${path.relative(projectRoot, watchDir)}/ for changes (${level} level)...`)
    );
    console.log(chalk.dim("Press Ctrl+C to stop.\n"));
  } catch (e) {
    console.warn(
      chalk.yellow(`Watch mode unavailable: ${e instanceof Error ? e.message : String(e)}`)
    );
  }
}

// ---------------------------------------------------------------------------
// Main command
// ---------------------------------------------------------------------------

export function createVerifyCommand(): Command {
  const cmd = new Command("verify");

  cmd
    .description("Validate blueprint integrity")
    .option("--level <level>", "structural | semantic | logical | drift | all", "all")
    .option("--json", "Machine-readable JSON output", false)
    .option("--fix", "Auto-correct unambiguous structural issues", false)
    .option("--watch", "Re-validate on file change (debounced 300ms)", false)
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

        const runValidation = async (): Promise<void> => {
          const spinner =
            opts.json || opts.watch
              ? null
              : ora({ text: `Validating blueprint (${level})...`, color: "cyan" }).start();

          try {
            const fingerprint = await detect(cwd);
            const pack = resolveTemplatePack(fingerprint, backend);

            const result = await runValidator({
              level,
              projectRoot: cwd,
              manifest: pack.manifest,
              fingerprint,
            });

            // Apply fixes before reporting
            if (opts.fix && !opts.json) {
              const fixable = [...result.errors, ...result.warnings].filter(
                (e) => e.type === "MISSING_FRONTMATTER" || e.type === "INVALID_SEVERITY"
              );
              let fixedCount = 0;
              for (const err of fixable) {
                if (applyFix(err)) {
                  fixedCount++;
                  console.log(
                    chalk.green(`  ✔ Fixed [${err.type}] in ${path.relative(cwd, err.file)}`)
                  );
                }
              }
              if (fixedCount > 0) {
                spinner?.info(chalk.cyan(`Applied ${fixedCount} auto-fix(es). Re-validating...`));
                // Re-run after fixes
                const reResult = await runValidator({
                  level,
                  projectRoot: cwd,
                  manifest: pack.manifest,
                  fingerprint,
                });
                Object.assign(result, reResult);
              }
            }

            if (opts.json) {
              console.log(JSON.stringify(result, null, 2));
              if (!opts.watch) process.exit(exitCodeForResult(result));
              return;
            }

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

            if (!opts.watch) process.exit(exitCodeForResult(result));
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
            if (!opts.watch) process.exit(EXIT_CODES.GENERAL_ERROR);
          }
        };

        // Initial run
        await runValidation();

        // Watch mode: keep process alive
        if (opts.watch) {
          startWatcher(cwd, level, runValidation);
          // Keep alive
          await new Promise<never>(() => {
            /* intentionally never resolves */
          });
        }
      }
    );

  return cmd;
}
