import path from "node:path";
import type { BlueprintIR } from "../ir.js";

export function generateMemoryConfig(ir: BlueprintIR): string {
  const memory = ir.orchestration?.persistent_memory;

  if (!memory?.enabled) {
    return "# Memory governance disabled\nmemory:\n  enabled: false\n";
  }

  let yaml = "memory:\n";
  yaml += `  enabled: true\n`;

  if (memory.directory) yaml += `  directory: "${memory.directory}"\n`;
  if (memory.retention_policy) yaml += `  retention_policy: "${memory.retention_policy}"\n`;
  if (memory.schema_validation) yaml += `  schema_validation: true\n`;
  if (memory.encryption) yaml += `  encryption: true\n`;

  if (memory.access_control?.length) {
    yaml += `  access_control:\n`;
    for (const ac of memory.access_control) {
      yaml += `    - "${ac}"\n`;
    }
  }

  return yaml;
}

export function getMemoryDirectories(ir: BlueprintIR, projectRoot: string): string[] {
  const memory = ir.orchestration?.persistent_memory;

  if (!memory?.enabled) {
    return [];
  }

  const dirs: string[] = [];
  const baseDir = memory.directory || "memory";

  dirs.push(path.join(projectRoot, baseDir));
  dirs.push(path.join(projectRoot, baseDir, "shared"));

  for (const team of ir.orchestration?.agent_teams ?? []) {
    dirs.push(path.join(projectRoot, baseDir, "agents", team.team_name));
  }

  return dirs;
}
