import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { BpError } from "../../errors.js";
import { fromIRChain, validateChainDAG } from "../../multiagent/chains.js";
import { BlueprintIRSchema } from "../../translator/ir.js";

function loadIR(cwd: string) {
  const blueprintPath = path.join(cwd, ".claude", "blueprint.json");
  if (!fs.existsSync(blueprintPath)) {
    console.error(chalk.red(`No blueprint found at ${blueprintPath}. Run 'bp init' first.`));
    throw new BpError("Command failed", 1, "CMD_ERROR", "");
  }
  return BlueprintIRSchema.parse(JSON.parse(fs.readFileSync(blueprintPath, "utf-8")));
}

export function createChainCommand(): Command {
  const chain = new Command("chain").description("Manage agent chain configurations");

  chain
    .command("list")
    .description("List all agent chains")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const ir = loadIR(process.cwd());
      const chains = ir.orchestration?.agent_chains ?? [];

      if (opts.json) {
        console.log(JSON.stringify(chains, null, 2));
        return;
      }

      if (chains.length === 0) {
        console.log(chalk.dim("No agent chains configured."));
        return;
      }

      console.log(chalk.bold(`\n Agent Chains (${chains.length})\n`));
      for (const c of chains) {
        const parallel = c.parallel_mode ? chalk.cyan(" [parallel]") : "";
        console.log(`  ${chalk.bold(c.chain_name)}${parallel}`);
        console.log(chalk.dim(`    sequence: ${c.sequence.join(" → ")}`));
        if (c.timeout_ms) console.log(chalk.dim(`    timeout: ${c.timeout_ms}ms`));
      }
      console.log();
    });

  chain
    .command("validate")
    .description("Validate chain DAGs — detect cycles and unresolved references")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Check without modifying")
    .action((opts: { json?: boolean; dryRun?: boolean }) => {
      const ir = loadIR(process.cwd());
      const chains = ir.orchestration?.agent_chains ?? [];
      const results: Array<{
        chain: string;
        valid: boolean;
        errors: string[];
        warnings: string[];
      }> = [];

      for (const c of chains) {
        const config = fromIRChain(c);
        const result = validateChainDAG(config);
        results.push({ chain: c.chain_name, ...result });
      }

      if (opts.json) {
        console.log(JSON.stringify(results, null, 2));
        return;
      }

      const totalErrors = results.reduce((n, r) => n + r.errors.length, 0);
      const totalWarnings = results.reduce((n, r) => n + r.warnings.length, 0);

      if (totalErrors === 0 && totalWarnings === 0) {
        console.log(chalk.green(`✓ All ${chains.length} chains valid`));
        return;
      }

      for (const r of results) {
        if (r.errors.length === 0 && r.warnings.length === 0) continue;
        console.log(`\n  ${chalk.bold(r.chain)}`);
        for (const e of r.errors) {
          console.error(chalk.red(`    ✗ ${e}`));
        }
        for (const w of r.warnings) {
          console.warn(chalk.yellow(`    ⚠ ${w}`));
        }
      }

      if (totalErrors > 0 && !opts.dryRun) throw new BpError("Command failed", 1, "CMD_ERROR", "");
    });

  return chain;
}
