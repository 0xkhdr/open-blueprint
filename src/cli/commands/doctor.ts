import chalk from "chalk";
import { Command } from "commander";

export function createDoctorCommand(): Command {
  return new Command("doctor")
    .description("Diagnostic mode")
    .option("--tool <backend>", "Diagnose backend config issues")
    .option("--verbose", "Full diagnostic trace with timing")
    .action(() => {
      console.log(chalk.yellow("doctor: available in Phase 3"));
    });
}
