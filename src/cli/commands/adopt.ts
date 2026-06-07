import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import fg from "fast-glob";
import { loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import { detect } from "../../detector/index.js";
import { BpError } from "../../errors.js";
import {
  classifyFile,
  createEmptyManifest,
  loadManifest,
  type Manifest,
  recordFile,
  saveManifest,
  toManifestKey,
} from "../../templater/manifest.js";
import { wrapPreserve } from "../../templater/merger.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { normalizeError } from "../../utils/errors.js";
import { EXIT_CODES } from "../../validator/index.js";

const BP_VERSION = "1.0.0";

interface AdoptOptions {
  dryRun?: boolean;
  json?: boolean;
  wrap?: boolean;
  status?: boolean;
}

/** Collect candidate governance files for the resolved backend. */
async function collectGovernanceFiles(projectRoot: string, backend: string): Promise<string[]> {
  const fingerprint = await detect(projectRoot);
  const pack = resolveTemplatePack(fingerprint, backend);
  const fp = pack.manifest.file_patterns;
  const patterns = [
    ...fp.anchor.map((p) => path.join(projectRoot, p)),
    path.join(projectRoot, fp.rules),
    path.join(projectRoot, fp.skills),
    path.join(projectRoot, fp.agents),
  ];
  return fg(patterns, {
    onlyFiles: true,
    dot: true,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });
}

export function createAdoptCommand(): Command {
  const cmd = new Command("adopt");

  cmd
    .description("Bring existing user-authored rules/skills/agents under bp ownership tracking")
    .argument("[path]", "Project path", ".")
    .option("--status", "Report managed/modified/untracked status without making changes", false)
    .option("--wrap", "Wrap adopted file bodies in bp:preserve markers", false)
    .option("--dry-run", "Preview changes without writing", false)
    .option("--json", "Machine-readable JSON output", false)
    .action(async (pathArg: string, opts: AdoptOptions) => {
      const projectRoot = path.resolve(pathArg || ".");
      const projectConfig = loadProjectConfig(projectRoot);
      const userConfig = loadUserConfig();
      const backend =
        projectConfig?.primary_backend ?? projectConfig?.backend ?? userConfig.default_backend;

      let files: string[];
      try {
        files = await collectGovernanceFiles(projectRoot, backend);
      } catch (e) {
        const msg = normalizeError(e).message;
        if (!opts.json) console.error(chalk.red(`Adopt failed: ${msg}`));
        throw new BpError("Command failed", EXIT_CODES.GENERAL_ERROR, "CMD_ERROR", "");
      }

      const existing = await loadManifest(projectRoot);

      // --status: classify and report only.
      if (opts.status) {
        const statuses = await Promise.all(
          files.map(async (file) => {
            const key = toManifestKey(projectRoot, file);
            let content: string | null = null;
            try {
              content = await fsPromises.readFile(file, "utf-8");
            } catch {
              content = null;
            }
            return classifyFile(existing, key, content);
          })
        );
        if (opts.json) {
          console.log(JSON.stringify({ backend, files: statuses }, null, 2));
          return;
        }
        console.log(chalk.bold.cyan(`\nOwnership status (${backend}):\n`));
        for (const s of statuses) {
          const label =
            s.state === "managed"
              ? chalk.green("managed  ")
              : s.state === "modified"
                ? chalk.yellow("modified ")
                : s.state === "missing"
                  ? chalk.red("missing  ")
                  : chalk.dim("untracked");
          console.log(`  ${label} ${s.path}`);
        }
        console.log();
        return;
      }

      // Adopt untracked files into the manifest.
      const manifest: Manifest = existing ?? createEmptyManifest(BP_VERSION);
      manifest.bp_version = BP_VERSION;

      const adopted: string[] = [];
      const wrapped: string[] = [];
      const skipped: string[] = [];

      for (const file of files) {
        const key = toManifestKey(projectRoot, file);
        if (manifest.files[key]) {
          skipped.push(key);
          continue;
        }
        let content: string;
        try {
          content = await fsPromises.readFile(file, "utf-8");
        } catch {
          continue;
        }

        if (opts.wrap) {
          const wrappedContent = wrapPreserve(content);
          if (wrappedContent !== content) {
            if (!opts.dryRun) await fsPromises.writeFile(file, wrappedContent, "utf-8");
            content = wrappedContent;
            wrapped.push(key);
          }
        }

        recordFile(manifest, key, content, "adopted", null);
        adopted.push(key);
      }

      if (!opts.dryRun && adopted.length > 0) {
        await saveManifest(projectRoot, manifest);
      }

      if (opts.json) {
        console.log(
          JSON.stringify(
            { backend, dryRun: !!opts.dryRun, adopted, wrapped, alreadyTracked: skipped },
            null,
            2
          )
        );
        return;
      }

      const prefix = opts.dryRun ? chalk.dim("[dry-run] ") : "";
      if (adopted.length === 0) {
        console.log(
          chalk.green(
            `✔ Nothing to adopt — all ${skipped.length} governance file(s) are already tracked.`
          )
        );
        return;
      }
      console.log(
        chalk.bold.cyan(`\n${prefix}Adopted ${adopted.length} file(s) into .bp/manifest.json:\n`)
      );
      for (const key of adopted) {
        const tag = wrapped.includes(key) ? chalk.dim(" (wrapped in preserve markers)") : "";
        console.log(chalk.green(`  + ${key}${tag}`));
      }
      if (skipped.length > 0) {
        console.log(chalk.dim(`\n  ${skipped.length} file(s) already tracked.`));
      }
      console.log();
    });

  return cmd;
}
