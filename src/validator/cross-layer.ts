import type { BlueprintIR } from "../translator/ir.js";
import type { ValidationError } from "./structural.js";

export function validateCrossLayerReferences(
  ir: BlueprintIR,
  blueprintFile: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Rule → Skill references
  const skillNames = new Set(ir.skills.map((s) => s.name));
  for (const rule of ir.rules) {
    const refs = extractSkillRefs(rule.action);
    for (const ref of refs) {
      if (!skillNames.has(ref)) {
        errors.push({
          file: blueprintFile,
          type: "MISSING_SKILL_REFERENCE",
          severity: "error",
          message: `Rule "${rule.id}" references unknown skill: ${ref}`,
          resolution: `Add skill '${ref}' to skills directory or remove reference`,
        });
      }
    }
  }

  // 2. Agent → Tool/Skill references
  const knownTools = new Set(["file_read", "file_edit", "terminal", "test_runner", ...skillNames]);
  for (const agent of ir.personas) {
    for (const tool of agent.allowed_tools ?? []) {
      if (!knownTools.has(tool)) {
        errors.push({
          file: blueprintFile,
          type: "UNKNOWN_TOOL_REFERENCE",
          severity: "warning",
          message: `Agent "${agent.name}" references unknown tool/skill: ${tool}`,
          resolution: `Add to skills or use a known tool name`,
        });
      }
    }
  }

  // 3. Skill → Command references
  const commandNames = new Set((ir.commands ?? []).map((c) => c.name));
  for (const skill of ir.skills) {
    const refs = extractCommandRefs(skill.procedure);
    for (const ref of refs) {
      if (!commandNames.has(ref)) {
        errors.push({
          file: blueprintFile,
          type: "UNKNOWN_COMMAND_REFERENCE",
          severity: "warning",
          message: `Skill "${skill.name}" references unknown command: ${ref}`,
          resolution: `Add command '${ref}' or remove reference`,
        });
      }
    }
  }

  return errors;
}

function extractSkillRefs(text: string): string[] {
  const matches = text.matchAll(/\[\[skill:([^\]]+)\]\]|@skill:([\w-]+)/g);
  return Array.from(matches).map((m) => (m[1] || m[2]) as string);
}

function extractCommandRefs(text: string): string[] {
  const matches = text.matchAll(/\[\[command:([^\]]+)\]\]|@command:([\w-]+)/g);
  return Array.from(matches).map((m) => (m[1] || m[2]) as string);
}
