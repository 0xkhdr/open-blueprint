import chalk from "chalk";
import { Command } from "commander";
import { loadStoredFingerprint, storeFingerprint } from "../../validator/drift.js";

export function createMigrateCommand(): Command {
  const cmd = new Command("migrate");

  cmd.description("Migrate blueprint schema and fingerprint to the latest version").action(() => {
    const cwd = process.cwd();
    const fingerprint = loadStoredFingerprint(cwd);

    if (!fingerprint) {
      console.log(
        chalk.yellow(
          "No stored blueprint fingerprint found in this repository. Nothing to migrate."
        )
      );
      process.exit(0);
    }

    // Check if schema version is older
    if (fingerprint.version === "1.0") {
      console.log(chalk.cyan("Updating blueprint schema from v1.0 to latest v1.0 (migrated)..."));

      // Pin new attributes if any
      fingerprint.version = "1.0"; // No-op for current schema but pins structure safely
      fingerprint.detected_at = new Date().toISOString();

      storeFingerprint(cwd, fingerprint);
      console.log(chalk.green("  ✔ Migration successful! Blueprint is up to date."));
      process.exit(0);
    }

    console.log(chalk.green("Blueprint is already up to date with the latest version."));
    process.exit(0);
  });

  return cmd;
}
