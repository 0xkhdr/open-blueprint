/**
 * Canonical skill file format (Stage 3, GAP-3): markdown with YAML
 * frontmatter carrying the `SkillSchema` fields, body = procedure.
 *
 * Adapters, the `bp skill` scaffolder, and the pack materializer all render
 * and parse through these helpers so every producer emits the same shape and
 * no field can be silently dropped by a hand-rolled serializer.
 */

import matter from "gray-matter";
import yaml from "js-yaml";
import type { Skill } from "./ir.js";

/** Slug a skill name into a file-safe identifier (matches `irIdentifier`). */
export function slugifySkillName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

/** Stable identifier for a skill: explicit `id`, else slugified name. */
export function skillId(skill: Pick<Skill, "name" | "id">): string {
  return skill.id ?? slugifySkillName(skill.name);
}

export function skillFileName(skill: Pick<Skill, "name" | "id">): string {
  return `${skillId(skill)}.md`;
}

/**
 * Render a skill as canonical markdown. Every `SkillSchema` field present on
 * the skill lands in the frontmatter; the procedure becomes the body.
 * `extraFrontmatter` (provenance such as `pack_id` or `bp_source`) is
 * appended after the schema fields.
 */
export function renderSkillMarkdown(
  skill: Skill,
  extraFrontmatter?: Record<string, unknown>,
  bodyOverride?: string
): string {
  const frontmatter: Record<string, unknown> = {
    name: skill.name,
    description: skill.description,
    when_to_use: skill.when_to_use,
    tools_required: skill.tools_required,
  };
  if (skill.disable_model_invocation !== undefined) {
    frontmatter.disable_model_invocation = skill.disable_model_invocation;
  }
  if (skill.id !== undefined) frontmatter.id = skill.id;
  if (skill.risk !== undefined) frontmatter.risk = skill.risk;
  for (const [key, value] of Object.entries(extraFrontmatter ?? {})) {
    frontmatter[key] = value;
  }

  const fmYaml = yaml.dump(frontmatter, { lineWidth: 120, sortKeys: false }).trimEnd();
  const body = (bodyOverride ?? skill.procedure).trim();
  return `---\n${fmYaml}\n---\n\n${body}\n`;
}

/**
 * Parse a canonical skill file back into a `Skill`. Lenient by design (the
 * validator owns strictness): missing fields fall back to empty values so
 * adapters can ingest hand-written files, but every recognized field is
 * preserved verbatim.
 */
export function parseSkillMarkdown(content: string, fallbackName: string): Skill {
  const parsed: unknown = matter(content);
  // gray-matter memoizes on a plain object: inputs like "toString" hit
  // Object.prototype and come back as a function. Treat those as no-frontmatter.
  const result =
    parsed !== null && typeof parsed === "object"
      ? (parsed as { data?: unknown; content?: unknown })
      : {};
  const data = (
    typeof result.data === "object" && result.data !== null ? result.data : {}
  ) as Record<string, unknown>;
  const body = typeof result.content === "string" ? result.content : content;

  const skill: Skill = {
    name: typeof data.name === "string" ? data.name : fallbackName,
    description: typeof data.description === "string" ? data.description : "",
    when_to_use: typeof data.when_to_use === "string" ? data.when_to_use : "",
    tools_required: Array.isArray(data.tools_required) ? data.tools_required.map(String) : [],
    procedure: body.trim(),
  };
  if (typeof data.disable_model_invocation === "boolean") {
    skill.disable_model_invocation = data.disable_model_invocation;
  }
  if (typeof data.id === "string") skill.id = data.id;
  if (data.risk === "low" || data.risk === "medium" || data.risk === "high") {
    skill.risk = data.risk;
  }
  return skill;
}
