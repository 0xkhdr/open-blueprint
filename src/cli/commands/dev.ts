import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { startDevServer } from "../../dx/dev-server.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import type { ValidationLevel } from "../../validator/index.js";
import { EXIT_CODES, runValidator } from "../../validator/index.js";
import type { ValidationError } from "../../validator/structural.js";
import { normalizeError } from "../../utils/errors.js";
import { BpError } from "../../errors.js";

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
    const pack = resolveTemplatePack(fingerprint, backend);

    const result = await runValidator({
      level,
      projectRoot,
      manifest: pack.manifest,
      fingerprint,
    });

    return [...result.errors, ...result.warnings];
  } catch (e) {
    console.error(chalk.red(`Validation error: ${normalizeError(e).message}`));
    return [];
  }
}

export function createDevCommand(): Command {
  const cmd = new Command("dev");

  cmd
    .description("Live reload dev server with real-time validation and browser dashboard")
    .option("--watch <path>", "Directory to watch (default: .)", ".")
    .option("--level <level>", "Validation level (structural|semantic|logical|drift|all)", "all")
    .option("--port <port>", "Port for browser dashboard (default: 3456)", "3456")
    .option("--dashboard", "Serve browser dashboard instead of terminal output")
    .action(async (opts: { watch: string; level: string; port: string; dashboard?: boolean }) => {
      const watchDir = path.resolve(opts.watch);
      const cwd = process.cwd();
      const projectConfig = loadProjectConfig(cwd);
      const userConfig = loadUserConfig();
      const backend = projectConfig?.backend ?? userConfig.default_backend;
      const validLevel = (opts.level || "all") as ValidationLevel;
      const port = parseInt(opts.port, 10) || 3456;

      if (!fs.existsSync(watchDir)) {
        console.error(chalk.red(`Watch directory does not exist: ${watchDir}`));
        throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
      }

      if (opts.dashboard) {
        console.log(
          chalk.cyan.bold("\n🚀 Blueprint Dev Server\n") +
            chalk.dim(`Project: ${path.relative(process.cwd(), watchDir) || "."}\n`) +
            chalk.dim(`Dashboard: http://localhost:${port}\n`) +
            chalk.dim("Press Ctrl+C to stop\n")
        );
        await startDevServer(watchDir, port);
        return;
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

      validate();

      const watcher = fs.watch(watchDir, { recursive: true }, (eventType, filename) => {
        if (!filename) return;

        const fullPath = path.join(watchDir, filename);
        const relPath = path.relative(cwd, fullPath);

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

      process.on("SIGINT", () => {
        console.log(chalk.cyan("\n\n✓ Dev server stopped."));
        watcher.close();
        return;
      });
    });

  return cmd;
}
