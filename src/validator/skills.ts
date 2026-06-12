/**
 * Skill validation layer (Stage 3, spec §2).
 *
 * Validates client-authored skill files — scaffolded, pack-installed, or
 * hand-written — against the canonical skill contract: SkillSchema
 * frontmatter, unique names, known tools (per the backend capability list),
 * an actionable procedure, a meaningful trigger, and live file references.
 *
 * Runs inside the `semantic` level of `bp verify` (on by default) and backs
 * `bp skill lint`.
 */

import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { z } from "zod";
import type { BackendManifest } from "../templater/selector.js";
import { irIdentifier, SkillSchema } from "../translator/ir.js";
import { skillId, slugifySkillName } from "../translator/skill-file.js";
import { isMcpToolRef, toCanonical } from "../translator/tools.js";
import type { ValidationError } from "./structural.js";

/**
 * Frontmatter contract for skill files: SkillSchema minus `procedure` (the
 * body is the procedure), with a slug-safe `name`. Unknown keys (provenance
 * such as `pack_id`, `bp_source`) are allowed and ignored.
 */
export const SkillFrontmatterSchema = SkillSchema.omit({ procedure: true }).extend({
  name: irIdentifier,
});

interface ParsedSkillFile {
  file: string;
  data: Record<string, unknown>;
  body: string;
  raw: string;
}

/** Line number (1-based) of a top-level frontmatter key, for error locations. */
function frontmatterKeyLine(raw: string, key: string): number | undefined {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return undefined;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i] ?? "";
    if (line.trim() === "---") break;
    if (new RegExp(`^${key}\\s*:`).test(line)) return i + 1;
  }
  return undefined;
}

function formatZodIssue(issue: z.ZodError["issues"][number]): string {
  const at = issue.path.length > 0 ? issue.path.join(".") : "(root)";
  return `${at}: ${issue.message}`;
}

// ---------------------------------------------------------------------------
// Per-file checks
// ---------------------------------------------------------------------------

function checkSchema(parsed: ParsedSkillFile): ValidationError[] {
  const result = SkillFrontmatterSchema.safeParse(parsed.data);
  if (result.success) return [];
  return result.error.issues.map((issue) => {
    const key = typeof issue.path[0] === "string" ? issue.path[0] : undefined;
    const line = key ? frontmatterKeyLine(parsed.raw, key) : undefined;
    return {
      file: parsed.file,
      ...(line !== undefined ? { line } : {}),
      type: "SKILL_SCHEMA_INVALID",
      severity: "error" as const,
      message: `Skill frontmatter is invalid — ${formatZodIssue(issue)}`,
      resolution:
        "Fix the frontmatter to match the skill contract (see docs/skill-authoring.md): " +
        "name (slug), description, when_to_use, tools_required are required",
    };
  });
}

function checkTools(parsed: ParsedSkillFile, manifest: BackendManifest): ValidationError[] {
  const tools = parsed.data.tools_required;
  if (!Array.isArray(tools)) return [];

  const capabilities = manifest.tools;
  const declares = Array.isArray(capabilities) && capabilities.length > 0;
  const line = frontmatterKeyLine(parsed.raw, "tools_required");
  const errors: ValidationError[] = [];

  for (const entry of tools) {
    if (typeof entry !== "string") continue;
    const canonical = toCanonical(entry, manifest.backend);

    let problem: string | undefined;
    if (canonical === undefined) {
      problem = `"${entry}" is not in the canonical tool vocabulary or any backend alias map`;
    } else if (declares && !isMcpToolRef(canonical) && !capabilities.includes(canonical)) {
      problem = `"${entry}" (canonical: ${canonical}) is not supported by the '${manifest.backend}' backend`;
    }
    if (!problem) continue;

    errors.push({
      file: parsed.file,
      ...(line !== undefined ? { line } : {}),
      type: "SKILL_UNKNOWN_TOOL",
      severity: declares ? "error" : "info",
      message: `tools_required: ${problem}`,
      resolution: declares
        ? `Use one of the backend's canonical tools: ${capabilities.join(", ")} (or an mcp:<tool> reference)`
        : "Use the canonical tool vocabulary (see docs/skill-authoring.md) so capability checks can apply",
    });
  }
  return errors;
}

const NUMBERED_STEP = /^\s*\d+[.)]\s+\S/m;

function checkProcedure(parsed: ParsedSkillFile): ValidationError[] {
  // The procedure is the `## Procedure` section when present, otherwise the
  // section under the first heading, otherwise the whole body.
  const body = parsed.body;
  let section = body;
  const procedureHeading = body.match(/^##\s+procedure\s*$/im);
  if (procedureHeading && procedureHeading.index !== undefined) {
    const rest = body.slice(procedureHeading.index + procedureHeading[0].length);
    const nextHeading = rest.match(/^#{1,6}\s/m);
    section = nextHeading?.index !== undefined ? rest.slice(0, nextHeading.index) : rest;
  }

  if (NUMBERED_STEP.test(section)) return [];
  return [
    {
      file: parsed.file,
      type: "SKILL_NO_PROCEDURE",
      severity: "error",
      message: "Skill body has no procedure: expected a '## Procedure' section with numbered steps",
      resolution: "Add a '## Procedure' section with at least one numbered step (1. …)",
    },
  ];
}

function checkTrigger(parsed: ParsedSkillFile): ValidationError[] {
  const whenToUse = typeof parsed.data.when_to_use === "string" ? parsed.data.when_to_use : "";
  const description = typeof parsed.data.description === "string" ? parsed.data.description : "";
  const line = frontmatterKeyLine(parsed.raw, "when_to_use");

  const normalizedTrigger = whenToUse.trim().toLowerCase();
  let problem: string | undefined;
  if (normalizedTrigger.length === 0) {
    problem = "when_to_use is empty — the agent cannot decide when to invoke this skill";
  } else if (normalizedTrigger === description.trim().toLowerCase()) {
    problem = "when_to_use repeats the description verbatim instead of stating a trigger";
  }
  if (!problem) return [];

  return [
    {
      file: parsed.file,
      ...(line !== undefined ? { line } : {}),
      type: "SKILL_VAGUE_TRIGGER",
      severity: "warning",
      message: problem,
      resolution:
        "Describe the concrete situation that should trigger this skill (e.g. 'When a new endpoint lacks integration coverage')",
    },
  ];
}

/**
 * Conservative path heuristic: backticked tokens containing a slash, made of
 * plain path characters only (no glob/expansion syntax, no URLs), whose last
 * segment carries a file extension — `src/index.ts` is a path candidate,
 * `async/await` or `try/catch` are prose and must not be flagged.
 */
const BACKTICK_TOKEN = /`([^`\n]+)`/g;
const PATH_LIKE = /^[A-Za-z0-9_.][A-Za-z0-9_./-]*\/[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/;

export function extractPathCandidates(body: string): string[] {
  const candidates = new Set<string>();
  for (const match of body.matchAll(BACKTICK_TOKEN)) {
    const token = (match[1] ?? "").trim();
    if (PATH_LIKE.test(token) && !token.includes("//")) candidates.add(token);
  }
  return [...candidates];
}

async function checkStalePaths(
  parsed: ParsedSkillFile,
  projectRoot: string
): Promise<ValidationError[]> {
  const errors: ValidationError[] = [];
  for (const candidate of extractPathCandidates(parsed.body)) {
    try {
      await fsPromises.access(path.join(projectRoot, candidate));
    } catch {
      errors.push({
        file: parsed.file,
        type: "SKILL_STALE_PATH",
        severity: "warning",
        message: `Procedure references \`${candidate}\` which does not exist in the repository`,
        resolution: "Update the path (the file may have moved) or drop the stale reference",
      });
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Cross-file checks
// ---------------------------------------------------------------------------

function checkCollisions(parsedFiles: ParsedSkillFile[]): ValidationError[] {
  const seen = new Map<string, string>(); // identifier -> first file
  const errors: ValidationError[] = [];

  for (const parsed of parsedFiles) {
    const name = typeof parsed.data.name === "string" ? parsed.data.name : undefined;
    if (!name) continue;
    const id = skillId({
      name,
      ...(typeof parsed.data.id === "string" ? { id: parsed.data.id } : {}),
    });

    const keys = new Set([slugifySkillName(name), id]);
    for (const key of keys) {
      const firstFile = seen.get(key);
      if (firstFile && firstFile !== parsed.file) {
        errors.push({
          file: parsed.file,
          type: "SKILL_NAME_COLLISION",
          severity: "error",
          message: `Skill identifier '${key}' is already defined in ${firstFile}`,
          resolution: "Rename one of the skills (or give it a distinct 'id') so each is unique",
        });
        break; // one collision report per file is enough
      }
    }
    for (const key of keys) {
      if (!seen.has(key)) seen.set(key, parsed.file);
    }
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SkillValidatorOptions {
  projectRoot: string;
  manifest: BackendManifest;
}

/** Validate an explicit set of skill files (used by `bp skill lint`). */
export async function validateSkillFiles(
  files: string[],
  options: SkillValidatorOptions
): Promise<ValidationError[]> {
  const { projectRoot, manifest } = options;
  const errors: ValidationError[] = [];
  const parsedFiles: ParsedSkillFile[] = [];

  for (const file of [...files].sort()) {
    let raw: string;
    try {
      raw = await fsPromises.readFile(file, "utf-8");
    } catch {
      continue; // unreadable files are the structural layer's finding
    }
    let parsed: matter.GrayMatterFile<string>;
    try {
      parsed = matter(raw);
    } catch (err) {
      errors.push({
        file,
        type: "SKILL_SCHEMA_INVALID",
        severity: "error",
        message: `Skill frontmatter does not parse as YAML: ${err instanceof Error ? err.message : String(err)}`,
        resolution: "Fix the YAML syntax between the --- markers",
      });
      continue;
    }
    // gray-matter memoizes by raw content on a plain object: inputs like
    // "toString" hit Object.prototype and come back as a function, not a
    // parse result. Treat anything malformed as frontmatter-less.
    const data =
      parsed !== null &&
      typeof parsed === "object" &&
      typeof parsed.data === "object" &&
      parsed.data !== null
        ? (parsed.data as Record<string, unknown>)
        : {};
    const body =
      parsed !== null && typeof parsed === "object" && typeof parsed.content === "string"
        ? parsed.content
        : raw;
    parsedFiles.push({ file, data, body, raw });
  }

  for (const parsed of parsedFiles) {
    errors.push(...checkSchema(parsed));
    errors.push(...checkTools(parsed, manifest));
    errors.push(...checkProcedure(parsed));
    errors.push(...checkTrigger(parsed));
    errors.push(...(await checkStalePaths(parsed, projectRoot)));
  }
  errors.push(...checkCollisions(parsedFiles));

  return errors;
}

/**
 * Validate all skills the backend manifest governs
 * (`manifest.file_patterns.skills`). Entry point for `bp verify`.
 */
export async function validateSkills(
  projectRoot: string,
  manifest: BackendManifest
): Promise<ValidationError[]> {
  const pattern = manifest.file_patterns.skills;
  if (!manifest.supported_features.skills || !pattern) return [];

  const files = await fg(pattern, {
    cwd: projectRoot,
    onlyFiles: true,
    dot: true,
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**"],
  });
  return validateSkillFiles(files, { projectRoot, manifest });
}
