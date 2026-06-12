/**
 * Report snapshot — staleness baseline for manual rules (Stage 6 §4).
 *
 * `bp report --snapshot` records, for every manual rule, a normalized hash of
 * the rule text plus content hashes of its scope-matched files. A later
 * `bp report` compares the repo against that baseline: a manual rule whose
 * text did not change while a significant share of its scoped files did is
 * flagged `RULE_MANUAL_STALE` (info-level — the control may no longer match
 * the code it governs). No snapshot ⇒ the check is silently skipped.
 */

import * as crypto from "node:crypto";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";
import { normalizeText } from "../utils/normalize.js";
import type { RuleOutcome } from "../validator/enforcement.js";
import {
  REPORT_SNAPSHOT_FILE,
  type ReportSnapshot,
  ReportSnapshotSchema,
  SNAPSHOT_SCHEMA_VERSION,
  type SnapshotManualRule,
} from "./model.js";

/** Cap on scope-matched files hashed per rule — keeps snapshots bounded. */
export const MAX_SNAPSHOT_FILES_PER_RULE = 500;

/** Fraction of a rule's scoped files that must change to call it stale. */
export const STALE_CHANGE_RATIO = 0.25;

const GLOB_IGNORE = ["**/node_modules/**", "**/dist/**", "**/.git/**", "**/.bp/**"];

function sha256(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/** Normalized-prose hash so whitespace/case-only edits don't reset staleness. */
export function ruleProseHash(content: string): string {
  return sha256(normalizeText(content));
}

async function hashScopeFiles(projectRoot: string, scope: string): Promise<Record<string, string>> {
  const files = await fg(scope, {
    cwd: projectRoot,
    onlyFiles: true,
    dot: true,
    ignore: GLOB_IGNORE,
  });
  const hashes: Record<string, string> = {};
  for (const file of files.sort().slice(0, MAX_SNAPSHOT_FILES_PER_RULE)) {
    try {
      const content = await fsPromises.readFile(path.join(projectRoot, file), "utf-8");
      hashes[file] = sha256(content);
    } catch {
      // unreadable scoped files simply drop out of the baseline
    }
  }
  return hashes;
}

/** Build a snapshot from the manual rules among the enforcement outcomes. */
export async function buildSnapshot(
  projectRoot: string,
  outcomes: RuleOutcome[]
): Promise<ReportSnapshot> {
  const manualRules: Record<string, SnapshotManualRule> = {};
  for (const outcome of outcomes) {
    if (outcome.status !== "manual" || !outcome.scope) continue;
    let ruleContent: string;
    try {
      ruleContent = await fsPromises.readFile(outcome.file, "utf-8");
    } catch {
      continue;
    }
    manualRules[outcome.id] = {
      rule_hash: ruleProseHash(ruleContent),
      scope: outcome.scope,
      scope_files: await hashScopeFiles(projectRoot, outcome.scope),
    };
  }
  return {
    schema: SNAPSHOT_SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    manual_rules: manualRules,
  };
}

export async function saveSnapshot(projectRoot: string, snapshot: ReportSnapshot): Promise<void> {
  const file = path.join(projectRoot, REPORT_SNAPSHOT_FILE);
  await fsPromises.mkdir(path.dirname(file), { recursive: true });
  await fsPromises.writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`, "utf-8");
}

/** Load and validate the snapshot; `null` when absent or invalid. */
export async function loadSnapshot(projectRoot: string): Promise<ReportSnapshot | null> {
  let raw: string;
  try {
    raw = await fsPromises.readFile(path.join(projectRoot, REPORT_SNAPSHOT_FILE), "utf-8");
  } catch {
    return null;
  }
  try {
    return ReportSnapshotSchema.parse(JSON.parse(raw));
  } catch {
    return null; // a corrupt snapshot must never break reporting
  }
}

/** Pure set-difference comparator — exported for unit tests. */
export function scopeChangeRatio(
  baseline: Record<string, string>,
  current: Record<string, string>
): number {
  const baselineFiles = Object.keys(baseline);
  if (baselineFiles.length === 0) return 0;
  let changed = 0;
  for (const file of baselineFiles) {
    if (current[file] !== baseline[file]) changed++; // modified or removed
  }
  for (const file of Object.keys(current)) {
    if (!(file in baseline)) changed++; // added
  }
  return changed / baselineFiles.length;
}

/**
 * Rule ids whose manual rule text is unchanged since the snapshot while
 * ≥ STALE_CHANGE_RATIO of its scoped files changed (added/removed/modified).
 */
export async function findStaleManualRules(
  projectRoot: string,
  snapshot: ReportSnapshot,
  outcomes: RuleOutcome[]
): Promise<Set<string>> {
  const stale = new Set<string>();
  for (const outcome of outcomes) {
    if (outcome.status !== "manual" || !outcome.scope) continue;
    const baseline = snapshot.manual_rules[outcome.id];
    if (!baseline) continue;
    let ruleContent: string;
    try {
      ruleContent = await fsPromises.readFile(outcome.file, "utf-8");
    } catch {
      continue;
    }
    if (ruleProseHash(ruleContent) !== baseline.rule_hash) continue; // rule was maintained
    const current = await hashScopeFiles(projectRoot, baseline.scope);
    if (scopeChangeRatio(baseline.scope_files, current) >= STALE_CHANGE_RATIO) {
      stale.add(outcome.id);
    }
  }
  return stale;
}
