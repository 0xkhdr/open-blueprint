/**
 * Governance report builder (Stage 6, GAP-6).
 *
 * `buildGovernanceReport` is a pure composition of already-measured inputs,
 * so unit tests can drive it with synthetic data. `collectReportInputs`
 * gathers those inputs from the repo: enforcement outcomes (Stage 1), pack
 * lockfile + integrity (Stage 2/5), skills inventory (Stage 3) and the
 * staleness snapshot — each best-effort, so the report degrades gracefully
 * when a stage's data is absent.
 */

import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { Fingerprint } from "../detector/fingerprint.js";
import { resolvePack } from "../packs/store.js";
import type { BackendManifest } from "../templater/selector.js";
import type { RuleOutcome } from "../validator/enforcement.js";
import { validateEnforcementDetailed } from "../validator/enforcement.js";
import type { PackIntegrityStatus } from "../validator/pack-integrity.js";
import { auditPackIntegrity } from "../validator/pack-integrity.js";
import { validateSkillFiles } from "../validator/skills.js";
import {
  type GovernanceReport,
  REPORT_SCHEMA_VERSION,
  type ReportPack,
  type ReportRule,
  type ReportSkill,
} from "./model.js";
import { findStaleManualRules, loadSnapshot } from "./snapshot.js";

export interface ReportPackInput extends PackIntegrityStatus {
  framework?: string | undefined;
  declared_coverage?: number | undefined;
}

export interface ReportInputs {
  project: { name: string; root: string; backend: string };
  outcomes: RuleOutcome[];
  /** Installed packs with integrity status; empty/undefined when no lockfile. */
  packs?: ReportPackInput[] | undefined;
  /** Skills inventory (Stage 3); undefined when the backend has no skills. */
  skills?: ReportSkill[] | undefined;
  /** Manual rules flagged stale against the snapshot (Stage 6 §4). */
  staleRuleIds?: ReadonlySet<string> | undefined;
  /** Injectable clock for deterministic tests. */
  generatedAt?: string | undefined;
}

function toPosixRelative(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

export function buildGovernanceReport(inputs: ReportInputs): GovernanceReport {
  const { project, outcomes } = inputs;
  const packs = inputs.packs ?? [];
  const stale = inputs.staleRuleIds ?? new Set<string>();

  const rules: ReportRule[] = outcomes.map((outcome) => ({
    id: outcome.id,
    file: toPosixRelative(project.root, outcome.file),
    severity: outcome.severity,
    enforcement: outcome.enforcement,
    status: outcome.status,
    ...(outcome.pack ? { pack: outcome.pack } : {}),
    ...(outcome.detail !== undefined ? { detail: outcome.detail } : {}),
    ...(outcome.evidence && outcome.evidence.length > 0
      ? {
          evidence: outcome.evidence.map((e) => ({
            file: e.file.split(path.sep).join("/"),
            ...(e.line !== undefined ? { line: e.line } : {}),
          })),
        }
      : {}),
    ...(stale.has(outcome.id) ? { stale: true } : {}),
  }));

  const reportPacks: ReportPack[] = packs.map((pack) => {
    const packRules = rules.filter((r) => r.pack?.id === pack.id);
    const measured = {
      pass: packRules.filter((r) => r.status === "pass").length,
      // an invalid check enforces nothing — count it as failing the pack
      fail: packRules.filter((r) => r.status === "fail" || r.status === "invalid").length,
      manual: packRules.filter((r) => r.status === "manual").length,
    };
    return {
      id: pack.id,
      version: pack.version,
      ...(pack.framework !== undefined ? { framework: pack.framework } : {}),
      source: pack.source,
      ...(pack.trust !== undefined ? { trust: pack.trust } : {}),
      measured,
      ...(pack.declared_coverage !== undefined
        ? { declared_coverage: pack.declared_coverage }
        : {}),
      ...(pack.outdated ? { outdated: true } : {}),
      integrity: pack.integrity,
    };
  });

  const summary = {
    rules_total: rules.length,
    rules_enforced: rules.filter((r) => r.enforcement === "auto").length,
    rules_manual: rules.filter((r) => r.enforcement === "manual").length,
    // invalid checks are hard failures: the rule claims enforcement it can't deliver
    violations_hard: rules.filter(
      (r) => r.status === "invalid" || (r.status === "fail" && r.severity === "hard")
    ).length,
    violations_soft: rules.filter((r) => r.status === "fail" && r.severity === "soft").length,
    ...(inputs.skills !== undefined ? { skills_total: inputs.skills.length } : {}),
    packs_installed: reportPacks.length,
    ...(reportPacks.some((p) => p.trust === "unsigned-accepted")
      ? { packs_unsigned: reportPacks.filter((p) => p.trust === "unsigned-accepted").length }
      : {}),
  };

  return {
    schema: REPORT_SCHEMA_VERSION,
    generated_at: inputs.generatedAt ?? new Date().toISOString(),
    project,
    summary,
    rules,
    packs: reportPacks,
    ...(inputs.skills !== undefined ? { skills: inputs.skills } : {}),
  };
}

// ---------------------------------------------------------------------------
// Input collection (best-effort per source — graceful degradation)
// ---------------------------------------------------------------------------

async function resolvePackExtras(
  packId: string,
  projectRoot: string
): Promise<{ framework?: string; declared_coverage?: number }> {
  try {
    const loaded = await resolvePack(packId, projectRoot);
    if (!loaded) return {};
    return {
      framework: loaded.pack.framework,
      ...(loaded.pack.metadata?.coverage !== undefined
        ? { declared_coverage: loaded.pack.metadata.coverage }
        : {}),
    };
  } catch {
    return {}; // unresolvable source (remote ref, deleted file) — degrade
  }
}

async function collectSkillsInventory(
  projectRoot: string,
  manifest: BackendManifest
): Promise<ReportSkill[] | undefined> {
  const pattern = manifest.file_patterns.skills;
  if (!manifest.supported_features.skills || !pattern) return undefined;

  let files: string[];
  try {
    files = await fg(pattern, {
      cwd: projectRoot,
      onlyFiles: true,
      dot: true,
      absolute: true,
      ignore: ["**/node_modules/**", "**/dist/**"],
    });
  } catch {
    return undefined;
  }
  if (files.length === 0) return [];

  let invalidFiles: Set<string>;
  try {
    const errors = await validateSkillFiles(files, { projectRoot, manifest });
    invalidFiles = new Set(errors.filter((e) => e.severity === "error").map((e) => e.file));
  } catch {
    invalidFiles = new Set();
  }

  const skills: ReportSkill[] = [];
  for (const file of files.sort()) {
    let data: Record<string, unknown> = {};
    try {
      const parsed = matter(await fsPromises.readFile(file, "utf-8")).data;
      if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
    } catch {
      // keep defaults; the file still counts in the inventory
    }
    const name = typeof data.name === "string" ? data.name : path.basename(file, ".md");
    const risk = data.risk === "low" || data.risk === "medium" || data.risk === "high";
    skills.push({
      name,
      ...(risk ? { risk: data.risk as "low" | "medium" | "high" } : {}),
      source: typeof data.pack_id === "string" ? `pack:${data.pack_id}` : "project",
      valid: !invalidFiles.has(file),
    });
  }
  return skills;
}

export interface CollectedReport {
  report: GovernanceReport;
  outcomes: RuleOutcome[];
}

export interface CollectReportOptions {
  projectRoot: string;
  manifest: BackendManifest;
  backend: string;
  fingerprint?: Fingerprint | undefined;
}

export async function collectGovernanceReport(
  options: CollectReportOptions
): Promise<CollectedReport> {
  const { projectRoot, manifest, backend, fingerprint } = options;

  const enforcement = await validateEnforcementDetailed(projectRoot, manifest, fingerprint);

  // Stage 5 upstream-outdated data is best-effort: offline/unconfigured skips it.
  let registryIndex = null;
  try {
    const { loadConfiguredRegistryIndex } = await import("../registry/client.js");
    registryIndex = await loadConfiguredRegistryIndex();
  } catch {
    registryIndex = null;
  }
  const integrity = await auditPackIntegrity(projectRoot, { registryIndex });

  const packs: ReportPackInput[] = [];
  for (const pack of integrity.packs) {
    packs.push({ ...pack, ...(await resolvePackExtras(pack.id, projectRoot)) });
  }

  const skills = await collectSkillsInventory(projectRoot, manifest);

  const snapshot = await loadSnapshot(projectRoot);
  const staleRuleIds = snapshot
    ? await findStaleManualRules(projectRoot, snapshot, enforcement.outcomes)
    : undefined;

  const report = buildGovernanceReport({
    project: { name: path.basename(projectRoot), root: projectRoot, backend },
    outcomes: enforcement.outcomes,
    packs,
    skills,
    staleRuleIds,
  });

  return { report, outcomes: enforcement.outcomes };
}
