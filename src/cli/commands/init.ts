import * as path from "node:path";
import * as readline from "node:readline";
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

const SUPPORTED_BACKENDS = [
  "claude",
  "cursor",
  "opendev",
  "generic",
  "codex",
  "pi",
  "kiro",
  "antigravity",
  "copilot",
  "gemini",
] as const;
type Backend = (typeof SUPPORTED_BACKENDS)[number];

const RISK_TIERS = ["low", "medium", "high", "critical"] as const;
type RiskTier = (typeof RISK_TIERS)[number];

const COMPLIANCE_FRAMEWORKS = ["gdpr", "hipaa", "soc2", "iso42001", "nist"] as const;

function validateBackend(value: string): Backend {
  if (!SUPPORTED_BACKENDS.includes(value as Backend)) {
    console.error(
      chalk.red(`Unsupported backend: "${value}". Valid: ${SUPPORTED_BACKENDS.join(", ")}`)
    );
    process.exit(EXIT_CODES.UNSUPPORTED_BACKEND);
  }
  return value as Backend;
}

async function promptUser(question: string, defaultValue: string = ""): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    const questionText = defaultValue ? `${question} [${defaultValue}] ` : `${question} `;
    rl.question(questionText, (answer) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      resolve(trimmed || defaultValue);
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
    if (idx >= 1 && idx <= choices.length) {
      choice = choices[idx - 1];
    } else {
      console.log(chalk.yellow("Invalid choice. Try again."));
    }
  }
  return choice;
}

async function interactiveWizard(): Promise<{
  backend: Backend;
  riskTier: RiskTier;
  frameworks: string[];
  teamName: string;
}> {
  console.log(
    chalk.cyan.bold("\n🚀 Blueprint Interactive Setup\n") +
      chalk.dim("(Press Ctrl+C to cancel)\n")
  );

  const backend = (await promptChoose(
    "Which backend tool will you use?",
    SUPPORTED_BACKENDS.slice()
  )) as Backend;

  const riskTier = (await promptChoose(
    "What's your project's risk tier?",
    RISK_TIERS.slice()
  )) as RiskTier;

  const teamName = await promptUser("Team name (optional)", "default");

  const useCompliance = await promptUser("Do you need compliance frameworks? (y/n)", "n");
  let frameworks: string[] = [];
  if (useCompliance === "y" || useCompliance === "yes") {
    const frameworkList = await promptUser(
      `Which frameworks? (comma-separated: ${COMPLIANCE_FRAMEWORKS.join(", ")})`,
      ""
    );
    frameworks = frameworkList
      .split(",")
      .map((f) => f.trim().toLowerCase())
      .filter((f) => COMPLIANCE_FRAMEWORKS.includes(f as any));
  }

  return { backend, riskTier, frameworks, teamName };
}

export function createInitCommand(): Command {
  const cmd = new Command("init");

  cmd
    .description("Scaffold blueprint for current repository")
    .argument("[tool]", "Backend tool: claude | cursor | opendev | generic | codex | pi | kiro | antigravity | copilot | gemini")
    .option("--tool <backend>", "Backend (alias for positional arg)")
    .option("--template <name>", "Use specific template pack")
    .option("--force", "Overwrite existing blueprint files", false)
    .option("--dry-run", "Show diff of what would be generated", false)
    .option("--no-verify", "Skip post-init validation", false)
    .option("--interactive", "Interactive setup wizard", false)
    .action(
      async (
        toolArg: string | undefined,
        opts: {
          tool?: string;
          template?: string;
          force: boolean;
          dryRun: boolean;
          verify: boolean;
          interactive: boolean;
        }
      ) => {
        const cwd = process.cwd();
        const userConfig = loadUserConfig();

        let backend: Backend;

        if (opts.interactive) {
          const answers = await interactiveWizard();
          backend = answers.backend;
        } else {
          const backendRaw = toolArg ?? opts.tool ?? userConfig.default_backend;
          backend = validateBackend(backendRaw);
        }

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
