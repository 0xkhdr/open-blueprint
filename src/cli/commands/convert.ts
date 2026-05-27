import chalk from "chalk";
import { Command } from "commander";

export function createConvertCommand(): Command {
  return new Command("convert")
    .description("Translate blueprint between backends")
    .option("--from <backend>", "Source backend")
    .option("--to <backend>", "Target backend")
    .option("--input <path>", "Source directory (default: .)")
    .option("--output <path>", "Output directory")
    .action(() => {
      console.log(chalk.yellow("convert: available in Phase 3"));
    });
}
