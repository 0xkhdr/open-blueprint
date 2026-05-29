import * as fs from "node:fs";
import * as path from "node:path";
import { Command } from "commander";
import { ConfigError } from "../../errors.js";
import { generateCostDashboard } from "../../observability/dashboard.js";
import { BlueprintIRSchema } from "../../translator/ir.js";
import { resolveAndValidatePath } from "../../utils/paths.js";

function loadIR(projectRoot: string) {
  const bpPath = path.join(projectRoot, ".claude", "blueprint.json");
  if (!fs.existsSync(bpPath)) {
    throw new ConfigError(`No blueprint found at ${bpPath}. Fix: Run 'bp init' first.`);
  }
  const raw = JSON.parse(fs.readFileSync(bpPath, "utf-8")) as unknown;
  const result = BlueprintIRSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(
      `Blueprint parse failed: ${result.error.message}. Fix: Validate your blueprint.json.`
    );
  }
  return result.data;
}

export function createCostCommand(): Command {
  const cmd = new Command("cost").description("Cost tracking and budget commands");

  cmd
    .command("report")
    .description("Generate cost dashboard from blueprint")
    .option("--json", "Output as JSON")
    .option("--output <file>", "Write markdown to file")
    .argument("[project-root]", "Project root directory", process.cwd())
    .action((projectRoot: string, opts: { json?: boolean; output?: string }) => {
      const ir = loadIR(projectRoot);

      if (opts.json) {
        const cost = ir.cost ?? null;
        const totalBudget = cost?.monthly_budget_usd ?? 0;
        const estimatedSpend =
          (cost?.cost_per_token_usd ?? 0) * (cost?.estimated_monthly_tokens ?? 0);
        console.log(
          JSON.stringify({
            project: ir.spatial_anchor.project_name,
            budget_usd: totalBudget,
            estimated_spend_usd: estimatedSpend,
            percent_used: totalBudget > 0 ? (estimatedSpend / totalBudget) * 100 : 0,
            cost,
          })
        );
        return;
      }

      const dashboard = generateCostDashboard(ir);

      if (opts.output) {
        const outPath = resolveAndValidatePath(opts.output, process.cwd());
        fs.writeFileSync(outPath, dashboard);
        console.log(`Cost dashboard written to ${outPath}`);
      } else {
        console.log(dashboard);
      }
    });

  cmd
    .command("budget")
    .description("Show budget summary")
    .option("--json", "Output as JSON")
    .argument("[project-root]", "Project root directory", process.cwd())
    .action((projectRoot: string, opts: { json?: boolean }) => {
      const ir = loadIR(projectRoot);
      const cost = ir.cost;

      if (!cost) {
        if (opts.json) {
          console.log(JSON.stringify({ error: "No cost configuration found" }));
        } else {
          console.log("No cost configuration found in blueprint.");
        }
        return;
      }

      if (opts.json) {
        console.log(
          JSON.stringify({
            monthly_budget_usd: cost.monthly_budget_usd ?? null,
            per_session_limit_usd: cost.per_session_limit_usd ?? null,
            per_agent_budgets: cost.per_agent_budgets ?? [],
            cost_attribution_level: cost.cost_attribution_level,
          })
        );
        return;
      }

      console.log(`Monthly Budget: $${(cost.monthly_budget_usd ?? 0).toFixed(2)}`);
      if (cost.per_session_limit_usd) {
        console.log(`Per-Session Limit: $${cost.per_session_limit_usd.toFixed(2)}`);
      }
      if (cost.per_agent_budgets?.length) {
        console.log("\nPer-Agent Budgets:");
        for (const entry of cost.per_agent_budgets) {
          console.log(`  ${entry.agent_name}: $${entry.monthly_budget_usd.toFixed(2)}/mo`);
        }
      }
    });

  return cmd;
}
