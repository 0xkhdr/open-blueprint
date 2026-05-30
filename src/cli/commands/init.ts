import * as os from "node:os";
import * as path from "node:path";
import * as readline from "node:readline";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { getBackend, listBackendIds } from "../../backends/registry.js";
import { loadUserConfig } from "../../config/user.js";
import { EXIT_CODES } from "../../constants.js";
import { SecurityError } from "../../errors.js";
import { normalizeError } from "../../utils/errors.js";
import { validateUserInput } from "../../utils/input.js";
import { InitOrchestrator } from "../orchestrators/init.js";

const RISK_TIERS = ["low", "medium", "high", "critical"] as const;
type RiskTier = (typeof RISK_TIERS)[number];

const COMPLIANCE_FRAMEWORKS = ["gdpr", "hipaa", "soc2", "iso42001", "nist"] as const;

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
      const raw = answer.trim().toLowerCase() || defaultValue;
      try {
        resolve(validateUserInput(raw));
      } catch {
        resolve(defaultValue);
      }
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
  console.log(
    chalk.cyan.bold("\n🚀 Blueprint Interactive Setup\n") + chalk.dim("(Press Ctrl+C to cancel)\n")
  );
  const backend = await promptChoose("Which backend tool will you use?", listBackendIds());
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
      .filter((f) => COMPLIANCE_FRAMEWORKS.includes(f as (typeof COMPLIANCE_FRAMEWORKS)[number]));
  }
  return { backend, riskTier, frameworks, teamName };
}

function resolveCodexCommandsPath(backend: string): string | null {
  try {
    const config = getBackend(backend);
    if (!config.globalHomeEnv) return null;
    const envVal = process.env[config.globalHomeEnv];
    const rawBase = envVal ?? (config.fallbackGlobalPath ?? `~/.${backend}`).replace(/^~/, os.homedir());
    if (!rawBase) return null;
    const base = path.resolve(path.normalize(rawBase));
    const resolved = path.resolve(path.normalize(path.join(base, "prompts")));
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      throw new SecurityError("Path traversal detected in environment variable");
    }
    return resolved;
  } catch (e) {
    if (e instanceof SecurityError) throw e;
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
    .option(
      "--confirm-global",
      "Confirm writing to global paths (e.g. CODEX_HOME) without prompting",
      false
    )
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ): Promise<any> => {
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
              console.error(
                chalk.red(
                  `Unknown backend ID(s): ${unknown.join(", ")}. Valid: ${listBackendIds().join(", ")}`
                )
              );
            } else {
              console.log(
                JSON.stringify({
                  status: "error",
                  error: `Unknown backend ID(s): ${unknown.join(", ")}`,
                })
              );
            }
            return EXIT_CODES.UNSUPPORTED_BACKEND;
          }
        } else {
          const backendRaw = toolArg ?? opts.tool ?? userConfig.default_backend;
          const ids = listBackendIds();
          if (!ids.includes(backendRaw)) {
            console.error(chalk.red(`Unsupported backend: "${backendRaw}". Valid: ${ids.join(", ")}`));
            return EXIT_CODES.UNSUPPORTED_BACKEND;
          }
          backends = [backendRaw];
        }

        if (backends.includes("github-copilot")) {
          if (!opts.json) {
            console.warn(
              chalk.yellow(
                "⚠ GitHub Copilot commands require an IDE extension (VS Code, JetBrains, Visual Studio). They are not available in Copilot CLI."
              )
            );
          }
        }

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

        const orchestrator = new InitOrchestrator({
          cwd,
          options: {
            backends,
            template: opts.template,
            force: opts.force,
            dryRun: opts.dryRun,
            json: opts.json,
          },
        });

        const result = await orchestrator.run();

        if (opts.json) {
          console.log(
            JSON.stringify({ status: result.exitCode === 0 ? "ok" : "error", backends: result.backends }, null, 2)
          );
          return result.exitCode;
        }

        for (const msg of result.messages) {
          switch (msg.level) {
            case "success":
              console.log(chalk.green(`✓ ${msg.text}`));
              break;
            case "error":
              console.error(chalk.red(`✗ ${msg.text}`));
              break;
            case "warning":
              console.warn(chalk.yellow(msg.text));
              break;
            default:
              console.log(chalk.dim(`  ${msg.text}`));
          }
        }

        if (result.exitCode === EXIT_CODES.SUCCESS) {
          console.log(chalk.green("\nBlueprint ready."));
        }

        return result.exitCode;
      }
    );

  return cmd;
}
