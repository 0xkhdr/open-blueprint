import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import { generateDocs } from "../../dx/docs.js";
import { EXIT_CODES } from "../../validator/index.js";

export function createDocsCommand(): Command {
  const cmd = new Command("docs");

  cmd.description("Generate governance documentation from blueprint");

  const generateCmd = new Command("generate")
    .description("Generate comprehensive governance documentation")
    .option("--output <path>", "Output file or directory (default: ./blueprint-docs)", "./blueprint-docs")
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

        const outputPath = path.resolve(opts.output);
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
        spinner.fail(
          chalk.red(
            `Documentation generation failed: ${e instanceof Error ? e.message : String(e)}`
          )
        );
        process.exit(EXIT_CODES.GENERAL_ERROR);
      }
    });

  cmd.addCommand(generateCmd);

  cmd.action(async (opts: { output: string }) => {
    const cwd = process.cwd();
    const outputDir = path.resolve(opts.output || "./blueprint-docs");
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
      spinner.fail(
        chalk.red(
          `Documentation generation failed: ${e instanceof Error ? e.message : String(e)}`
        )
      );
      process.exit(EXIT_CODES.GENERAL_ERROR);
    }
  });

  return cmd;
}
