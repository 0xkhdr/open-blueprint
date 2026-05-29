import type { BlueprintIR, Persona, Rule, Skill } from "../translator/ir.js";
import type { BlueprintDiff } from "./diff.js";
import { diffBlueprints } from "./diff.js";

export interface MergeConflict {
  type: string;
  id: string;
  base: unknown;
  left: unknown;
  right: unknown;
  field: string;
}

export interface MergeResult {
  merged: BlueprintIR;
  conflicts: MergeConflict[];
  autoResolved: number;
}

export function threeWayMerge(
  base: BlueprintIR,
  left: BlueprintIR,
  right: BlueprintIR
): MergeResult {
  const conflicts: MergeConflict[] = [];
  let autoResolved = 0;

  const merged: BlueprintIR = {
    ...left,
    rules: [...left.rules],
    skills: [...left.skills],
    personas: [...left.personas],
    hooks: [...left.hooks],
  };

  const leftDiff = diffBlueprints(base, left);
  const rightDiff = diffBlueprints(base, right);

  // Apply non-conflicting right additions
  for (const added of rightDiff.added) {
    const alreadyInLeft = leftDiff.added.some((a) => a.id === added.id && a.type === added.type);
    if (!alreadyInLeft) {
      if (added.type === "rule") {
        merged.rules = [...merged.rules, added.value as Rule];
      } else if (added.type === "skill") {
        merged.skills = [...merged.skills, added.value as Skill];
      } else if (added.type === "persona") {
        merged.personas = [...merged.personas, added.value as Persona];
      }
      autoResolved++;
    }
  }

  // Handle right removals
  for (const removed of rightDiff.removed) {
    const alsoRemovedByLeft = leftDiff.removed.some(
      (r) => r.id === removed.id && r.type === removed.type
    );
    if (alsoRemovedByLeft) {
      autoResolved++;
    }
    // If left didn't remove, keep left's version (no action needed)
  }

  // Handle right modifications
  for (const modified of rightDiff.modified) {
    const leftModified = leftDiff.modified.find(
      (m) => m.id === modified.id && m.type === modified.type
    );
    if (!leftModified) {
      applyModification(merged, modified);
      autoResolved++;
    } else {
      // Both modified — detect field-level conflicts
      for (const change of modified.changes) {
        const field = (change.split(":")[0] ?? "").trim();
        const leftHasSameField = leftModified.changes.some(
          (c) => (c.split(":")[0] ?? "").trim() === field
        );
        if (leftHasSameField) {
          const baseItems = getItemsOfType(base, modified.type);
          const baseItem = baseItems.find((x) => {
            const item = x as Record<string, unknown>;
            return item.id === modified.id || item.name === modified.id;
          });
          conflicts.push({
            type: modified.type,
            id: modified.id,
            base: baseItem,
            left: leftModified.newValue,
            right: modified.newValue,
            field,
          });
        }
      }
    }
  }

  return { merged, conflicts, autoResolved };
}

function getItemsOfType(ir: BlueprintIR, type: string): unknown[] {
  if (type === "rule") return ir.rules;
  if (type === "skill") return ir.skills;
  if (type === "persona") return ir.personas;
  return [];
}

function applyModification(merged: BlueprintIR, mod: BlueprintDiff["modified"][0]): void {
  if (mod.type === "rule") {
    const idx = merged.rules.findIndex((r) => r.id === mod.id);
    if (idx >= 0) merged.rules[idx] = mod.newValue as Rule;
  } else if (mod.type === "skill") {
    const idx = merged.skills.findIndex((s) => s.name === mod.id);
    if (idx >= 0) merged.skills[idx] = mod.newValue as Skill;
  } else if (mod.type === "persona") {
    const idx = merged.personas.findIndex((p) => p.name === mod.id);
    if (idx >= 0) merged.personas[idx] = mod.newValue as Persona;
  }
}

export function formatMergeReport(result: MergeResult): string {
  let report = "# Blueprint Merge Report\n\n";
  report += `- **Auto-resolved:** ${result.autoResolved}\n`;
  report += `- **Conflicts:** ${result.conflicts.length}\n\n`;

  if (result.conflicts.length > 0) {
    report += "## Conflicts Requiring Manual Resolution\n\n";
    for (const conflict of result.conflicts) {
      report += `### ${conflict.type}: ${conflict.id} (field: ${conflict.field})\n`;
      report += "```\n";
      report += `Base:  ${JSON.stringify(conflict.base)}\n`;
      report += `Left:  ${JSON.stringify(conflict.left)}\n`;
      report += `Right: ${JSON.stringify(conflict.right)}\n`;
      report += "```\n\n";
    }
  } else {
    report += "Clean merge — no conflicts.\n";
  }

  return report;
}
