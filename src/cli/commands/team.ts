import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { ConfigError, ValidationError } from "../../errors.js";
import { BlueprintIRSchema } from "../../translator/ir.js";

function loadIR(cwd: string) {
  const blueprintPath = path.join(cwd, ".claude", "blueprint.json");
  if (!fs.existsSync(blueprintPath)) {
    throw new ConfigError(`No blueprint found at ${blueprintPath}. Fix: Run 'bp init' first.`);
  }
  return BlueprintIRSchema.parse(JSON.parse(fs.readFileSync(blueprintPath, "utf-8")));
}

export function createTeamCommand(): Command {
  const team = new Command("team").description("Manage agent team configurations");

  team
    .command("list")
    .description("List all agent teams")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const ir = loadIR(process.cwd());
      const teams = ir.orchestration?.agent_teams ?? [];

      if (opts.json) {
        console.log(JSON.stringify(teams, null, 2));
        return;
      }

      if (teams.length === 0) {
        console.log(chalk.dim("No agent teams configured."));
        return;
      }

      console.log(chalk.bold(`\n Agent Teams (${teams.length})\n`));
      for (const t of teams) {
        const tier = t.risk_tier ?? "unknown";
        const tierColor =
          tier === "critical"
            ? chalk.red
            : tier === "high"
              ? chalk.yellow
              : tier === "medium"
                ? chalk.cyan
                : chalk.green;
        console.log(`  ${chalk.bold(t.team_name)} ${tierColor(`[${tier}]`)}`);
        console.log(chalk.dim(`    agents: ${t.agents.join(", ")}`));
        if (t.purpose) console.log(chalk.dim(`    purpose: ${t.purpose}`));
      }
      console.log();
    });

  team
    .command("validate")
    .description("Validate agent team configurations")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Check without modifying")
    .action((opts: { json?: boolean; dryRun?: boolean }) => {
      const ir = loadIR(process.cwd());
      const teams = ir.orchestration?.agent_teams ?? [];
      const registeredAgents = new Set((ir.agent_registry?.agents ?? []).map((a) => a.name));
      const errors: Array<{ team: string; issue: string }> = [];

      for (const t of teams) {
        if (!t.owner) {
          errors.push({ team: t.team_name, issue: "missing owner" });
        }
        if (t.agents.length === 0) {
          errors.push({ team: t.team_name, issue: "team has no agents" });
        }
        for (const agentName of t.agents) {
          if (registeredAgents.size > 0 && !registeredAgents.has(agentName)) {
            errors.push({
              team: t.team_name,
              issue: `agent '${agentName}' not in agent_registry`,
            });
          }
        }
        // Check for duplicate agent names within a team
        const seen = new Set<string>();
        for (const a of t.agents) {
          if (seen.has(a)) {
            errors.push({ team: t.team_name, issue: `duplicate agent '${a}' in team` });
          }
          seen.add(a);
        }
      }

      if (opts.json) {
        console.log(JSON.stringify({ valid: errors.length === 0, errors }, null, 2));
        return;
      }

      if (errors.length === 0) {
        console.log(chalk.green(`✓ All ${teams.length} teams valid`));
      } else {
        console.error(chalk.red(`✗ ${errors.length} validation error(s):`));
        for (const e of errors) {
          console.error(chalk.red(`  [${e.team}] ${e.issue}`));
        }
        if (!opts.dryRun) {
          throw new ValidationError(
            `Team validation failed with ${errors.length} error(s). Fix: Resolve the listed issues.`,
            4
          );
        }
      }
    });

  return team;
}
