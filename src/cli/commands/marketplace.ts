import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import type { MarketplaceFilters } from "../../ecosystem/marketplace-v2.js";
import { searchMarketplace } from "../../ecosystem/marketplace-v2.js";
import { BpError } from "../../errors.js";
import { normalizeError } from "../../utils/errors.js";

export function createMarketplaceCommand(): Command {
  const cmd = new Command("marketplace").description(
    "Discover blueprint template packages published on npm"
  );

  cmd
    .command("search [query]")
    .description("Search npm for blueprint template packages")
    .option("--backend <backend>", "Filter by backend")
    .option("--framework <framework>", "Filter by framework")
    .option("--risk-tier <tier>", "Filter by risk tier")
    .option("--compliance <standard>", "Filter by compliance standard")
    .option("--official", "Show only packages in the official @bp-templates scope")
    .option("--json", "Output as JSON")
    .action(
      async (
        query: string,
        opts: {
          backend?: string;
          framework?: string;
          riskTier?: string;
          compliance?: string;
          official?: boolean;
          json?: boolean;
        }
      ) => {
        const spinner = ora({ text: "Searching npm registry...", color: "cyan" }).start();

        try {
          const filters: MarketplaceFilters = {};
          if (opts.backend) filters.backend = opts.backend;
          if (opts.framework) filters.framework = opts.framework;
          if (opts.riskTier) filters.risk_tier = opts.riskTier;
          if (opts.compliance) filters.compliance = opts.compliance;
          if (opts.official) filters.official_only = opts.official;
          const result = await searchMarketplace(query || "", filters);

          spinner.stop();

          if (opts.json) {
            console.log(JSON.stringify(result, null, 2));
            return;
          }

          if (result.templates.length === 0) {
            console.log(chalk.yellow("No templates found."));
            return;
          }

          console.log(chalk.bold(`\nFound ${result.total} template(s):\n`));
          for (const t of result.templates) {
            const badge = t.official ? chalk.green("official scope") : chalk.dim("community");
            console.log(`${chalk.cyan(t.name)} ${chalk.dim(`v${t.version}`)} [${badge}]`);
            console.log(`  Author: ${t.author}`);
            if (t.downloads) console.log(`  Downloads (monthly): ${t.downloads}`);
            if (t.backends.length) console.log(`  Backends: ${t.backends.join(", ")}`);
            if (t.frameworks.length) console.log(`  Frameworks: ${t.frameworks.join(", ")}`);
            console.log();
          }
        } catch (e) {
          spinner.fail(chalk.red(`Search failed: ${normalizeError(e).message}`));
          throw new BpError("Command failed", 1, "CMD_ERROR", "");
        }
      }
    );

  return cmd;
}
