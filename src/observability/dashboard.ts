import type { BlueprintIR, Cost } from "../translator/ir.js";

function progressBar(percent: number, length = 30): string {
  const filled = Math.min(Math.round((percent / 100) * length), length);
  return "█".repeat(filled) + "░".repeat(length - filled);
}

export function generateCostDashboard(ir: BlueprintIR): string {
  const cost = ir.cost as Cost | undefined;
  if (!cost) return "# No cost tracking configured\n";

  const totalBudget = cost.monthly_budget_usd ?? 0;
  const perToken = cost.cost_per_token_usd ?? 0;
  const estimatedTokens = cost.estimated_monthly_tokens ?? 0;
  const totalSpent = perToken * estimatedTokens;
  const percentUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const projectName = ir.spatial_anchor.project_name;
  let md = `# Cost Dashboard: ${projectName}\n\n`;
  md += `**Period:** Monthly | **Budget:** $${totalBudget.toFixed(2)} | **Estimated Spend:** $${totalSpent.toFixed(2)} (${percentUsed.toFixed(1)}%)\n\n`;

  const bar = progressBar(percentUsed);
  md += `\`[${bar}]\` ${percentUsed.toFixed(1)}%\n\n`;

  if (cost.per_session_limit_usd) {
    md += `**Per-Session Limit:** $${cost.per_session_limit_usd.toFixed(2)}\n\n`;
  }

  if (cost.per_agent_budgets && cost.per_agent_budgets.length > 0) {
    md += "## By Agent\n\n";
    md += "| Agent | Monthly Budget | % of Total |\n";
    md += "|-------|---------------|------------|\n";
    for (const entry of cost.per_agent_budgets) {
      const agentPercent = totalBudget > 0 ? (entry.monthly_budget_usd / totalBudget) * 100 : 0;
      md += `| ${entry.agent_name} | $${entry.monthly_budget_usd.toFixed(2)} | ${agentPercent.toFixed(1)}% |\n`;
    }
    md += "\n";
  }

  md += "## Configuration\n\n";
  md += `| Setting | Value |\n`;
  md += `|---------|-------|\n`;
  md += `| Cost tracking | ${cost.cost_tracking_enabled ? "enabled" : "disabled"} |\n`;
  md += `| Token tracking | ${cost.token_tracking_enabled ? "enabled" : "disabled"} |\n`;
  md += `| Attribution level | ${cost.cost_attribution_level ?? "agent"} |\n`;
  if (cost.cost_per_token_usd) {
    md += `| Cost per token | $${cost.cost_per_token_usd} |\n`;
  }
  if (cost.estimated_monthly_tokens) {
    md += `| Estimated monthly tokens | ${cost.estimated_monthly_tokens.toLocaleString()} |\n`;
  }

  if (totalBudget > 0 && percentUsed > 80) {
    md += `\n## ⚠️ Alerts\n\n`;
    md += `- **Budget Alert:** Estimated spend at ${percentUsed.toFixed(1)}% of monthly budget\n`;
  }

  return md;
}

export function generateAgentCostTable(
  agentBudgets: Array<{ agent_name: string; monthly_budget_usd: number }>,
  totalBudget: number
): string {
  let md = "| Agent | Monthly Budget | % of Total |\n";
  md += "|-------|---------------|------------|\n";
  for (const entry of agentBudgets) {
    const percent = totalBudget > 0 ? (entry.monthly_budget_usd / totalBudget) * 100 : 0;
    md += `| ${entry.agent_name} | $${entry.monthly_budget_usd.toFixed(2)} | ${percent.toFixed(1)}% |\n`;
  }
  return md;
}
