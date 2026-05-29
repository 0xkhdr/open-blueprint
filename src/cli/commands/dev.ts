import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import type { ValidationLevel } from "../../validator/index.js";
import { EXIT_CODES, runValidator } from "../../validator/index.js";
import type { ValidationError } from "../../validator/structural.js";

function formatError(err: ValidationError, cwd: string): string {
  const loc = err.line ? `:${err.line}` : "";
  const relPath = path.relative(cwd, err.file);
  if (err.severity === "error") {
    return chalk.red(`✗ [${err.type}] ${relPath}${loc}\n  ${err.message}`);
  } else if (err.severity === "warning") {
    return chalk.yellow(`⚠ [${err.type}] ${relPath}${loc}\n  ${err.message}`);
  }
  return chalk.blue(`ℹ [${err.type}] ${relPath}${loc}: ${err.message}`);
}

function debounce(func: () => void, delay: number): () => void {
  let timeout: NodeJS.Timeout | null = null;
  return () => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(func, delay);
  };
}

async function runValidation(
  projectRoot: string,
  backend: string,
  level: ValidationLevel
): Promise<ValidationError[]> {
  try {
    const fingerprint = await detect(projectRoot);
    const pack = resolveTemplatePack(fingerprint, backend as any);

    const result = await runValidator({
      level,
      projectRoot,
      manifest: pack.manifest,
      fingerprint,
    });

    return [...result.errors, ...result.warnings];
  } catch (e) {
    console.error(chalk.red(`Validation error: ${e instanceof Error ? e.message : String(e)}`));
    return [];
  }
}

export function createDevCommand(): Command {
  const cmd = new Command("dev");

  cmd
    .description("Live reload dev server with real-time validation")
    .option("--watch <path>", "Directory to watch (default: .)", ".")
    .option("--level <level>", "Validation level (structural|semantic|logical|drift|all)", "all")
    .action(async (opts: { watch: string; level: string }) => {
      const watchDir = path.resolve(opts.watch);
      const cwd = process.cwd();
      const projectConfig = loadProjectConfig(cwd);
      const userConfig = loadUserConfig();
      const backend = projectConfig?.backend ?? userConfig.default_backend;
      const validLevel = (opts.level || "all") as ValidationLevel;

      if (!fs.existsSync(watchDir)) {
        console.error(chalk.red(`Watch directory does not exist: ${watchDir}`));
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }

      console.log(
        chalk.cyan.bold("\n🔄 Blueprint Dev Server\n") +
          chalk.dim(`Watching: ${path.relative(cwd, watchDir)}\n`) +
          chalk.dim(`Backend: ${backend} | Level: ${validLevel}\n`) +
          chalk.dim("Press Ctrl+C to stop\n")
      );

      let lastErrors: ValidationError[] = [];
      let isValidating = false;

      const validate = debounce(async () => {
        if (isValidating) return;
        isValidating = true;

        const spinner = ora({ text: "Validating...", color: "cyan" }).start();
        const errors = await runValidation(cwd, backend, validLevel);
        isValidating = false;

        const errorCount = errors.filter((e) => e.severity === "error").length;
        const warningCount = errors.filter((e) => e.severity === "warning").length;

        if (errors.length === 0) {
          spinner.succeed(chalk.green("✔ No issues found"));
          lastErrors = [];
        } else {
          spinner.stop();
          console.log(
            chalk.yellow(`\n⚠ Found ${errorCount} error(s), ${warningCount} warning(s):\n`)
          );

          for (const err of errors) {
            console.log(formatError(err, cwd));
          }

          // Show diff from last run
          if (lastErrors.length > 0) {
            const newErrors = errors.filter(
              (e) =>
                !lastErrors.some((l) => l.file === e.file && l.type === e.type && l.line === e.line)
            );
            const fixedErrors = lastErrors.filter(
              (e) =>
                !errors.some((n) => n.file === e.file && n.type === e.type && n.line === e.line)
            );

            if (newErrors.length > 0) {
              console.log(chalk.red(`\n↳ New issues: ${newErrors.length}`));
            }
            if (fixedErrors.length > 0) {
              console.log(chalk.green(`↳ Fixed: ${fixedErrors.length}`));
            }
          }

          lastErrors = errors;
        }

        console.log(chalk.dim("\nWaiting for changes..."));
      }, 300);

      // Initial validation
      validate();

      // Watch for file changes
      const watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(watchDir, filename);
        const relPath = path.relative(cwd, fullPath);

        // Ignore node_modules, .git, dist, etc.
        if (
          relPath.startsWith("node_modules") ||
          relPath.startsWith(".git") ||
          relPath.startsWith("dist") ||
          relPath.startsWith(".bp-cache")
        ) {
          return;
        }

        if (eventType === "change" || eventType === "rename") {
          console.log(chalk.dim(`→ Changed: ${relPath}`));
          validate();
        }
      });

      // Graceful shutdown
      process.on("SIGINT", () => {
        console.log(chalk.cyan("\n\n✓ Dev server stopped."));
        watcher.close();
        process.exit(0);
      });
    });

  return cmd;
}
