import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { getBackend, listBackendIds } from "../../backends/registry.js";
import { loadProjectConfig } from "../../config/project.js";
import { ConfigError, TranslationError } from "../../errors.js";
import { parseBlueprint, renderBlueprint } from "../../translator/index.js";
import { BlueprintIRSchema } from "../../translator/ir.js";
import { resolveAndValidatePath } from "../../utils/paths.js";

export function createConvertCommand(): Command {
  return new Command("convert")
    .description("Translate blueprint between backends")
    .requiredOption("--from <backend>", "Source backend ID")
    .requiredOption("--to <backend>", "Target backend ID")
    .option("--input <path>", "Source directory (default: .)", ".")
    .option("--output <path>", "Output directory (default: same as input)", ".")
    .option("--json", "Machine-readable JSON output", false)
    .action(
      async (opts: { from: string; to: string; input: string; output: string; json: boolean }) => {
        const fromBackend = opts.from.toLowerCase();
        const toBackend = opts.to.toLowerCase();
        const validIds = listBackendIds();

        if (!validIds.includes(fromBackend)) {
          if (opts.json) {
            console.log(
              JSON.stringify({
                status: "error",
                error: `Unsupported source backend: "${opts.from}"`,
              })
            );
          } else {
            console.error(
              chalk.red(`Unsupported source backend: "${opts.from}". Valid: ${validIds.join(", ")}`)
            );
          }
          throw new ConfigError(
            `Unsupported source backend: "${opts.from}". Fix: Use one of: ${validIds.join(", ")}`
          );
        }

        if (!validIds.includes(toBackend)) {
          if (opts.json) {
            console.log(
              JSON.stringify({ status: "error", error: `Unsupported target backend: "${opts.to}"` })
            );
          } else {
            console.error(
              chalk.red(`Unsupported target backend: "${opts.to}". Valid: ${validIds.join(", ")}`)
            );
          }
          throw new ConfigError(
            `Unsupported target backend: "${opts.to}". Fix: Use one of: ${validIds.join(", ")}`
          );
        }

        const inputDir = resolveAndValidatePath(opts.input, process.cwd());
        const outputDir = resolveAndValidatePath(opts.output, process.cwd());

        if (!fs.existsSync(inputDir)) {
          throw new ConfigError(
            `Input directory does not exist: ${inputDir}. Fix: Check the --input path.`
          );
        }

        const spinner = opts.json
          ? null
          : ora({
              text: `Converting blueprint from ${fromBackend} to ${toBackend}...`,
              color: "cyan",
            }).start();

        try {
          const sourceConfig = getBackend(fromBackend);
          const targetConfig = getBackend(toBackend);

          // Handle skill-only source
          if (!sourceConfig.supportsCommands && sourceConfig.supportsSkills) {
            if (!opts.json) {
              console.warn(
                chalk.yellow(
                  `Note: "${fromBackend}" is a skill-only backend — reading skill files only`
                )
              );
            }
          }

          const ir = await parseBlueprint(inputDir, fromBackend);

          // Update meta for target
          ir.meta.target_backend = toBackend;

          const validationResult = BlueprintIRSchema.safeParse(ir);
          if (!validationResult.success) {
            spinner?.fail("Parsed blueprint does not conform to BlueprintIR schema.");
            if (!opts.json)
              console.error(chalk.red(JSON.stringify(validationResult.error.format(), null, 2)));
            throw new TranslationError(
              `Blueprint IR schema validation failed. See: docs/errors.md#code-7`
            );
          }

          // Apply backend_configs overrides from .bp.json
          const projectConfig = loadProjectConfig(inputDir);
          const backendOverride = projectConfig?.backend_configs?.[toBackend];
          if (backendOverride) {
            if (backendOverride.workflows && backendOverride.workflows.length > 0) {
              const allowed = new Set(backendOverride.workflows.map((w) => w.toLowerCase()));
              validationResult.data.skills = validationResult.data.skills.filter((s) =>
                allowed.has(s.name.toLowerCase().replace(/\s+/g, "-"))
              );
            }
            if (backendOverride.delivery_mode === "commands_only") {
              validationResult.data.skills = [];
            }
          }

          // Handle skill-only target
          if (!targetConfig.supportsCommands) {
            if (!opts.json) {
              console.log(
                chalk.yellow(
                  `Note: "${toBackend}" is a skill-only backend — generating skill files only`
                )
              );
            }
          }

          // Handle github-copilot target
          if (toBackend === "github-copilot") {
            if (!opts.json) {
              console.log(
                chalk.yellow(
                  `Note: GitHub Copilot commands require an IDE extension (VS Code, JetBrains, Visual Studio)`
                )
              );
            }
          }

          let writtenFiles = await renderBlueprint(validationResult.data, outputDir, toBackend);

          // Enforce skills_only delivery_mode: remove generated command files
          if (backendOverride?.delivery_mode === "skills_only" && targetConfig.commandsPath) {
            const commandsDir = path.resolve(outputDir, targetConfig.commandsPath);
            writtenFiles = writtenFiles.filter((f) => {
              if (path.resolve(f).startsWith(commandsDir)) {
                try {
                  fs.rmSync(f);
                } catch {
                  /* ignore */
                }
                return false;
              }
              return true;
            });
          }

          if (opts.json) {
            console.log(JSON.stringify({ status: "ok", filesWritten: writtenFiles }));
            return;
          }

          spinner?.succeed(
            `Successfully translated blueprint from ${chalk.bold(fromBackend)} to ${chalk.bold(toBackend)}!`
          );
          console.log(chalk.green(`  Written files (${writtenFiles.length}):`));
          for (const file of writtenFiles) {
            console.log(chalk.green(`    + ${path.relative(process.cwd(), file)}`));
          }
        } catch (e) {
          if (e instanceof TranslationError || e instanceof ConfigError) throw e;
          spinner?.fail(`Conversion failed: ${e instanceof Error ? e.message : String(e)}`);
          throw new TranslationError(
            `Conversion failed: ${e instanceof Error ? e.message : String(e)}. See: docs/errors.md#code-7`
          );
        }
      }
    );
}
