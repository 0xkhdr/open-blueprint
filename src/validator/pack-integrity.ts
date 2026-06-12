/**
 * Pack integrity check (Stage 2 §6): every entry in `.bp/packs.lock.json`
 * must have all its generated rule files present and hash-consistent.
 * Findings are drift-class warnings (`PACK_FILE_MISSING` / `PACK_FILE_MODIFIED`),
 * so `bp verify --fail-on drift` turns them into failures. A pack with at
 * least one modified or missing file additionally gets one aggregate
 * `PACK_DRIFTED` warning (Stage 6) — the lockfile no longer describes what is
 * installed.
 */

import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { governedContentHash, loadPackLock } from "../packs/materialize.js";
import { PACK_LOCK_FILE } from "../packs/schema.js";
import { compareSemver, findIndexEntry, type RegistryIndex } from "../registry/registry-index.js";
import type { ValidationError } from "./structural.js";

export interface PackIntegrityOptions {
  /**
   * Verified registry index (Stage 5). When provided, installed packs whose
   * index entry advertises a newer version get a `PACK_OUTDATED` info
   * finding. Callers fetch it best-effort — never block verify on network.
   */
  registryIndex?: RegistryIndex | null;
}

/** Per-pack integrity status, consumed by the Stage 6 report builder. */
export interface PackIntegrityStatus {
  id: string;
  version: string;
  source: string;
  kind: string;
  trust?: string | undefined;
  /** `missing` wins over `modified` when both kinds of damage exist. */
  integrity: "ok" | "modified" | "missing";
  outdated: boolean;
}

export interface PackIntegrityAudit {
  findings: ValidationError[];
  packs: PackIntegrityStatus[];
}

export async function auditPackIntegrity(
  projectRoot: string,
  options: PackIntegrityOptions = {}
): Promise<PackIntegrityAudit> {
  const findings: ValidationError[] = [];
  const packs: PackIntegrityStatus[] = [];

  let lock: Awaited<ReturnType<typeof loadPackLock>>;
  try {
    lock = await loadPackLock(projectRoot);
  } catch (err) {
    findings.push({
      file: path.join(projectRoot, PACK_LOCK_FILE),
      type: "PACK_LOCK_INVALID",
      severity: "error",
      message: err instanceof Error ? err.message : String(err),
      resolution: `Fix or delete ${PACK_LOCK_FILE} and re-install your packs`,
    });
    return { findings, packs };
  }

  for (const entry of lock.installed) {
    let outdated = false;
    if (options.registryIndex) {
      const indexEntry = findIndexEntry(options.registryIndex, entry.id);
      if (indexEntry && compareSemver(indexEntry.version, entry.version) > 0) {
        outdated = true;
        findings.push({
          file: path.join(projectRoot, PACK_LOCK_FILE),
          type: "PACK_OUTDATED",
          severity: "info",
          message: `Pack '${entry.id}' is installed at v${entry.version} but the registry index advertises v${indexEntry.version}`,
          resolution: `Run \`bp rule pack:install ${entry.id} --force\` (or the skill/plugin equivalent) to upgrade`,
        });
      }
    }

    let missingCount = 0;
    let modifiedCount = 0;
    for (const [relPath, expectedHash] of Object.entries(entry.files)) {
      const absPath = path.join(projectRoot, relPath);
      let content: string;
      try {
        content = await fsPromises.readFile(absPath, "utf-8");
      } catch {
        missingCount++;
        findings.push({
          file: absPath,
          type: "PACK_FILE_MISSING",
          severity: "warning",
          message: `Rule file from pack '${entry.id}' v${entry.version} is missing: ${relPath}`,
          resolution: `Run \`bp rule pack:install ${entry.id} --force\` to regenerate, or \`bp rule pack:remove ${entry.id} --force\` to drop the pack`,
        });
        continue;
      }
      if (governedContentHash(content) !== expectedHash) {
        modifiedCount++;
        findings.push({
          file: absPath,
          type: "PACK_FILE_MODIFIED",
          severity: "warning",
          message: `Rule file from pack '${entry.id}' v${entry.version} was edited outside preserve blocks: ${relPath}`,
          resolution:
            "Move custom edits into a <!-- bp:preserve --> block, or re-install the pack with --force to reset",
        });
      }
    }

    const integrity = missingCount > 0 ? "missing" : modifiedCount > 0 ? "modified" : "ok";
    if (integrity !== "ok") {
      findings.push({
        file: path.join(projectRoot, PACK_LOCK_FILE),
        type: "PACK_DRIFTED",
        severity: "warning",
        message: `Pack '${entry.id}' v${entry.version} drifted from its lockfile: ${modifiedCount} modified, ${missingCount} missing file(s)`,
        resolution: `Re-install with \`bp rule pack:install ${entry.id} --force\` to restore governed content, or remove the pack`,
      });
    }

    packs.push({
      id: entry.id,
      version: entry.version,
      source: entry.source,
      kind: entry.kind,
      trust: entry.trust,
      integrity,
      outdated,
    });
  }

  return { findings, packs };
}

export async function validatePackIntegrity(
  projectRoot: string,
  options: PackIntegrityOptions = {}
): Promise<ValidationError[]> {
  const audit = await auditPackIntegrity(projectRoot, options);
  return audit.findings;
}
