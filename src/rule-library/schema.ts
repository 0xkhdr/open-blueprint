/**
 * Zod schemas for the on-disk rule pack format (`*.bp-pack.yaml` / `*.bp-pack.json`)
 * and the install lockfile (`.bp/packs.lock.json`).
 *
 * Stage 2 (GAP-2): external pack data never enters the system without passing
 * through these schemas. Built-in packs are validated against the same schema
 * so client-authored and shipped content share one contract.
 */

import { z } from "zod";
import { irIdentifier, irShortString, RuleSchema, SEMVER_RE } from "../translator/ir.js";

export const PACK_SCHEMA_VERSION = "bp-pack/1";
export const PACK_LOCK_SCHEMA_VERSION = "bp-pack-lock/1";

/** File extensions a pack file may use, in resolution order. */
export const PACK_FILE_EXTENSIONS = [".bp-pack.yaml", ".bp-pack.yml", ".bp-pack.json"] as const;

/** Project-relative directory where local packs live. */
export const PROJECT_PACKS_DIR = ".bp/packs";

/** Project-relative path of the install lockfile. */
export const PACK_LOCK_FILE = ".bp/packs.lock.json";

export const RulePackMetadataFieldsSchema = z
  .object({
    created_at: irShortString,
    updated_at: irShortString,
    compliance_standard: irShortString,
    coverage: z.number().min(0).max(100),
  })
  .partial();

export const RulePackSchema = z.object({
  schema: z.literal(PACK_SCHEMA_VERSION),
  id: irIdentifier,
  name: irShortString,
  version: z.string().regex(SEMVER_RE, "version must be valid semver (e.g. 1.2.0)"),
  // Widened to an enum when skill packs land in Stage 3.
  kind: z.literal("rules"),
  framework: z.enum(["gdpr", "soc2", "hipaa", "pci-dss", "iso-27001", "custom"]),
  description: irShortString,
  author: irShortString,
  tags: z.array(irShortString).max(16).default([]),
  rules: z.array(RuleSchema).min(1).max(200),
  metadata: RulePackMetadataFieldsSchema.optional(),
});

export type RulePack = z.infer<typeof RulePackSchema>;

// ---------------------------------------------------------------------------
// Lockfile
// ---------------------------------------------------------------------------

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, "must be a sha256 hex digest");

export const PackLockEntrySchema = z.object({
  id: irIdentifier,
  version: z.string().regex(SEMVER_RE),
  /** Where the pack came from: "built-in", "project", or a file path. */
  source: irShortString,
  rules_count: z.number().int().min(0),
  installed_at: z.string(),
  /** sha256 of the canonical JSON of the pack — Stage 6 uses it for drift. */
  content_hash: sha256Hex,
  /**
   * Generated rule files, keyed by POSIX path relative to the project root.
   * The hash covers the governed (non-preserve) content so user preserve
   * blocks never count as tampering.
   */
  files: z.record(z.string(), sha256Hex),
});

export const PackLockSchema = z.object({
  schema: z.literal(PACK_LOCK_SCHEMA_VERSION),
  installed: z.array(PackLockEntrySchema),
});

export type PackLockEntry = z.infer<typeof PackLockEntrySchema>;
export type PackLock = z.infer<typeof PackLockSchema>;

export function createEmptyPackLock(): PackLock {
  return { schema: PACK_LOCK_SCHEMA_VERSION, installed: [] };
}
