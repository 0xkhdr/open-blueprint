/**
 * Zod schemas for the on-disk pack format (`*.bp-pack.yaml` / `*.bp-pack.json`)
 * and the install lockfile (`.bp/packs.lock.json`).
 *
 * Stage 2 (GAP-2): external pack data never enters the system without passing
 * through these schemas. Built-in packs are validated against the same schema
 * so client-authored and shipped content share one contract.
 *
 * Stage 3 (GAP-3): packs carry `kind: rules | skills`. A skills pack ships
 * full `SkillSchema` entries (procedure body included) and materializes into
 * the backend's skills directory through the same store/lockfile machinery.
 */

import { z } from "zod";
import {
  irIdentifier,
  irShortString,
  RuleSchema,
  SEMVER_RE,
  SkillSchema,
} from "../translator/ir.js";

export const PACK_SCHEMA_VERSION = "bp-pack/1";
export const PACK_LOCK_SCHEMA_VERSION = "bp-pack-lock/1";

/** File extensions a pack file may use, in resolution order. */
export const PACK_FILE_EXTENSIONS = [".bp-pack.yaml", ".bp-pack.yml", ".bp-pack.json"] as const;

/** Project-relative directory where local packs live. */
export const PROJECT_PACKS_DIR = ".bp/packs";

/** Project-relative path of the install lockfile. */
export const PACK_LOCK_FILE = ".bp/packs.lock.json";

export const PackKindSchema = z.enum(["rules", "skills"]);
export type PackKind = z.infer<typeof PackKindSchema>;

export const RulePackMetadataFieldsSchema = z
  .object({
    created_at: irShortString,
    updated_at: irShortString,
    compliance_standard: irShortString,
    coverage: z.number().min(0).max(100),
  })
  .partial();

/** A skill pack entry is a complete IR skill — procedure body included. */
export const SkillPackEntrySchema = SkillSchema;
export type SkillPackEntry = z.infer<typeof SkillPackEntrySchema>;

export const RulePackSchema = z
  .object({
    schema: z.literal(PACK_SCHEMA_VERSION),
    id: irIdentifier,
    name: irShortString,
    version: z.string().regex(SEMVER_RE, "version must be valid semver (e.g. 1.2.0)"),
    kind: PackKindSchema,
    framework: z.enum(["gdpr", "soc2", "hipaa", "pci-dss", "iso-27001", "custom"]),
    description: irShortString,
    author: irShortString,
    tags: z.array(irShortString).max(16).default([]),
    rules: z.array(RuleSchema).max(200).default([]),
    skills: z.array(SkillPackEntrySchema).max(100).default([]),
    metadata: RulePackMetadataFieldsSchema.optional(),
  })
  .superRefine((pack, ctx) => {
    if (pack.kind === "rules") {
      if (pack.rules.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["rules"],
          message: "a 'kind: rules' pack must declare at least one rule",
        });
      }
      if (pack.skills.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["skills"],
          message: "a 'kind: rules' pack must not declare skills (use 'kind: skills')",
        });
      }
    } else {
      if (pack.skills.length === 0) {
        ctx.addIssue({
          code: "custom",
          path: ["skills"],
          message: "a 'kind: skills' pack must declare at least one skill",
        });
      }
      if (pack.rules.length > 0) {
        ctx.addIssue({
          code: "custom",
          path: ["rules"],
          message: "a 'kind: skills' pack must not declare rules (use 'kind: rules')",
        });
      }
    }
  });

export type RulePack = z.infer<typeof RulePackSchema>;

// ---------------------------------------------------------------------------
// Lockfile
// ---------------------------------------------------------------------------

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, "must be a sha256 hex digest");

/** Lockfile kinds: pack kinds plus Stage 5 plugin artifacts. */
export const PackLockKindSchema = z.enum(["rules", "skills", "plugin"]);
export type PackLockKind = z.infer<typeof PackLockKindSchema>;

export const PackLockEntrySchema = z.object({
  id: irIdentifier,
  version: z.string().regex(SEMVER_RE),
  /**
   * Where the pack came from: "built-in", "project", a file path, or a
   * Stage 5 remote ref (https URL, github: ref, registry:<index-url>).
   */
  source: z.string().min(1).max(500),
  /** Pre-Stage-3 lockfiles omit this; rule packs were the only kind. */
  kind: PackLockKindSchema.default("rules"),
  rules_count: z.number().int().min(0),
  skills_count: z.number().int().min(0).default(0),
  installed_at: z.string(),
  /** sha256 of the canonical JSON of the pack — Stage 6 uses it for drift. */
  content_hash: sha256Hex,
  /** Stage 5: sha256 of the distributed artifact tarball (pin for CI installs). */
  artifact_sha256: sha256Hex.optional(),
  /** Stage 5: `publisher` field from the signed artifact manifest. */
  publisher: z.string().max(200).optional(),
  /** Stage 5 trust outcome: `signed:<keyname>` or `unsigned-accepted`. */
  trust: z.string().max(200).optional(),
  /**
   * Generated files, keyed by POSIX path relative to the project root.
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
