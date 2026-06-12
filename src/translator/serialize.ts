/**
 * Canonical IR -> file serialization (round-trip emit).
 *
 * The templater can only render bundled Handlebars packs; it cannot write back
 * arbitrary IR entries that were parsed from disk or produced by a merge. This
 * module closes that gap: it serializes a {@link BlueprintIR}'s rules and skills
 * to deterministic Markdown and writes them through the manifest-aware writer,
 * so emitted files participate in marker preservation, `.blueprintignore`, path
 * safety, and ownership tracking — unlike the adapters' raw `render`.
 *
 * Serialization is the inverse of `MarkdownAdapter.parse`, so
 * parse -> emit -> parse is stable for the tracked IR fields.
 */

import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import matter from "gray-matter";
import {
  createEmptyManifest,
  loadManifest,
  type Manifest,
  recordFile,
  saveManifest,
  toManifestKey,
} from "../templater/manifest.js";
import type { BackendManifest } from "../templater/selector.js";
import type { WriteResult } from "../templater/writer.js";
import { writeFile } from "../templater/writer.js";
import type { BlueprintIR, Rule, Skill } from "./ir.js";

const BP_VERSION = "1.0.0";

/**
 * Convert an arbitrary string into a filesystem-safe slug. Prevents path
 * traversal and collapses unsafe characters; the writer also enforces path
 * containment as defense in depth.
 */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "untitled";
}

/**
 * Serialize a rule to Markdown. The frontmatter is the source of truth that
 * `parse` reads back; the body is human-readable documentation.
 */
export function serializeRule(rule: Rule): string {
  const data: Record<string, unknown> = {
    id: rule.id,
    scope: rule.scope,
    severity: rule.severity,
    action: rule.action,
  };
  if (rule.rationale !== undefined) data.rationale = rule.rationale;
  if (rule.tags !== undefined) data.tags = rule.tags;

  let body = `# Rule: ${rule.id}\n\n${rule.action}\n`;
  if (rule.rationale) body += `\n**Rationale:** ${rule.rationale}\n`;

  return matter.stringify(body, data);
}

/**
 * Serialize a skill to Markdown. `procedure` is emitted as the body because
 * `parse` reconstructs it from the body, keeping round-trips lossless.
 */
export function serializeSkill(skill: Skill): string {
  const data: Record<string, unknown> = {
    name: skill.name,
    description: skill.description,
    when_to_use: skill.when_to_use,
  };
  if (skill.tools_required.length > 0) data.tools_required = skill.tools_required;
  if (skill.disable_model_invocation !== undefined) {
    data.disable_model_invocation = skill.disable_model_invocation;
  }

  return matter.stringify(`${skill.procedure}\n`, data);
}

/** Derive the output directory and file extension from a backend glob pattern. */
export function patternToDir(pattern: string): { dir: string; ext: string } {
  const dir = path.dirname(pattern);
  const base = path.basename(pattern);
  const star = base.indexOf("*");
  const ext = star >= 0 ? base.slice(star + 1) : path.extname(base) || ".md";
  return { dir, ext };
}

export interface EmitOptions {
  dryRun?: boolean;
  force?: boolean;
}

export interface EmitResult {
  files: WriteResult[];
}

/**
 * Emit an IR's rules and skills to disk at the backend's canonical locations,
 * writing through the manifest-aware writer and recording ownership.
 */
export async function emitBlueprintFiles(
  ir: BlueprintIR,
  projectRoot: string,
  manifest: BackendManifest,
  options: EmitOptions = {}
): Promise<EmitResult> {
  const { dryRun = false, force = false } = options;
  const results: WriteResult[] = [];

  const rulesTarget = patternToDir(manifest.file_patterns.rules);
  const skillsTarget = patternToDir(manifest.file_patterns.skills);

  const written: Array<{ outputPath: string }> = [];

  for (const rule of ir.rules) {
    const outputPath = path.join(
      projectRoot,
      rulesTarget.dir,
      `${slugify(rule.id)}${rulesTarget.ext}`
    );
    const result = await writeFile(outputPath, serializeRule(rule), { dryRun, force, projectRoot });
    results.push(result);
    if (result.action !== "skipped") written.push({ outputPath });
  }

  for (const skill of ir.skills) {
    const outputPath = path.join(
      projectRoot,
      skillsTarget.dir,
      `${slugify(skill.name)}${skillsTarget.ext}`
    );
    const result = await writeFile(outputPath, serializeSkill(skill), {
      dryRun,
      force,
      projectRoot,
    });
    results.push(result);
    if (result.action !== "skipped") written.push({ outputPath });
  }

  // Record ownership of everything we emitted, hashing the bytes actually on
  // disk so the manifest stays an accurate record even when the writer merged
  // into pre-existing user markers.
  if (!dryRun && written.length > 0) {
    const ownership: Manifest =
      (await loadManifest(projectRoot)) ?? createEmptyManifest(BP_VERSION);
    ownership.bp_version = BP_VERSION;
    for (const { outputPath } of written) {
      let content: string;
      try {
        content = await fsPromises.readFile(outputPath, "utf-8");
      } catch {
        continue;
      }
      recordFile(ownership, toManifestKey(projectRoot, outputPath), content, "generated", null);
    }
    await saveManifest(projectRoot, ownership);
  }

  return { files: results };
}
