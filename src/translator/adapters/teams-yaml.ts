import type { BlueprintIR } from "../ir.js";

export function generateTeamsYaml(ir: BlueprintIR): string {
  const teams = ir.orchestration?.agent_teams ?? [];

  if (!teams.length) {
    return "# No agent teams defined\nteams: []\n";
  }

  let yaml = "teams:\n";

  for (const team of teams) {
    yaml += `  - name: ${team.team_name}\n`;
    yaml += `    agents: [${team.agents.map((a) => `"${a}"`).join(", ")}]\n`;

    if (team.owner) yaml += `    owner: "${team.owner}"\n`;
    if (team.purpose) yaml += `    purpose: "${team.purpose}"\n`;
    if (team.risk_tier) yaml += `    risk_tier: "${team.risk_tier}"\n`;
    if (team.eval_status) yaml += `    eval_status: "${team.eval_status}"\n`;
    if (team.version) yaml += `    version: "${team.version}"\n`;

    if (team.capabilities?.length) {
      yaml += `    capabilities:\n`;
      for (const cap of team.capabilities) {
        yaml += `      - "${cap}"\n`;
      }
    }
  }

  return yaml;
}
