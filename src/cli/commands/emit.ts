import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { BpError } from "../../errors.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { parseBlueprint } from "../../translator/index.js";
import { type BlueprintIR, BlueprintIRSchema } from "../../translator/ir.js";
import { emitBlueprintFiles } from "../../translator/serialize.js";
import { normalizeError } from "../../utils/errors.js";
import { EXIT_CODES } from "../../validator/index.js";

interface EmitCmdOptions {
  from?: string;
  input?: string;
  dryRun?: boolean;
  force?: boolean;
  json?: boolean;
}

export function createEmitCommand(): Command {
  const cmd = new Command("emit");

  cmd
    .description("Serialize a BlueprintIR back to governance files (round-trip)")
    .argument("[path]", "Project path", ".")
    .option("--input <file>", "Read IR from a JSON file instead of parsing the project")
    .option("--from <backend>", "Backend to parse the current project as")
    .option("--force", "Overwrite files that lack bp markers", false)
    .option("--dry-run", "Preview writes without modifying disk", false)
    .option("--json", "Machine-readable JSON output", false)
    .action(async (pathArg: string, opts: EmitCmdOptions) => {
      const projectRoot = path.resolve(pathArg || ".");
      const projectConfig = loadProjectConfig(projectRoot);
      const userConfig = loadUserConfig();
      const backend =
        opts.from ??
        projectConfig?.primary_backend ??
        projectConfig?.backend ??
        userConfig.default_backend;

      try {
        // 1. Obtain the IR — either from a JSON file or by parsing the project.
        let ir: BlueprintIR;
        if (opts.input) {
          const raw = await fsPromises.readFile(path.resolve(opts.input), "utf-8");
          ir = BlueprintIRSchema.parse(JSON.parse(raw));
        } else {
          ir = await parseBlueprint(projectRoot, backend);
        }

        // 2. Resolve the backend's canonical file locations.
        const fingerprint = await detect(projectRoot);
        const pack = resolveTemplatePack(fingerprint, backend);

        // 3. Emit through the manifest-aware writer.
        const result = await emitBlueprintFiles(ir, projectRoot, pack.manifest, {
          dryRun: !!opts.dryRun,
          force: !!opts.force,
        });

        if (opts.json) {
          console.log(
            JSON.stringify(
              {
                backend,
                dryRun: !!opts.dryRun,
                rules: ir.rules.length,
                skills: ir.skills.length,
                files: result.files.map((f) => ({
                  path: path.relative(projectRoot, f.path),
                  action: f.action,
                })),
              },
              null,
              2
            )
          );
          return;
        }

        const prefix = opts.dryRun ? chalk.dim("[dry-run] ") : "";
        const created = result.files.filter(
          (f) => f.action === "created" || f.action === "dry-run"
        ).length;
        const updated = result.files.filter((f) => f.action === "updated").length;
        const skipped = result.files.filter((f) => f.action === "skipped").length;

        console.log(
          chalk.bold.cyan(
            `\n${prefix}Emitted ${ir.rules.length} rule(s) and ${ir.skills.length} skill(s) for ${backend}:\n`
          )
        );
        for (const f of result.files) {
          const rel = path.relative(projectRoot, f.path);
          const tag =
            f.action === "skipped"
              ? chalk.dim("skipped")
              : f.action === "updated"
                ? chalk.yellow("updated")
                : chalk.green("written");
          console.log(`  ${tag} ${rel}`);
        }
        console.log(chalk.dim(`\n  ${created} written, ${updated} updated, ${skipped} skipped.`));
        if (skipped > 0 && !opts.force) {
          console.log(chalk.dim("  Use --force to overwrite files that lack bp markers."));
        }
        console.log();
      } catch (e) {
        const msg = normalizeError(e).message;
        if (!opts.json) console.error(chalk.red(`Emit failed: ${msg}`));
        throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
      }
    });

  return cmd;
}
