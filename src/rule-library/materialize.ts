/**
 * Pack materialization — turns validated pack rules into backend rule files
 * (e.g. `.claude/rules/pack-<packId>-<ruleId>.md`) and records the install in
 * `.bp/packs.lock.json`.
 *
 * Generated files carry provenance frontmatter (`pack_id`, `pack_version`) and
 * bp-generated block markers, so re-installs are idempotent, `bp:preserve`
 * regions survive, and `bp verify` governs them exactly like scaffolded rules.
 */

import * as crypto from "node:crypto";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import matter from "gray-matter";
import yaml from "js-yaml";
import { BpError } from "../errors.js";
import { wrapBlock } from "../templater/merger.js";
import type { BackendManifest } from "../templater/selector.js";
import { writeFile } from "../templater/writer.js";
import type { Rule } from "../translator/ir.js";
import { patternToDir } from "../translator/serialize.js";
import { validateSemantic } from "../validator/semantic.js";
import type { ValidationError } from "../validator/structural.js";
import {
  createEmptyPackLock,
  PACK_LOCK_FILE,
  type PackLock,
  type PackLockEntry,
  PackLockSchema,
  type RulePack,
} from "./schema.js";
import type { LoadedPack } from "./store.js";

// ---------------------------------------------------------------------------
// Hashing
// ---------------------------------------------------------------------------

const PRESERVE_SEGMENT = /<!--\s*bp:preserve\s*-->[\s\S]*?<!--\s*bp:end-preserve\s*-->/g;

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/**
 * Hash of the governed portion of a generated file: preserve blocks are the
 * user's territory and never count as tampering.
 */
export function governedContentHash(content: string): string {
  return sha256(content.replace(PRESERVE_SEGMENT, "").trim());
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value as Record<string, unknown>).sort()) {
      out[key] = canonicalize((value as Record<string, unknown>)[key]);
    }
    return out;
  }
  return value;
}

/** sha256 of the canonical (key-sorted) JSON of a pack. Stage 6 drift anchor. */
export function canonicalPackHash(pack: RulePack): string {
  return sha256(JSON.stringify(canonicalize(pack)));
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export function packRuleFileName(packId: string, ruleId: string): string {
  return `pack-${packId}-${ruleId}.md`;
}

/** Render one pack rule as a backend rule file with provenance frontmatter. */
export function renderRuleFile(pack: RulePack, rule: Rule): string {
  const frontmatter: Record<string, unknown> = {
    id: rule.id,
    scope: rule.scope,
    severity: rule.severity,
    action: rule.action,
  };
  if (rule.rationale !== undefined) frontmatter.rationale = rule.rationale;
  if (rule.tags !== undefined) frontmatter.tags = rule.tags;
  if (rule.check !== undefined) frontmatter.check = rule.check;
  if (rule.enforcement !== undefined) frontmatter.enforcement = rule.enforcement;
  frontmatter.pack_id = pack.id;
  frontmatter.pack_version = pack.version;

  const fmYaml = yaml.dump(frontmatter, { lineWidth: 120, sortKeys: false }).trimEnd();

  const bodyLines = [`# ${rule.id}`, "", `**Action**: ${rule.action}`];
  if (rule.rationale) bodyLines.push("", `**Rationale**: ${rule.rationale}`);
  bodyLines.push("", `_Installed from pack \`${pack.id}\` v${pack.version}._`);

  const body = wrapBlock(`pack-${pack.id}-${rule.id}`, bodyLines.join("\n"));
  return `---\n${fmYaml}\n---\n\n${body}\n`;
}

// ---------------------------------------------------------------------------
// Lockfile IO
// ---------------------------------------------------------------------------

export async function loadPackLock(projectRoot: string): Promise<PackLock> {
  const lockPath = path.join(projectRoot, PACK_LOCK_FILE);
  let raw: string;
  try {
    raw = await fsPromises.readFile(lockPath, "utf-8");
  } catch {
    return createEmptyPackLock();
  }
  try {
    return PackLockSchema.parse(JSON.parse(raw));
  } catch (err) {
    throw new BpError(
      `PACK_LOCK_INVALID: ${PACK_LOCK_FILE} is corrupted: ${err instanceof Error ? err.message : String(err)}`,
      1,
      "PACK_LOCK_INVALID",
      `Fix or delete ${PACK_LOCK_FILE} and re-install your packs`
    );
  }
}

export async function savePackLock(projectRoot: string, lock: PackLock): Promise<void> {
  const lockPath = path.join(projectRoot, PACK_LOCK_FILE);
  await fsPromises.mkdir(path.dirname(lockPath), { recursive: true });
  await fsPromises.writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, "utf-8");
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export interface MaterializeOptions {
  projectRoot: string;
  manifest: BackendManifest;
  /** Replace this pack's own generated files; never touches foreign files. */
  force?: boolean;
  dryRun?: boolean;
}

export interface MaterializeResult {
  /** Project-relative paths written (created or updated) this run. */
  written: string[];
  /** Existing files left untouched (merge-by-rule-id default). */
  skipped: string[];
  /** Files that belong to another pack or are hand-written; never touched. */
  conflicts: string[];
  /** Semantic findings for the written files (scope glob sanity etc.). */
  semantic: ValidationError[];
  lockEntry?: PackLockEntry;
}

function toPosix(rel: string): string {
  return rel.split(path.sep).join("/");
}

async function readIfExists(filePath: string): Promise<string | null> {
  try {
    return await fsPromises.readFile(filePath, "utf-8");
  } catch {
    return null;
  }
}

/** Whether an existing rule file was generated from the given pack. */
function isOwnedByPack(content: string, packId: string): boolean {
  try {
    return matter(content).data?.pack_id === packId;
  } catch {
    return false;
  }
}

export async function installPackToProject(
  loaded: LoadedPack,
  options: MaterializeOptions
): Promise<MaterializeResult> {
  const { projectRoot, manifest, force = false, dryRun = false } = options;
  const { pack } = loaded;

  if (!manifest.supported_features.rules || !manifest.file_patterns.rules) {
    throw new BpError(
      `PACK_UNSUPPORTED_BACKEND: backend '${manifest.backend}' does not support rule files`,
      1,
      "PACK_UNSUPPORTED_BACKEND",
      "Install the pack against a backend with rule file support"
    );
  }

  const { dir: rulesDir } = patternToDir(manifest.file_patterns.rules);
  const result: MaterializeResult = { written: [], skipped: [], conflicts: [], semantic: [] };
  const writtenAbsolute: string[] = [];

  for (const rule of pack.rules) {
    const relPath = toPosix(path.join(rulesDir, packRuleFileName(pack.id, rule.id)));
    const absPath = path.join(projectRoot, relPath);
    const existing = await readIfExists(absPath);

    if (existing !== null) {
      if (!force) {
        // Default merge-by-rule-id: existing files (any origin) are kept.
        result.skipped.push(relPath);
        continue;
      }
      if (!isOwnedByPack(existing, pack.id)) {
        // --force only replaces this pack's own files, never foreign content.
        result.conflicts.push(relPath);
        continue;
      }
    }

    const content = renderRuleFile(pack, rule);
    const writeResult = await writeFile(
      absPath,
      content,
      { projectRoot, dryRun, force: existing !== null },
      existing !== null ? "overwrite" : "skip"
    );

    if (writeResult.action === "skipped" && existing !== null) {
      // Byte-identical content — still ours, still tracked.
      result.skipped.push(relPath);
    } else {
      result.written.push(relPath);
      writtenAbsolute.push(absPath);
    }
  }

  if (!dryRun) {
    // Record every file on disk that belongs to this pack (written or kept).
    const files: Record<string, string> = {};
    for (const rule of pack.rules) {
      const relPath = toPosix(path.join(rulesDir, packRuleFileName(pack.id, rule.id)));
      const content = await readIfExists(path.join(projectRoot, relPath));
      if (content !== null && isOwnedByPack(content, pack.id)) {
        files[relPath] = governedContentHash(content);
      }
    }

    const lockEntry: PackLockEntry = {
      id: pack.id,
      version: pack.version,
      source: loaded.source === "path" ? (loaded.path ?? "path") : loaded.source,
      rules_count: pack.rules.length,
      installed_at: new Date().toISOString(),
      content_hash: canonicalPackHash(pack),
      files,
    };

    const lock = await loadPackLock(projectRoot);
    lock.installed = [...lock.installed.filter((e) => e.id !== pack.id), lockEntry];
    await savePackLock(projectRoot, lock);
    result.lockEntry = lockEntry;

    if (writtenAbsolute.length > 0) {
      result.semantic = await validateSemantic(writtenAbsolute, { projectRoot, manifest });
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Remove
// ---------------------------------------------------------------------------

export interface RemoveOptions {
  projectRoot: string;
  /** Delete even when generated files were hand-edited outside preserve blocks. */
  force?: boolean;
}

export interface RemoveResult {
  removed: string[];
  /** Tracked files already gone from disk. */
  missing: string[];
}

export async function removePack(packId: string, options: RemoveOptions): Promise<RemoveResult> {
  const { projectRoot, force = false } = options;
  const lock = await loadPackLock(projectRoot);
  const entry = lock.installed.find((e) => e.id === packId);
  if (!entry) {
    throw new BpError(
      `PACK_NOT_INSTALLED: pack '${packId}' is not in ${PACK_LOCK_FILE}`,
      1,
      "PACK_NOT_INSTALLED",
      "Run 'bp rule pack:list' to see installed packs"
    );
  }

  const states = await Promise.all(
    Object.entries(entry.files).map(async ([relPath, hash]) => {
      const content = await readIfExists(path.join(projectRoot, relPath));
      return { relPath, hash, content };
    })
  );

  const modified = states.filter(
    (s) => s.content !== null && governedContentHash(s.content) !== s.hash
  );
  if (modified.length > 0 && !force) {
    throw new BpError(
      `PACK_FILE_MODIFIED: refusing to remove pack '${packId}' — files were edited outside preserve blocks:\n${modified.map((m) => `  - ${m.relPath}`).join("\n")}`,
      1,
      "PACK_FILE_MODIFIED",
      "Review the edits (move them into a <!-- bp:preserve --> block or a hand-written rule), or pass --force to delete anyway"
    );
  }

  const result: RemoveResult = { removed: [], missing: [] };
  for (const state of states) {
    if (state.content === null) {
      result.missing.push(state.relPath);
      continue;
    }
    await fsPromises.unlink(path.join(projectRoot, state.relPath));
    result.removed.push(state.relPath);
  }

  lock.installed = lock.installed.filter((e) => e.id !== packId);
  await savePackLock(projectRoot, lock);
  return result;
}
