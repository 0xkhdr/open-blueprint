import * as fs from "node:fs";
import * as path from "node:path";
import { getTemplatesRoot } from "./selector.js";

export function resolveRiskTemplatePack(
  _basePackDir: string,
  riskTier: "low" | "medium" | "high" | "critical"
): string | undefined {
  const riskDir = path.join(getTemplatesRoot(), "_base", `risk-${riskTier}`);
  if (fs.existsSync(riskDir)) {
    return riskDir;
  }
  return undefined;
}

export function mergeRiskTemplates(baseFiles: string[], riskFiles: string[]): string[] {
  const merged = new Map<string, string>(baseFiles.map((f) => [path.basename(f), f]));
  for (const riskFile of riskFiles) {
    merged.set(path.basename(riskFile), riskFile);
  }
  return Array.from(merged.values());
}
