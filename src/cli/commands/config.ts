import chalk from "chalk";
import { Command } from "commander";
import type { UserConfig } from "../../config/user.js";
import { loadUserConfig, saveUserConfig } from "../../config/user.js";
import { BpError } from "../../errors.js";

// Stage 5: the documented `registry.url` key maps onto the flat config field.
const KEY_ALIASES: Record<string, keyof UserConfig> = {
  "registry.url": "registry_url",
};

// Optional fields are absent from the parsed config until set, so a plain
// `key in config` check would wrongly reject them.
const OPTIONAL_KEYS = new Set<string>(["registry_url", "codex_home"]);

function resolveKey(key: string): string {
  return KEY_ALIASES[key] ?? key;
}

function isKnownKey(key: string, config: UserConfig): boolean {
  return key in config || OPTIONAL_KEYS.has(key);
}

export function createConfigCommand(): Command {
  const cmd = new Command("config").description("Configuration management");

  cmd
    .command("get <key>")
    .description("Read a config value")
    .action((rawKey: string) => {
      const key = resolveKey(rawKey);
      const config = loadUserConfig();
      if (isKnownKey(key, config)) {
        console.log(JSON.stringify(config[key as keyof UserConfig] ?? null));
      } else {
        console.error(chalk.red(`Unknown config key: ${key}`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }
    });

  cmd
    .command("set <key> <value>")
    .description("Set a config value")
    .action((rawKey: string, value: string) => {
      const key = resolveKey(rawKey);
      const config = loadUserConfig();
      if (!isKnownKey(key, config)) {
        console.error(chalk.red(`Unknown config key: ${rawKey}`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
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
