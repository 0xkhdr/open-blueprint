import * as fs from "node:fs";
import * as path from "node:path";
import type { BlueprintIR } from "../translator/ir.js";

export type MergeStrategy = "deep" | "shallow" | "override";

export interface InheritanceConfig {
  extends: string | string[];
  merge_strategy: MergeStrategy;
  override_audit: boolean;
}

export interface OverrideAuditEntry {
  timestamp: string;
  source: string;
  target: string;
  path: string;
  old_value: unknown;
  new_value: unknown;
  reason?: string;
  author?: string;
}

export function mergeBlueprints(
  base: BlueprintIR,
  override: BlueprintIR,
  strategy: MergeStrategy = "deep",
  audit: OverrideAuditEntry[] = []
): BlueprintIR {
  switch (strategy) {
    case "deep":
      return deepMerge(base, override, audit);
    case "shallow":
      return { ...base, ...override };
    case "override":
      return override;
    default:
      return deepMerge(base, override, audit);
  }
}

function deepMerge(
  base: BlueprintIR,
  override: BlueprintIR,
  audit: OverrideAuditEntry[]
): BlueprintIR {
  const merged: BlueprintIR = {
    ...base,
    rules: [...base.rules],
    skills: [...base.skills],
    personas: [...base.personas],
    hooks: [...base.hooks],
  };

  // Merge rules by id — override wins
  const ruleMap = new Map(base.rules.map((r) => [r.id, r]));
  for (const rule of override.rules) {
    if (ruleMap.has(rule.id)) {
      audit.push({
        timestamp: new Date().toISOString(),
        source: "override",
        target: "merged",
        path: `rules.${rule.id}`,
        old_value: ruleMap.get(rule.id),
        new_value: rule,
      });
    }
    ruleMap.set(rule.id, rule);
  }
  merged.rules = Array.from(ruleMap.values());

  // Merge skills by name — override wins
  const skillMap = new Map(base.skills.map((s) => [s.name, s]));
  for (const skill of override.skills) {
    if (skillMap.has(skill.name)) {
      audit.push({
        timestamp: new Date().toISOString(),
        source: "override",
        target: "merged",
        path: `skills.${skill.name}`,
        old_value: skillMap.get(skill.name),
        new_value: skill,
      });
    }
    skillMap.set(skill.name, skill);
  }
  merged.skills = Array.from(skillMap.values());

  // Merge personas by name — override wins
  const personaMap = new Map(base.personas.map((p) => [p.name, p]));
  for (const persona of override.personas) {
    if (personaMap.has(persona.name)) {
      audit.push({
        timestamp: new Date().toISOString(),
        source: "override",
        target: "merged",
        path: `personas.${persona.name}`,
        old_value: personaMap.get(persona.name),
        new_value: persona,
      });
    }
    personaMap.set(persona.name, persona);
  }
  merged.personas = Array.from(personaMap.values());

  // Override top-level optional sections entirely
  if (override.settings !== undefined) merged.settings = override.settings;
  if (override.risk !== undefined) merged.risk = override.risk;
  if (override.compliance !== undefined) merged.compliance = override.compliance;
  if (override.audit !== undefined) merged.audit = override.audit;
  if (override.identity !== undefined) merged.identity = override.identity;
  if (override.meta !== undefined) merged.meta = { ...base.meta, ...override.meta };

  return merged;
}

export function writeOverrideAudit(audit: OverrideAuditEntry[], projectRoot: string): void {
  const auditPath = path.join(projectRoot, ".bp-override-audit.yaml");
  const lines: string[] = ["overrides:"];
  for (const entry of audit) {
    lines.push(`  - timestamp: "${entry.timestamp}"`);
    lines.push(`    source: "${entry.source}"`);
    lines.push(`    target: "${entry.target}"`);
    lines.push(`    path: "${entry.path}"`);
    if (entry.reason) lines.push(`    reason: "${entry.reason}"`);
    if (entry.author) lines.push(`    author: "${entry.author}"`);
  }
  fs.writeFileSync(auditPath, lines.join("\n") + "\n", "utf-8");
}
