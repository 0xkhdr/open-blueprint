import chalk from "chalk";
import { Command } from "commander";

export function createTemplateCommand(): Command {
  const cmd = new Command("template").description("Manage template packs");
  cmd
    .command("list")
    .description("List available packs")
    .action(() => {
      console.log(chalk.yellow("template list: available in Phase 3"));
    });
  cmd
    .command("add <path>")
    .description("Install custom local pack")
    .action(() => {
      console.log(chalk.yellow("template add: available in Phase 3"));
    });
  cmd
    .command("install <pkg>")
    .description("Install from registry")
    .action(() => {
      console.log(chalk.yellow("template install: available in Phase 3"));
    });
  return cmd;
}
