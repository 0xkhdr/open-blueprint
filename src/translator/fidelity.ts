/**
 * Skill translation fidelity (Stage 3, spec §6).
 *
 * `roundTripSkill` proves a skill survives a backend's render→parse cycle by
 * actually running it in a throwaway directory, then diffing every
 * `SkillSchema` field. Any loss surfaces as an explicit warning — silent
 * drops are impossible because the comparison enumerates the schema fields,
 * not whatever the adapter happened to emit (fail-loud pillar).
 */

import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getAdapter } from "./index.js";
import type { BlueprintIR, Skill } from "./ir.js";
import { skillId } from "./skill-file.js";

export interface FidelityWarning {
  backend: string;
  skill: string;
  field: string;
  message: string;
}

/** SkillSchema fields a backend must carry for a lossless round-trip. */
const SKILL_FIELDS: Array<keyof Skill> = [
  "name",
  "description",
  "when_to_use",
  "tools_required",
  "procedure",
  "disable_model_invocation",
  "id",
  "risk",
];

function fieldEquals(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((v, i) => v === b[i]);
  }
  if (typeof a === "string" && typeof b === "string") {
    return a.trim() === b.trim();
  }
  return a === b;
}

/**
 * Diff two skills field by field. `original` is the source of truth; every
 * field it carries must come back identical (procedure compared
 * whitespace-trimmed, since the body is markdown).
 */
export function compareSkillFidelity(
  original: Skill,
  parsed: Skill | undefined,
  backend: string
): FidelityWarning[] {
  if (!parsed) {
    return [
      {
        backend,
        skill: original.name,
        field: "(skill)",
        message: `skill '${original.name}' was not found after rendering to '${backend}' — the backend dropped it entirely`,
      },
    ];
  }

  const warnings: FidelityWarning[] = [];
  for (const field of SKILL_FIELDS) {
    const before = original[field];
    if (before === undefined) continue;
    const after = parsed[field];
    if (after === undefined) {
      warnings.push({
        backend,
        skill: original.name,
        field,
        message: `field '${field}' was dropped by the '${backend}' backend`,
      });
    } else if (!fieldEquals(before, after)) {
      warnings.push({
        backend,
        skill: original.name,
        field,
        message: `field '${field}' changed in translation to '${backend}': ${JSON.stringify(before)} → ${JSON.stringify(after)}`,
      });
    }
  }
  return warnings;
}

export interface RoundTripResult {
  /** The skill as the backend parses it back; undefined when dropped. */
  skill?: Skill;
  warnings: FidelityWarning[];
  /** Files the backend rendered, relative to the scratch root. */
  renderedFiles: string[];
}

function minimalIR(skill: Skill, backend: string): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "bp-skill-test",
      surface: "",
      temporal_anchor: "development",
      conventions: [],
    },
    personas: [],
    rules: [],
    skills: [skill],
    hooks: [],
    meta: {
      rule_precedence: [],
      conflict_resolution: "precedence-based",
      source_backend: "ir",
      target_backend: backend,
    },
  };
}

/**
 * Render the skill through the backend adapter into a scratch directory,
 * parse it back, and report every fidelity loss.
 */
export async function roundTripSkill(skill: Skill, backend: string): Promise<RoundTripResult> {
  const adapter = await getAdapter(backend);
  const scratch = await fsPromises.mkdtemp(path.join(os.tmpdir(), "bp-skill-roundtrip-"));
  try {
    const written = await adapter.render(minimalIR(skill, backend), scratch);
    const parsedIR = await adapter.parse(scratch);
    const wanted = skillId(skill);
    const parsed = parsedIR.skills.find(
      (s) => skillId(s) === wanted || s.name === skill.name || s.id === skill.id
    );
    return {
      ...(parsed !== undefined ? { skill: parsed } : {}),
      warnings: compareSkillFidelity(skill, parsed, backend),
      renderedFiles: written.map((f) => path.relative(scratch, f)),
    };
  } finally {
    await fsPromises.rm(scratch, { recursive: true, force: true });
  }
}
