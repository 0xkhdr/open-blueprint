import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { getBackend, listBackendIds } from "../../backends/registry.js";
import { initProjectConfig, loadProjectConfig } from "../../config/project.js";
import { loadUserConfig } from "../../config/user.js";
import type { Fingerprint } from "../../detector/fingerprint.js";
import { detect } from "../../detector/index.js";
import { runTemplater } from "../../templater/index.js";
import { resolveTemplatePack } from "../../templater/selector.js";
import { renderBlueprint } from "../../translator/index.js";
import { EXIT_CODES, runValidator } from "../../validator/index.js";

const RISK_TIERS = ["low", "medium", "high", "critical"] as const;
type RiskTier = (typeof RISK_TIERS)[number];

const COMPLIANCE_FRAMEWORKS = ["gdpr", "hipaa", "soc2", "iso42001", "nist"] as const;

function validateBackend(value: string): string {
  const ids = listBackendIds();
  if (!ids.includes(value)) {
    console.error(chalk.red(`Unsupported backend: "${value}". Valid: ${ids.join(", ")}`));
    process.exit(EXIT_CODES.UNSUPPORTED_BACKEND);
  }
  return value;
}

function resolveToolsList(toolsArg: string): string[] {
  if (toolsArg === "all") return listBackendIds();
  return toolsArg.split(",").map((s) => s.trim().toLowerCase());
}

async function promptUser(question: string, defaultValue = ""): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const q = defaultValue ? `${question} [${defaultValue}] ` : `${question} `;
    rl.question(q, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() || defaultValue);
    });
  });
}

async function promptChoose(question: string, choices: readonly string[]): Promise<string> {
  console.log(chalk.cyan(`\n${question}`));
  for (let i = 0; i < choices.length; i++) {
    console.log(chalk.cyan(`  ${i + 1}. ${choices[i]}`));
  }
  let choice: string | undefined;
  while (!choice) {
    const answer = await promptUser("Select option");
    const idx = parseInt(answer, 10);
    if (idx >= 1 && idx <= choices.length) choice = choices[idx - 1];
    else console.log(chalk.yellow("Invalid choice. Try again."));
  }
  return choice;
}

async function interactiveWizard(): Promise<{
  backend: string;
  riskTier: RiskTier;
  frameworks: string[];
  teamName: string;
}> {
  console.log(chalk.cyan.bold("\n🚀 Blueprint Interactive Setup\n") + chalk.dim("(Press Ctrl+C to cancel)\n"));
  const backend = await promptChoose("Which backend tool will you use?", listBackendIds());
  const riskTier = (await promptChoose("What's your project's risk tier?", RISK_TIERS.slice())) as RiskTier;
  const teamName = await promptUser("Team name (optional)", "default");
  const useCompliance = await promptUser("Do you need compliance frameworks? (y/n)", "n");
  let frameworks: string[] = [];
  if (useCompliance === "y" || useCompliance === "yes") {
    const frameworkList = await promptUser(`Which frameworks? (comma-separated: ${COMPLIANCE_FRAMEWORKS.join(", ")})`, "");
    frameworks = frameworkList
      .split(",")
      .map((f) => f.trim().toLowerCase())
      .filter((f) => COMPLIANCE_FRAMEWORKS.includes(f as (typeof COMPLIANCE_FRAMEWORKS)[number]));
  }
  return { backend, riskTier, frameworks, teamName };
}

function resolveCodexCommandsPath(backend: string): string | null {
  try {
    const config = getBackend(backend);
    if (!config.globalHomeEnv) return null;
    const envVal = process.env[config.globalHomeEnv];
    if (envVal) return path.join(envVal, "prompts");
    const fallback = config.fallbackGlobalPath ?? `~/.${backend}/prompts`;
    return fallback.replace(/^~/, os.homedir());
  } catch {
    return null;
  }
}

export function createInitCommand(): Command {
  const cmd = new Command("init");

  cmd
    .description("Scaffold blueprint for current repository")
    .argument("[tool]", "Backend tool ID (or use --tools)")
    .option("--tool <backend>", "Backend (alias for positional arg)")
    .option("--tools <ids>", "Comma-separated backend IDs, or 'all'")
    .option("--template <name>", "Use specific template pack")
    .option("--force", "Overwrite existing blueprint files", false)
    .option("--dry-run", "Show diff of what would be generated", false)
    .option("--no-verify", "Skip post-init validation", false)
    .option("--interactive", "Interactive setup wizard", false)
    .option("--confirm-global", "Confirm writing to global paths (e.g. CODEX_HOME) without prompting", false)
    .option("--json", "Machine-readable JSON output", false)
    .action(
      async (
        toolArg: string | undefined,
        opts: {
          tool?: string;
          tools?: string;
          template?: string;
          force: boolean;
          dryRun: boolean;
          verify: boolean;
          interactive: boolean;
          confirmGlobal: boolean;
          json: boolean;
        }
      ) => {
        const cwd = process.cwd();
        const userConfig = loadUserConfig();

        let backends: string[];

        if (opts.interactive) {
          const answers = await interactiveWizard();
          backends = [answers.backend];
        } else if (opts.tools) {
          backends = resolveToolsList(opts.tools);
          const unknown = backends.filter((b) => !listBackendIds().includes(b));
          if (unknown.length > 0) {
            if (!opts.json) {
              console.error(chalk.red(`Unknown backend ID(s): ${unknown.join(", ")}. Valid: ${listBackendIds().join(", ")}`));
            } else {
              console.log(JSON.stringify({ status: "error", error: `Unknown backend ID(s): ${unknown.join(", ")}` }));
            }
            process.exit(EXIT_CODES.UNSUPPORTED_BACKEND);
          }
        } else {
          const backendRaw = toolArg ?? opts.tool ?? userConfig.default_backend;
          backends = [validateBackend(backendRaw)];
        }

        // Handle github-copilot warning
        if (backends.includes("github-copilot")) {
          if (!opts.json) {
            console.warn(chalk.yellow("⚠ GitHub Copilot commands require an IDE extension (VS Code, JetBrains, Visual Studio). They are not available in Copilot CLI."));
          }
        }

        // Handle codex global path confirmation
        if (backends.includes("codex")) {
          const codexPath = resolveCodexCommandsPath("codex");
          if (!opts.json) {
            console.log(chalk.cyan(`ℹ Codex commands will be written to: ${codexPath}`));
          }
          if (!opts.confirmGlobal && process.stdin.isTTY) {
            const answer = await promptUser("Write to global codex path? (y/n)", "n");
            if (answer !== "y" && answer !== "yes") {
              console.log(chalk.yellow("Skipping codex global path write."));
              backends = backends.filter((b) => b !== "codex");
            }
          }
        }

        const jsonOutput: {
          status: string;
          backends: Array<{ backend: string; filesWritten: string[]; templatePack?: string }>;
        } = { status: "ok", backends: [] };

        if (!opts.json) {
          const spinner = ora({ text: `Detecting repository fingerprint...`, color: "cyan" }).start();
          let fingerprint: Fingerprint;
          try {
            fingerprint = await detect(cwd);
            spinner.succeed(
              `Detected: ${chalk.bold(fingerprint.project.name)} ` +
                `[${fingerprint.languages.filter((l) => l.primary).map((l) => l.name).join(", ")}]`
            );
          } catch (e) {
            spinner.fail(`Detection failed: ${e instanceof Error ? e.message : String(e)}`);
            process.exit(EXIT_CODES.GENERAL_ERROR);
          }
        }

        const allWritten: string[] = [];

        for (const backend of backends) {
          if (!opts.json) {
            const templateSpinner = ora({ text: `Generating ${backend} blueprint...`, color: "cyan" }).start();
            try {
              let fingerprint: Fingerprint;
              try {
                fingerprint = await detect(cwd);
              } catch {
                fingerprint = { project: { name: path.basename(cwd), type: "unknown", git_workflow: "unknown" }, languages: [], frameworks: [], tooling: { test_command: "", package_manager: "", linters: [], formatters: [] }, directory_topology: { src_dirs: [], test_dirs: [], config_dirs: [] }, security: { has_secrets_manager: false, has_auth_layer: false }, metrics: { estimated_lines: 0 } } as unknown as Fingerprint;
              }

              const result = await runTemplater(fingerprint, cwd, {
                backend,
                templateOverride: opts.template ?? undefined,
                dryRun: opts.dryRun,
                force: opts.force,
              });

              templateSpinner.succeed(`${backend}: Blueprint generated (${result.files.length} files)`);

              const createdFiles = result.files.filter((f) => f.action === "created");
              const updatedFiles = result.files.filter((f) => f.action === "updated");
              const skippedFiles = result.files.filter((f) => f.action === "skipped");

              if (createdFiles.length > 0) {
                console.log(chalk.green(`  Created (${createdFiles.length}):`));
                for (const f of createdFiles) console.log(chalk.green(`    + ${path.relative(cwd, f.path)}`));
              }
              if (updatedFiles.length > 0) {
                console.log(chalk.blue(`  Updated (${updatedFiles.length}):`));
                for (const f of updatedFiles) console.log(chalk.blue(`    ~ ${path.relative(cwd, f.path)}`));
              }
              if (skippedFiles.length > 0) {
                console.log(chalk.gray(`  Skipped (${skippedFiles.length}) — use --force to overwrite`));
              }

              allWritten.push(...result.files.map((f) => f.path));
              jsonOutput.backends.push({ backend, filesWritten: result.files.map((f) => f.path), templatePack: result.templatePack });
            } catch (e) {
              templateSpinner.fail(`${backend}: Generation failed: ${e instanceof Error ? e.message : String(e)}`);
            }
          } else {
            jsonOutput.backends.push({ backend, filesWritten: [] });
          }
        }

        if (opts.dryRun && !opts.json) {
          console.log(chalk.yellow("\n[DRY RUN] No files written. Use without --dry-run to apply."));
        }

        // Write .bp.json in v2 format
        if (!opts.dryRun && !loadProjectConfig(cwd)) {
          initProjectConfig(cwd, backends);
          if (!opts.json) console.log(chalk.dim("  Created: .bp.json"));
        }

        if (opts.json) {
          console.log(JSON.stringify(jsonOutput, null, 2));
          return;
        }

        console.log(chalk.green("\nBlueprint ready."));
      }
    );

  return cmd;
}
