import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { AntigravityAdapter } from "../../translator/adapters/antigravity.js";
import { ClaudeAdapter } from "../../translator/adapters/claude.js";
import { CodexAdapter } from "../../translator/adapters/codex.js";
import { CopilotAdapter } from "../../translator/adapters/copilot.js";
import { CursorAdapter } from "../../translator/adapters/cursor.js";
import { GeminiAdapter } from "../../translator/adapters/gemini.js";
import { GenericAdapter } from "../../translator/adapters/generic.js";
import { KiroAdapter } from "../../translator/adapters/kiro.js";
import { OpenDevAdapter } from "../../translator/adapters/opendev.js";
import { PIAdapter } from "../../translator/adapters/pi.js";
import { BlueprintIRSchema } from "../../translator/ir.js";
import { EXIT_CODES } from "../../validator/index.js";

const VALID_BACKENDS = [
  "claude",
  "cursor",
  "generic",
  "codex",
  "pi",
  "copilot",
  "gemini",
  "kiro",
  "antigravity",
  "opendev",
] as const;
type Backend = (typeof VALID_BACKENDS)[number];

function getAdapter(backend: string) {
  switch (backend) {
    case "claude":
      return new ClaudeAdapter();
    case "cursor":
      return new CursorAdapter();
    case "generic":
      return new GenericAdapter();
    case "codex":
      return new CodexAdapter();
    case "pi":
      return new PIAdapter();
    case "copilot":
      return new CopilotAdapter();
    case "gemini":
      return new GeminiAdapter();
    case "kiro":
      return new KiroAdapter();
    case "antigravity":
      return new AntigravityAdapter();
    case "opendev":
      return new OpenDevAdapter();
    default:
      return null;
  }
}

export function createConvertCommand(): Command {
  return new Command("convert")
    .description("Translate blueprint between backends")
    .requiredOption(
      "--from <backend>",
      "Source backend (claude | cursor | generic | codex | pi | copilot | gemini | kiro | antigravity)"
    )
    .requiredOption(
      "--to <backend>",
      "Target backend (claude | cursor | generic | codex | pi | copilot | gemini | kiro | antigravity)"
    )
    .option("--input <path>", "Source directory (default: .)", ".")
    .option("--output <path>", "Output directory (default: same as input)", ".")
    .action(async (opts: { from: string; to: string; input: string; output: string }) => {
      const fromBackend = opts.from.toLowerCase();
      const toBackend = opts.to.toLowerCase();
      const inputDir = path.resolve(opts.input);
      const outputDir = path.resolve(opts.output);

      if (!VALID_BACKENDS.includes(fromBackend as Backend)) {
        console.error(
          chalk.red(
            `Unsupported source backend: "${opts.from}". Valid: ${VALID_BACKENDS.join(", ")}`
          )
        );
        process.exit(EXIT_CODES.UNSUPPORTED_BACKEND);
      }

      if (!VALID_BACKENDS.includes(toBackend as Backend)) {
        console.error(
          chalk.red(`Unsupported target backend: "${opts.to}". Valid: ${VALID_BACKENDS.join(", ")}`)
        );
        process.exit(EXIT_CODES.UNSUPPORTED_BACKEND);
      }

      if (!fs.existsSync(inputDir)) {
        console.error(chalk.red(`Input directory does not exist: ${inputDir}`));
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }

      const spinner = ora({
        text: `Converting blueprint from ${fromBackend} to ${toBackend}...`,
        color: "cyan",
      }).start();

      try {
        const sourceAdapter = getAdapter(fromBackend);
        const targetAdapter = getAdapter(toBackend);

        if (!sourceAdapter || !targetAdapter) {
          spinner.fail("Failed to resolve adapters.");
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }

        // Parse to IR
        const ir = await sourceAdapter.parse(inputDir);

        // Strict validation of the parsed IR
        const validationResult = BlueprintIRSchema.safeParse(ir);
        if (!validationResult.success) {
          spinner.fail("Parsed blueprint does not conform to BlueprintIR schema.");
          console.error(chalk.red(JSON.stringify(validationResult.error.format(), null, 2)));
          process.exit(EXIT_CODES.GENERAL_ERROR);
        }

        // Render target
        const writtenFiles = await targetAdapter.render(validationResult.data, outputDir);

        spinner.succeed(
          `Successfully translated blueprint from ${chalk.bold(fromBackend)} to ${chalk.bold(toBackend)}!`
        );

        console.log(chalk.green(`  Written files (${writtenFiles.length}):`));
        for (const file of writtenFiles) {
          console.log(chalk.green(`    + ${path.relative(process.cwd(), file)}`));
        }

        process.exit(EXIT_CODES.SUCCESS);
      } catch (e) {
        spinner.fail(`Conversion failed: ${e instanceof Error ? e.message : String(e)}`);
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    });
}
