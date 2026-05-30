import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { generateDocs } from "../../dx/docs.js";
import { BpError } from "../../errors.js";
import { normalizeError } from "../../utils/errors.js";
import { resolveAndValidatePath } from "../../utils/paths.js";

export function createDocsCommand(): Command {
  const cmd = new Command("docs");

  cmd
    .description("Generate governance documentation from blueprint")
    .option("--output <path>", "Output directory (default: ./blueprint-docs)", "./blueprint-docs");

  const generateCmd = new Command("generate")
    .description("Generate comprehensive governance documentation")
    .option(
      "--output <path>",
      "Output file or directory (default: ./blueprint-docs)",
      "./blueprint-docs"
    )
    .option("--json", "Output as JSON")
    .action(async (opts: { output: string; json?: boolean }) => {
      const cwd = process.cwd();
      const spinner = ora({ text: "Generating documentation...", color: "cyan" }).start();

      try {
        const markdown = await generateDocs(cwd);

        if (opts.json) {
          spinner.stop();
          console.log(JSON.stringify({ content: markdown }, null, 2));
          return;
        }

        const outputPath = resolveAndValidatePath(opts.output, process.cwd());
        const isDir = !path.extname(outputPath) || fs.existsSync(outputPath);

        let filePath: string;
        if (isDir) {
          if (!fs.existsSync(outputPath)) {
            fs.mkdirSync(outputPath, { recursive: true });
          }
          filePath = path.join(outputPath, "GOVERNANCE.md");
        } else {
          const dir = path.dirname(outputPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          filePath = outputPath;
        }

        fs.writeFileSync(filePath, markdown, "utf-8");
        spinner.succeed(chalk.green("Documentation generated!"));
        console.log(chalk.cyan(`\n  ✔ ${path.relative(cwd, filePath)}`));
      } catch (e) {
        if (e instanceof BpError) throw e;
        spinner.fail(chalk.red(`Documentation generation failed: ${normalizeError(e).message}`));
        throw new BpError(
          `Documentation generation failed: ${normalizeError(e).message}. See: docs/errors.md#code-1`,
          1,
          "DOCS_ERROR",
          "See: docs/errors.md#code-1"
        );
      }
    });

  cmd.addCommand(generateCmd);

  cmd.action(async (opts: { output: string }) => {
    const cwd = process.cwd();
    const outputDir = resolveAndValidatePath(opts.output || "./blueprint-docs", cwd);
    const spinner = ora({ text: "Generating documentation...", color: "cyan" }).start();

    try {
      const markdown = await generateDocs(cwd);

      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      fs.writeFileSync(path.join(outputDir, "GOVERNANCE.md"), markdown, "utf-8");
      spinner.succeed(chalk.green("Documentation generated!"));
      console.log(chalk.cyan(`\n  ✔ GOVERNANCE.md`));
      console.log(chalk.dim(`\nOutput: ${path.relative(cwd, outputDir)}`));
    } catch (e) {
      spinner.fail(chalk.red(`Documentation generation failed: ${normalizeError(e).message}`));
      throw new BpError(
        `Documentation generation failed: ${normalizeError(e).message}. See: docs/errors.md#code-1`,
        1,
        "DOCS_ERROR",
        "See: docs/errors.md#code-1"
      );
    }
  });

  return cmd;
}
