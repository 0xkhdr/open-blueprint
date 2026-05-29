import type { BlueprintIR, Persona, Rule, Skill } from "../translator/ir.js";

export interface BlueprintDiff {
  added: Array<{ type: string; id: string; value: unknown }>;
  removed: Array<{ type: string; id: string; oldValue: unknown }>;
  modified: Array<{
    type: string;
    id: string;
    oldValue: unknown;
    newValue: unknown;
    changes: string[];
  }>;
  unchanged: Array<{ type: string; id: string }>;
}

export function diffBlueprints(left: BlueprintIR, right: BlueprintIR): BlueprintDiff {
  const result: BlueprintDiff = {
    added: [],
    removed: [],
    modified: [],
    unchanged: [],
  };

  // Diff rules by id
  const leftRules = new Map(left.rules.map((r) => [r.id, r]));
  const rightRules = new Map(right.rules.map((r) => [r.id, r]));

  for (const [id, rule] of leftRules) {
    if (!rightRules.has(id)) {
      result.removed.push({ type: "rule", id, oldValue: rule });
    } else {
      const rightRule = rightRules.get(id)!;
      const changes = diffRule(rule, rightRule);
      if (changes.length > 0) {
        result.modified.push({ type: "rule", id, oldValue: rule, newValue: rightRule, changes });
      } else {
        result.unchanged.push({ type: "rule", id });
      }
    }
  }
  for (const [id, rule] of rightRules) {
    if (!leftRules.has(id)) {
      result.added.push({ type: "rule", id, value: rule });
    }
  }

  // Diff skills by name
  const leftSkills = new Map(left.skills.map((s) => [s.name, s]));
  const rightSkills = new Map(right.skills.map((s) => [s.name, s]));

  for (const [name, skill] of leftSkills) {
    if (!rightSkills.has(name)) {
      result.removed.push({ type: "skill", id: name, oldValue: skill });
    } else {
      const rightSkill = rightSkills.get(name)!;
      const changes = diffSkill(skill, rightSkill);
      if (changes.length > 0) {
        result.modified.push({
          type: "skill",
          id: name,
          oldValue: skill,
          newValue: rightSkill,
          changes,
        });
      } else {
        result.unchanged.push({ type: "skill", id: name });
      }
    }
  }
  for (const [name, skill] of rightSkills) {
    if (!leftSkills.has(name)) {
      result.added.push({ type: "skill", id: name, value: skill });
    }
  }

  // Diff personas by name
  const leftPersonas = new Map(left.personas.map((p) => [p.name, p]));
  const rightPersonas = new Map(right.personas.map((p) => [p.name, p]));

  for (const [name, persona] of leftPersonas) {
    if (!rightPersonas.has(name)) {
      result.removed.push({ type: "persona", id: name, oldValue: persona });
    } else {
      const rightPersona = rightPersonas.get(name)!;
      const changes = diffPersona(persona, rightPersona);
      if (changes.length > 0) {
        result.modified.push({
          type: "persona",
          id: name,
          oldValue: persona,
          newValue: rightPersona,
          changes,
        });
      } else {
        result.unchanged.push({ type: "persona", id: name });
      }
    }
  }
  for (const [name, persona] of rightPersonas) {
    if (!leftPersonas.has(name)) {
      result.added.push({ type: "persona", id: name, value: persona });
    }
  }

  return result;
}

export function diffRule(left: Rule, right: Rule): string[] {
  const changes: string[] = [];
  if (left.scope !== right.scope) changes.push(`scope: "${left.scope}" → "${right.scope}"`);
  if (left.severity !== right.severity)
    changes.push(`severity: ${left.severity} → ${right.severity}`);
  if (left.action !== right.action) changes.push("action modified");
  if (left.rationale !== right.rationale) changes.push("rationale modified");
  const leftTags = new Set(left.tags || []);
  const rightTags = new Set(right.tags || []);
  const addedTags = [...rightTags].filter((t) => !leftTags.has(t));
  const removedTags = [...leftTags].filter((t) => !rightTags.has(t));
  if (addedTags.length) changes.push(`tags added: ${addedTags.join(", ")}`);
  if (removedTags.length) changes.push(`tags removed: ${removedTags.join(", ")}`);
  return changes;
}

export function diffSkill(left: Skill, right: Skill): string[] {
  const changes: string[] = [];
  if (left.description !== right.description) changes.push("description modified");
  if (left.when_to_use !== right.when_to_use) changes.push("when_to_use modified");
  if (left.procedure !== right.procedure) changes.push("procedure modified");
  const leftTools = new Set(left.tools_required || []);
  const rightTools = new Set(right.tools_required || []);
  const addedTools = [...rightTools].filter((t) => !leftTools.has(t));
  const removedTools = [...leftTools].filter((t) => !rightTools.has(t));
  if (addedTools.length) changes.push(`tools added: ${addedTools.join(", ")}`);
  if (removedTools.length) changes.push(`tools removed: ${removedTools.join(", ")}`);
  return changes;
}

export function diffPersona(left: Persona, right: Persona): string[] {
  const changes: string[] = [];
  if (left.role !== right.role) changes.push(`role: ${left.role} → ${right.role}`);
  if (left.reasoning_style !== right.reasoning_style)
    changes.push("reasoning_style modified");
  const leftTools = new Set(left.allowed_tools || []);
  const rightTools = new Set(right.allowed_tools || []);
  const addedTools = [...rightTools].filter((t) => !leftTools.has(t));
  const removedTools = [...leftTools].filter((t) => !rightTools.has(t));
  if (addedTools.length) changes.push(`tools added: ${addedTools.join(", ")}`);
  if (removedTools.length) changes.push(`tools removed: ${removedTools.join(", ")}`);
  return changes;
}

export function formatDiffReport(diff: BlueprintDiff): string {
  let report = "# Blueprint Diff Report\n\n";

  report += "## Summary\n";
  report += `- **Added:** ${diff.added.length}\n`;
  report += `- **Removed:** ${diff.removed.length}\n`;
  report += `- **Modified:** ${diff.modified.length}\n`;
  report += `- **Unchanged:** ${diff.unchanged.length}\n\n`;

  if (diff.added.length > 0) {
    report += "## Added\n";
    for (const item of diff.added) {
      report += `- **${item.type}:** ${item.id}\n`;
    }
    report += "\n";
  }

  if (diff.removed.length > 0) {
    report += "## Removed\n";
    for (const item of diff.removed) {
      report += `- **${item.type}:** ${item.id}\n`;
    }
    report += "\n";
  }

  if (diff.modified.length > 0) {
    report += "## Modified\n";
    for (const item of diff.modified) {
      report += `### ${item.type}: ${item.id}\n`;
      for (const change of item.changes) {
        report += `- ${change}\n`;
      }
      report += "\n";
    }
  }

  return report;
}
