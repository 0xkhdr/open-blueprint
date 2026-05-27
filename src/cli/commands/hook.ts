import chalk from "chalk";
import { Command } from "commander";

export function createHookCommand(): Command {
  const cmd = new Command("hook").description("Hook management");
  cmd
    .command("generate")
    .description("Generate hook stubs for current backend")
    .action(() => {
      console.log(chalk.yellow("hook generate: available in Phase 2"));
    });
  cmd
    .command("validate <file>")
    .description("Validate hook safety")
    .action(() => {
      console.log(chalk.yellow("hook validate: available in Phase 4"));
    });
  return cmd;
}
