import chalk from "chalk";
import { Command } from "commander";
import ora from "ora";
import {
  getTemplateRatings,
  rateTemplate,
  searchMarketplace,
} from "../../ecosystem/marketplace-v2.js";

export function createMarketplaceCommand(): Command {
  const cmd = new Command("marketplace").description("Browse and interact with blueprint marketplace");

  cmd
    .command("search [query]")
    .description("Search marketplace for blueprint templates")
    .option("--backend <backend>", "Filter by backend")
    .option("--framework <framework>", "Filter by framework")
    .option("--risk-tier <tier>", "Filter by risk tier")
    .option("--compliance <standard>", "Filter by compliance standard")
    .option("--verified", "Show only verified templates")
    .option("--json", "Output as JSON")
    .action(
      async (
        query: string,
        opts: {
          backend?: string;
          framework?: string;
          riskTier?: string;
          compliance?: string;
          verified?: boolean;
          json?: boolean;
        }
      ) => {
        const spinner = ora({ text: "Searching marketplace...", color: "cyan" }).start();

        try {
          const filters: import("../../ecosystem/marketplace-v2.js").MarketplaceFilters = {};
          if (opts.backend) filters.backend = opts.backend;
          if (opts.framework) filters.framework = opts.framework;
          if (opts.riskTier) filters.risk_tier = opts.riskTier;
          if (opts.compliance) filters.compliance = opts.compliance;
          if (opts.verified) filters.verified_only = opts.verified;
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
            const badge = t.verified ? chalk.green("✓ verified") : chalk.dim("unverified");
            console.log(`${chalk.cyan(t.name)} ${chalk.dim(`v${t.version}`)} [${badge}]`);
            console.log(`  Author: ${t.author}`);
            if (t.backends.length) console.log(`  Backends: ${t.backends.join(", ")}`);
            if (t.frameworks.length) console.log(`  Frameworks: ${t.frameworks.join(", ")}`);
            console.log();
          }
        } catch (e) {
          spinner.fail(
            chalk.red(`Search failed: ${e instanceof Error ? e.message : String(e)}`)
          );
          process.exit(1);
        }
      }
    );

  cmd
    .command("rate <name>")
    .description("Rate a marketplace template (1-5)")
    .requiredOption("--rating <number>", "Rating from 1 to 5")
    .option("--comment <text>", "Review comment", "")
    .option("--token <token>", "Auth token (or set BP_TOKEN env var)")
    .action(
      async (
        name: string,
        opts: { rating: string; comment: string; token?: string }
      ) => {
        const authToken = opts.token || process.env.BP_TOKEN || "";
        if (!authToken) {
          console.error(
            chalk.red("Auth token required. Use --token or set BP_TOKEN env var.")
          );
          process.exit(1);
        }

        const rating = parseInt(opts.rating, 10);
        if (Number.isNaN(rating) || rating < 1 || rating > 5) {
          console.error(chalk.red("Rating must be between 1 and 5"));
          process.exit(1);
        }

        const spinner = ora({ text: `Rating ${name}...`, color: "cyan" }).start();
        try {
          await rateTemplate(name, rating, opts.comment, authToken);
          spinner.succeed(chalk.green(`Rated ${name}: ${rating}/5`));
        } catch (e) {
          spinner.fail(
            chalk.red(`Rating failed: ${e instanceof Error ? e.message : String(e)}`)
          );
          process.exit(1);
        }
      }
    );

  cmd
    .command("ratings <name>")
    .description("Show ratings for a template")
    .option("--json", "Output as JSON")
    .action(async (name: string, opts: { json?: boolean }) => {
      const spinner = ora({ text: "Fetching ratings...", color: "cyan" }).start();
      try {
        const ratings = await getTemplateRatings(name);
        spinner.stop();

        if (opts.json) {
          console.log(JSON.stringify(ratings, null, 2));
          return;
        }

        if (ratings.length === 0) {
          console.log(chalk.yellow("No ratings yet."));
          return;
        }

        const avg = ratings.reduce((s, r) => s + r.rating, 0) / ratings.length;
        console.log(chalk.bold(`\n${name} — ${avg.toFixed(1)}/5 (${ratings.length} ratings)\n`));
        for (const r of ratings) {
          console.log(`${chalk.yellow("★".repeat(r.rating))} ${chalk.dim(r.user)}`);
          if (r.comment) console.log(`  ${r.comment}`);
        }
      } catch (e) {
        spinner.fail(
          chalk.red(`Fetch failed: ${e instanceof Error ? e.message : String(e)}`)
        );
        process.exit(1);
      }
    });

  return cmd;
}
