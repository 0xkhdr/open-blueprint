/**
 * Governance report model (`bp-report/1`) — Stage 6 (GAP-6).
 *
 * The report replaces static governance claims (pack "coverage" metadata)
 * with measured reality: per-rule enforcement outcomes, per-pack measured
 * pass/fail/manual counts, and content-integrity status for installed packs.
 * Everything `bp report` emits passes through this schema.
 */

import { z } from "zod";

export const REPORT_SCHEMA_VERSION = "bp-report/1";

/** Project-relative path of the staleness snapshot (`bp report --snapshot`). */
export const REPORT_SNAPSHOT_FILE = ".bp/report-snapshot.json";

export const RuleStatusSchema = z.enum(["pass", "fail", "manual", "invalid"]);
export type RuleStatus = z.infer<typeof RuleStatusSchema>;

export const ReportEvidenceSchema = z.object({
  file: z.string(),
  line: z.number().int().min(1).optional(),
});

export const ReportRuleSchema = z.object({
  id: z.string(),
  /** Project-relative POSIX path of the rule file. */
  file: z.string(),
  severity: z.enum(["hard", "soft"]),
  enforcement: z.enum(["auto", "manual"]),
  status: RuleStatusSchema,
  pack: z.object({ id: z.string(), version: z.string() }).optional(),
  detail: z.string().optional(),
  evidence: z.array(ReportEvidenceSchema).optional(),
  /** Manual rule whose scoped files changed since the last snapshot. */
  stale: z.boolean().optional(),
});
export type ReportRule = z.infer<typeof ReportRuleSchema>;

export const PackIntegrityStatusSchema = z.enum(["ok", "modified", "missing"]);
export type PackIntegrityStatus = z.infer<typeof PackIntegrityStatusSchema>;

export const ReportPackSchema = z.object({
  id: z.string(),
  version: z.string(),
  /** Compliance framework when resolvable; absent for unresolvable sources. */
  framework: z.string().optional(),
  source: z.string().optional(),
  /** Stage 5 trust outcome (`signed:<key>` / `unsigned-accepted`). */
  trust: z.string().optional(),
  /** Measured outcome counts — replaces the static `coverage` claim. */
  measured: z.object({
    pass: z.number().int().min(0),
    fail: z.number().int().min(0),
    manual: z.number().int().min(0),
  }),
  /** Static metadata.coverage, surfaced only as a declared, unverified claim. */
  declared_coverage: z.number().min(0).max(100).optional(),
  outdated: z.boolean().optional(),
  integrity: PackIntegrityStatusSchema,
});
export type ReportPack = z.infer<typeof ReportPackSchema>;

export const ReportSkillSchema = z.object({
  name: z.string(),
  risk: z.enum(["low", "medium", "high"]).optional(),
  source: z.string(),
  valid: z.boolean(),
});
export type ReportSkill = z.infer<typeof ReportSkillSchema>;

export const GovernanceReportSchema = z.object({
  schema: z.literal(REPORT_SCHEMA_VERSION),
  generated_at: z.string(),
  project: z.object({
    name: z.string(),
    root: z.string(),
    backend: z.string(),
  }),
  summary: z.object({
    rules_total: z.number().int().min(0),
    rules_enforced: z.number().int().min(0),
    rules_manual: z.number().int().min(0),
    violations_hard: z.number().int().min(0),
    violations_soft: z.number().int().min(0),
    skills_total: z.number().int().min(0).optional(),
    packs_installed: z.number().int().min(0),
    /** Packs installed under the Stage 5 `unsigned-accepted` trust outcome. */
    packs_unsigned: z.number().int().min(0).optional(),
  }),
  rules: z.array(ReportRuleSchema),
  packs: z.array(ReportPackSchema),
  skills: z.array(ReportSkillSchema).optional(),
});
export type GovernanceReport = z.infer<typeof GovernanceReportSchema>;

// ---------------------------------------------------------------------------
// Snapshot (`bp report --snapshot` → .bp/report-snapshot.json)
// ---------------------------------------------------------------------------

export const SNAPSHOT_SCHEMA_VERSION = "bp-report-snapshot/1";

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/);

export const SnapshotManualRuleSchema = z.object({
  /** Normalized-prose hash of the rule file — detects rule edits. */
  rule_hash: sha256Hex,
  scope: z.string(),
  /** Content hashes of scope-matched files at snapshot time (capped). */
  scope_files: z.record(z.string(), sha256Hex),
});
export type SnapshotManualRule = z.infer<typeof SnapshotManualRuleSchema>;

export const ReportSnapshotSchema = z.object({
  schema: z.literal(SNAPSHOT_SCHEMA_VERSION),
  generated_at: z.string(),
  manual_rules: z.record(z.string(), SnapshotManualRuleSchema),
});
export type ReportSnapshot = z.infer<typeof ReportSnapshotSchema>;
