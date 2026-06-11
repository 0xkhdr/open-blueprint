import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { startDevServer } from "../../dx/dev-server.js";
import { BpError } from "../../errors.js";
import { activePluginLevels, buildFileInventory } from "../../plugins/context.js";
import { loadPlugins, type PluginMode, pluginOutcomeErrors } from "../../plugins/loader.js";
import { PLUGIN_NAME_RE, pluginScaffoldSource } from "../../plugins/scaffold.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { parseBlueprint } from "../../translator/index.js";
import { normalizeError } from "../../utils/errors.js";
import type { ValidationLevel } from "../../validator/index.js";
import { collectBlueprintFiles, EXIT_CODES, runValidator } from "../../validator/index.js";
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

  cmd
    .command("plugin:scaffold <name>")
    .description("Scaffold a runnable validator plugin (.mjs) using @agentic/bp/plugin")
    .option("--dir <dir>", "Output directory relative to the project root", "plugins")
    .action(async (name: string, opts: { dir: string }) => {
      if (!PLUGIN_NAME_RE.test(name) || name.length > 64) {
        console.error(chalk.red(`Invalid plugin name "${name}": must match [a-z0-9_-]+ (max 64)`));
        throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
      }
      const outDir = path.resolve(process.cwd(), opts.dir);
      const outFile = path.join(outDir, `${name}.mjs`);
      if (fs.existsSync(outFile)) {
        console.error(chalk.red(`Refusing to overwrite existing file: ${outFile}`));
        throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
      }
      fs.mkdirSync(outDir, { recursive: true });
      fs.writeFileSync(outFile, pluginScaffoldSource(name), "utf-8");
      const relFile = path.relative(process.cwd(), outFile);
      console.log(chalk.green(`✔ Created ${relFile}`));
      console.log(
        chalk.dim(
          `\nEnable it in .bp.json:\n` +
            `  "plugins": [{ "path": "./${relFile}", "mode": "isolated" }]\n\n` +
            `Try it: bp dev plugin:test ./${relFile}`
        )
      );
    });

  cmd
    .command("plugin:test <pluginPath>")
    .description("Run a plugin against the current repository and print its diagnostics")
    .option("--mode <mode>", "Execution mode: isolated | inline", "isolated")
    .action(async (pluginPath: string, opts: { mode: string }) => {
      if (opts.mode !== "isolated" && opts.mode !== "inline") {
        console.error(chalk.red(`Invalid mode "${opts.mode}". Valid: isolated, inline`));
        throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
      }
      const cwd = process.cwd();
      const projectConfig = loadProjectConfig(cwd);
      const userConfig = loadUserConfig();
      const backend = projectConfig?.backend ?? userConfig.default_backend;

      const fingerprint = await detect(cwd);
      const pack = resolveTemplatePack(fingerprint, backend);
      const blueprint = await parseBlueprint(cwd, backend);
      const files = await collectBlueprintFiles(cwd, pack.manifest);
      const inventory = await buildFileInventory(cwd, pack.manifest, files);

      const spec = { path: pluginPath, mode: opts.mode as PluginMode };
      const [outcome] = await loadPlugins(
        [spec],
        { blueprint, fingerprint, files: inventory, levels: activePluginLevels("all") },
        cwd
      );
      const diagnostics = outcome ? pluginOutcomeErrors(outcome, cwd) : [];

      if (diagnostics.length === 0) {
        console.log(chalk.green(`✔ Plugin ${pluginPath} ran clean (no diagnostics)`));
        return;
      }
      for (const diag of diagnostics) {
        console.log(formatError(diag, cwd));
        console.log(chalk.dim(`  → ${diag.resolution}`));
      }
      const errorCount = diagnostics.filter((d) => d.severity === "error").length;
      const warningCount = diagnostics.filter((d) => d.severity === "warning").length;
      console.log(chalk.dim(`\n${errorCount} error(s), ${warningCount} warning(s)`));
      if (errorCount > 0) {
        throw new BpError(
          "Plugin reported errors",
          EXIT_CODES.GENERAL_ERROR,
          "PLUGIN_TEST_FAILED",
          "Fix the reported issues or the plugin itself"
        );
      }
    });

  return cmd;
}
