import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { BlueprintIRSchema } from "../../translator/ir.js";

function loadIR(cwd: string) {
  const blueprintPath = path.join(cwd, ".claude", "blueprint.json");
  if (!fs.existsSync(blueprintPath)) {
    console.error(chalk.red(`No blueprint found at ${blueprintPath}. Run 'bp init' first.`));
    process.exit(1);
  }
  return BlueprintIRSchema.parse(JSON.parse(fs.readFileSync(blueprintPath, "utf-8")));
}

export function createAgentCommand(): Command {
  const agent = new Command("agent").description("Manage agent registry");

  agent
    .command("list")
    .description("List all registered agents")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const cwd = process.cwd();
      const ir = loadIR(cwd);
      const agents = ir.agent_registry?.agents ?? [];

      if (opts.json) {
        console.log(JSON.stringify(agents, null, 2));
        return;
      }

      if (agents.length === 0) {
        console.log(chalk.dim("No agents registered."));
        return;
      }

      console.log(chalk.bold(`\n Agents (${agents.length})\n`));
      for (const a of agents) {
        const tier = a.risk_tier ?? "unknown";
        const tierColor =
          tier === "critical"
            ? chalk.red
            : tier === "high"
              ? chalk.yellow
              : tier === "medium"
                ? chalk.cyan
                : chalk.green;
        console.log(`  ${chalk.bold(a.name)} ${tierColor(`[${tier}]`)} — ${a.purpose}`);
        console.log(
          chalk.dim(`    owner: ${a.owner}  eval: ${a.eval_status}  v${a.version ?? "?"}`)
        );
      }
      console.log();
    });

  agent
    .command("validate")
    .description("Validate agent registry entries")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Check without modifying")
    .action((opts: { json?: boolean; dryRun?: boolean }) => {
      const cwd = process.cwd();
      const ir = loadIR(cwd);
      const agents = ir.agent_registry?.agents ?? [];
      const errors: Array<{ agent: string; issue: string }> = [];

      for (const a of agents) {
        if (!a.owner) errors.push({ agent: a.name, issue: "missing owner" });
        if (!a.purpose) errors.push({ agent: a.name, issue: "missing purpose" });
        if (a.eval_status === "deprecated") {
          errors.push({ agent: a.name, issue: "deprecated agent in registry" });
        }
        if (a.risk_tier === "critical" && a.eval_status !== "certified") {
          errors.push({
            agent: a.name,
            issue: "critical-tier agent must be eval_status=certified",
          });
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ valid: errors.length === 0, errors }, null, 2));
        return;
      }

      if (errors.length === 0) {
        console.log(chalk.green(`✓ All ${agents.length} agents valid`));
      } else {
        console.error(chalk.red(`✗ ${errors.length} validation error(s):`));
        for (const e of errors) {
          console.error(chalk.red(`  [${e.agent}] ${e.issue}`));
        }
        if (!opts.dryRun) process.exit(1);
      }
    });

  agent
    .command("add <name>")
    .description("Add agent to registry (writes to blueprint.json)")
    .option("--owner <owner>", "Agent owner", "unassigned")
    .option("--purpose <purpose>", "Agent purpose", "")
    .option("--risk-tier <tier>", "Risk tier: low|medium|high|critical", "low")
    .option("--dry-run", "Preview without writing")
    .option("--json", "Output as JSON")
    .action(
      (
        name: string,
        opts: {
          owner: string;
          purpose: string;
          riskTier: string;
          dryRun?: boolean;
          json?: boolean;
        }
      ) => {
        const cwd = process.cwd();
        const blueprintPath = path.join(cwd, ".claude", "blueprint.json");
        const ir = loadIR(cwd);

        const existing = ir.agent_registry?.agents.find((a) => a.name === name);
        if (existing) {
          console.error(chalk.red(`Agent '${name}' already exists.`));
          process.exit(1);
        }

        const entry = {
          name,
          owner: opts.owner,
          purpose: opts.purpose,
          risk_tier: opts.riskTier as "low" | "medium" | "high" | "critical",
          eval_status: "untested" as const,
        };

        if (opts.json) {
          console.log(JSON.stringify(entry, null, 2));
        } else {
          console.log(chalk.green(`+ Adding agent: ${name}`));
        }

        if (!opts.dryRun) {
          if (!ir.agent_registry) {
            (ir as Record<string, unknown>).agent_registry = {
              agents: [],
              registry_version: "1.0",
            };
          }
          ir.agent_registry?.agents.push(entry);
          fs.writeFileSync(blueprintPath, JSON.stringify(ir, null, 2), "utf-8");
          if (!opts.json) console.log(chalk.dim(`  Written to ${blueprintPath}`));
        }
      }
    );

  return agent;
}
