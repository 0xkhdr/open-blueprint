import * as fs from "node:fs";
import * as path from "node:path";
import chalk from "chalk";
import { Command } from "commander";
import { generateMCPRiskReport, scoreMCPServer } from "../../multiagent/mcp-governance.js";
import { BlueprintIRSchema } from "../../translator/ir.js";
import { BpError } from "../../errors.js";

function loadIR(cwd: string) {
  const blueprintPath = path.join(cwd, ".claude", "blueprint.json");
  if (!fs.existsSync(blueprintPath)) {
    console.error(chalk.red(`No blueprint found at ${blueprintPath}. Run 'bp init' first.`));
    throw new BpError("Command failed", 1, "CMD_ERROR", "");
  }
  return BlueprintIRSchema.parse(JSON.parse(fs.readFileSync(blueprintPath, "utf-8")));
}

export function createMCPCommand(): Command {
  const mcp = new Command("mcp").description("Manage MCP server configurations");

  mcp
    .command("list")
    .description("List all MCP servers")
    .option("--json", "Output as JSON")
    .action((opts: { json?: boolean }) => {
      const ir = loadIR(process.cwd());
      const servers = ir.mcp_servers ?? [];

      if (opts.json) {
        console.log(JSON.stringify(servers, null, 2));
        return;
      }

      if (servers.length === 0) {
        console.log(chalk.dim("No MCP servers configured."));
        return;
      }

      console.log(chalk.bold(`\n MCP Servers (${servers.length})\n`));
      for (const s of servers) {
        const score = scoreMCPServer(s);
        const tierColor =
          score.tier === "critical"
            ? chalk.red
            : score.tier === "high"
              ? chalk.yellow
              : score.tier === "medium"
                ? chalk.cyan
                : chalk.green;
        console.log(
          `  ${chalk.bold(s.name)} ${tierColor(`[${score.tier}]`)} score=${score.score}/${score.max}`
        );
        console.log(chalk.dim(`    endpoint: ${s.endpoint}`));
      }
      console.log();
    });

  mcp
    .command("validate")
    .description("Validate MCP server risk scores and auth scopes")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Check without modifying")
    .action((opts: { json?: boolean; dryRun?: boolean }) => {
      const ir = loadIR(process.cwd());
      const servers = ir.mcp_servers ?? [];
      const reports = generateMCPRiskReport(servers);
      const issues = reports.flatMap((r) =>
        r.issues.map((i) => ({ server: r.server, issue: i, tier: r.score.tier }))
      );

      if (opts.json) {
        console.log(JSON.stringify({ valid: issues.length === 0, reports, issues }, null, 2));
        return;
      }

      if (issues.length === 0) {
        console.log(chalk.green(`✓ All ${servers.length} MCP servers pass validation`));
        return;
      }

      console.error(chalk.red(`✗ ${issues.length} issue(s) found:\n`));
      for (const i of issues) {
        const color = i.tier === "critical" || i.tier === "high" ? chalk.red : chalk.yellow;
        console.error(color(`  [${i.server}] ${i.issue}`));
      }
      if (!opts.dryRun) throw new BpError("Command failed", 1, "CMD_ERROR", "");
    });

  mcp
    .command("risk-report")
    .description("Generate MCP server risk report")
    .option("--json", "Output as JSON")
    .option("--dry-run", "Preview without side effects")
    .action((opts: { json?: boolean; dryRun?: boolean }) => {
      const ir = loadIR(process.cwd());
      const servers = ir.mcp_servers ?? [];
      const reports = generateMCPRiskReport(servers);

      if (opts.json) {
        console.log(JSON.stringify(reports, null, 2));
        return;
      }

      console.log(chalk.bold("\n MCP Risk Report\n"));
      for (const r of reports) {
        const tierColor =
          r.score.tier === "critical"
            ? chalk.red
            : r.score.tier === "high"
              ? chalk.yellow
              : r.score.tier === "medium"
                ? chalk.cyan
                : chalk.green;

        console.log(
          `  ${chalk.bold(r.server)} ${tierColor(`[${r.score.tier.toUpperCase()}]`)} ${r.score.score}/${r.score.max}`
        );
        console.log(chalk.dim(`    endpoint: ${r.endpoint}`));
        console.log(
          chalk.dim(
            `    tools: ${r.toolCount}  auth: ${r.hasAuth ? "yes" : chalk.red("NO")}  confirm: ${r.requiresConfirmation ? "yes" : "no"}`
          )
        );
        if (r.issues.length > 0) {
          for (const issue of r.issues) {
            console.log(chalk.yellow(`    ⚠ ${issue}`));
          }
        }
        console.log();
      }
    });

  return mcp;
}
