import * as fsPromises from "node:fs/promises";
import chalk from "chalk";
import { Command } from "commander";
import { BpError } from "../../errors.js";
import {
  addTrustedKey,
  loadTrustStore,
  removeTrustedKey,
  trustStorePath,
} from "../../registry/trust.js";

export function createTrustCommand(): Command {
  const cmd = new Command("trust").description(
    "Manage the local trust keyring for signed pack artifacts"
  );

  cmd
    .command("add <name> <pubkeyPath>")
    .description("Add a publisher's PEM public key to the trust keyring")
    .action(async (name: string, pubkeyPath: string) => {
      let pem: string;
      try {
        pem = await fsPromises.readFile(pubkeyPath, "utf-8");
      } catch {
        console.error(chalk.red(`Error: cannot read public key file: ${pubkeyPath}`));
        throw new BpError("Command failed", 1, "CMD_ERROR", "");
      }
      const store = await addTrustedKey(name, pem);
      console.log(chalk.green(`✓ Added trusted key '${name}' (${store.keys.length} key(s) total)`));
      console.log(chalk.dim(`  Trust store: ${trustStorePath()}`));
    });

  cmd
    .command("list")
    .description("List trusted publisher keys")
    .option("--json", "Output as JSON", false)
    .action(async (options: { json?: boolean }) => {
      const store = await loadTrustStore();
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              policy: store.policy,
              keys: store.keys.map((k) => ({ name: k.name, added_at: k.added_at })),
            },
            null,
            2
          )
        );
        return;
      }
      console.log(chalk.bold(`Trust policy: require_signature=${store.policy.require_signature}`));
      if (store.keys.length === 0) {
        console.log(
          chalk.dim("  (no trusted keys — add one with 'bp trust add <name> <pub.pem>')")
        );
        return;
      }
      for (const key of store.keys) {
        console.log(`  ${chalk.cyan(key.name)} (added ${key.added_at})`);
      }
    });

  cmd
    .command("remove <name>")
    .description("Remove a trusted key from the keyring")
    .action(async (name: string) => {
      await removeTrustedKey(name);
      console.log(chalk.green(`✓ Removed trusted key '${name}'`));
    });

  return cmd;
}
