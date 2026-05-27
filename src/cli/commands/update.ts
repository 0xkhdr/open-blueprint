import chalk from "chalk";
import { Command } from "commander";

export function createUpdateCommand(): Command {
  return new Command("update").description("Update bp itself to latest version").action(() => {
    console.log(chalk.yellow("Run: npm install -g @agentic/bp@latest"));
  });
}
