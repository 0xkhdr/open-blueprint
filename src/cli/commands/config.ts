import chalk from "chalk";
import { Command } from "commander";
import type { UserConfig } from "../../config/user.js";
import { loadUserConfig, saveUserConfig } from "../../config/user.js";

export function createConfigCommand(): Command {
  const cmd = new Command("config").description("Configuration management");

  cmd
    .command("get <key>")
    .description("Read a config value")
    .action((key: string) => {
      const config = loadUserConfig();
      if (key in config) {
        console.log(JSON.stringify(config[key as keyof UserConfig]));
      } else {
        console.error(chalk.red(`Unknown config key: ${key}`));
        process.exit(1);
      }
    });

  cmd
    .command("set <key> <value>")
    .description("Set a config value")
    .action((key: string, value: string) => {
      const config = loadUserConfig();
      if (!(key in config)) {
        console.error(chalk.red(`Unknown config key: ${key}`));
        process.exit(1);
      }
      const existing = config[key as keyof UserConfig];
      let parsed: unknown = value;
      if (typeof existing === "boolean") {
        parsed = value === "true";
      } else if (typeof existing === "number") {
        parsed = Number(value);
      }
      saveUserConfig({ [key]: parsed } as Partial<UserConfig>);
      console.log(chalk.green(`Set ${key} = ${value}`));
    });

  cmd
    .command("reset")
    .description("Reset to defaults")
    .action(() => {
      saveUserConfig({});
      console.log(chalk.green("Config reset to defaults"));
    });

  return cmd;
}
