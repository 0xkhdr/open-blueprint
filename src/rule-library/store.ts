/**
 * Pack store — resolves and loads rule packs from any of three sources, in
 * order (spec §3 of Stage 2):
 *
 *   1. Path refs (contain a path separator or end in a pack extension)
 *   2. Project packs (`.bp/packs/*.bp-pack.{yaml,yml,json}`) matched by id
 *   3. Built-ins (`BUILT_IN_PACKS`)
 *
 * All external data passes through `RulePackSchema` before it enters the
 * system; schema violations fail loud with `PACK_INVALID` listing every Zod
 * issue path.
 */

import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";
import yaml from "js-yaml";
import type { ZodError } from "zod";
import { BpError } from "../errors.js";
import { BUILT_IN_PACKS } from "./packs.js";
import {
  PACK_FILE_EXTENSIONS,
  PROJECT_PACKS_DIR,
  type RulePack,
  RulePackSchema,
} from "./schema.js";

export type PackSource = "built-in" | "project" | "path";

export interface LoadedPack {
  pack: RulePack;
  source: PackSource;
  /** Absolute path of the pack file, when loaded from disk. */
  path?: string;
}

export function isPackFile(ref: string): boolean {
  return PACK_FILE_EXTENSIONS.some((ext) => ref.endsWith(ext));
}

/** Whether a ref should be treated as a file path rather than a pack id. */
export function isPathRef(ref: string): boolean {
  return ref.includes("/") || ref.includes(path.sep) || isPackFile(ref);
}

function formatZodIssues(error: ZodError): string {
  return error.issues
    .map(
      (issue) => `  - ${issue.path.length > 0 ? issue.path.join(".") : "(root)"}: ${issue.message}`
    )
    .join("\n");
}

function parsePackDocument(raw: string, filePath: string): unknown {
  try {
    if (filePath.endsWith(".json")) return JSON.parse(raw);
    return yaml.load(raw, { filename: filePath });
  } catch (err) {
    const mark =
      err instanceof yaml.YAMLException && err.mark ? ` (line ${err.mark.line + 1})` : "";
    throw new BpError(
      `PACK_INVALID: failed to parse ${filePath}${mark}: ${err instanceof Error ? err.message : String(err)}`,
      1,
      "PACK_INVALID",
      "Fix the YAML/JSON syntax of the pack file"
    );
  }
}

/** Reject packs with duplicate rule ids (`PACK_DUPLICATE_RULE`). */
export function assertUniqueRuleIds(pack: RulePack, origin: string): void {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const rule of pack.rules) {
    if (seen.has(rule.id)) duplicates.add(rule.id);
    seen.add(rule.id);
  }
  if (duplicates.size > 0) {
    throw new BpError(
      `PACK_DUPLICATE_RULE: pack '${pack.id}' (${origin}) declares duplicate rule ids: ${[...duplicates].join(", ")}`,
      1,
      "PACK_DUPLICATE_RULE",
      "Give every rule in the pack a unique id"
    );
  }
}

/** Reject local packs whose id collides with a built-in (`PACK_ID_COLLISION`). */
export function assertNoBuiltinCollision(pack: RulePack): void {
  if (BUILT_IN_PACKS.some((p) => p.id === pack.id)) {
    throw new BpError(
      `PACK_ID_COLLISION: pack id '${pack.id}' collides with a built-in pack`,
      1,
      "PACK_ID_COLLISION",
      "Rename the pack id, or pass --force to shadow the built-in"
    );
  }
}

/** Validate raw pack data through Zod, failing loud with every issue path. */
export function validatePackData(data: unknown, origin: string): RulePack {
  const result = RulePackSchema.safeParse(data);
  if (!result.success) {
    throw new BpError(
      `PACK_INVALID: ${origin} does not conform to the bp-pack/1 schema:\n${formatZodIssues(result.error)}`,
      1,
      "PACK_INVALID",
      "Fix the listed fields; see docs/rule-packs.md for the format reference"
    );
  }
  assertUniqueRuleIds(result.data, origin);
  return result.data;
}

/** Load and fully validate a pack file (YAML or JSON). */
export async function loadPackFromFile(filePath: string): Promise<LoadedPack> {
  const absolute = path.resolve(filePath);
  let raw: string;
  try {
    raw = await fsPromises.readFile(absolute, "utf-8");
  } catch {
    throw new BpError(
      `PACK_NOT_FOUND: cannot read pack file: ${filePath}`,
      1,
      "PACK_NOT_FOUND",
      "Check the path; pack files must end in .bp-pack.yaml, .bp-pack.yml, or .bp-pack.json"
    );
  }
  const data = parsePackDocument(raw, absolute);
  const pack = validatePackData(data, absolute);
  return { pack, source: "path", path: absolute };
}

/** Absolute paths of all pack files in the project packs dir, sorted. */
export async function listProjectPackFiles(projectRoot: string): Promise<string[]> {
  const files = await fg(
    PACK_FILE_EXTENSIONS.map((ext) => `${PROJECT_PACKS_DIR}/*${ext}`),
    { cwd: projectRoot, onlyFiles: true, dot: true, absolute: true }
  );
  return files.sort();
}

/**
 * Load every valid project pack. Invalid files are returned separately so
 * listings can surface them without aborting.
 */
export async function loadProjectPacks(
  projectRoot: string
): Promise<{ packs: LoadedPack[]; failures: Array<{ path: string; message: string }> }> {
  const packs: LoadedPack[] = [];
  const failures: Array<{ path: string; message: string }> = [];
  for (const file of await listProjectPackFiles(projectRoot)) {
    try {
      const loaded = await loadPackFromFile(file);
      packs.push({ ...loaded, source: "project" });
    } catch (err) {
      failures.push({ path: file, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return { packs, failures };
}

/**
 * Resolve a pack reference: path ref → project pack id → built-in id.
 * Returns undefined when nothing matches (callers decide how to report).
 */
export async function resolvePack(
  ref: string,
  projectRoot: string
): Promise<LoadedPack | undefined> {
  if (isPathRef(ref)) {
    return loadPackFromFile(path.resolve(projectRoot, ref));
  }

  const { packs } = await loadProjectPacks(projectRoot);
  const projectMatch = packs.find((p) => p.pack.id === ref);
  if (projectMatch) return projectMatch;

  const builtIn = BUILT_IN_PACKS.find((p) => p.id === ref);
  if (builtIn) {
    // Built-ins are TS constants, but they cross the same validation gate so
    // a drifting constant can never bypass the schema.
    return { pack: validatePackData(builtIn, `built-in pack '${ref}'`), source: "built-in" };
  }

  return undefined;
}
