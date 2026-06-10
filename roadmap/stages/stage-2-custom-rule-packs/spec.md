# Stage 2 — Client-Authored Rule Packs

Closes **GAP-2** (`roadmap/00-analysis.md`): rule packs are hardcoded TypeScript constants;
clients cannot author, validate, or install their own packs. This stage defines an on-disk
pack format, a Zod schema for it, and CLI lifecycle commands — all validated through the
same pipeline as built-in content ("under the bp umbrella").

**Depends on Stage 1** (rules carry optional `check`; packs must round-trip it).

## Goals

1. A documented on-disk pack file format clients can write by hand or scaffold.
2. `bp rule pack:create | pack:lint | pack:install <path|id> | pack:list | pack:info`
   working uniformly for built-in and local packs.
3. Installed pack rules materialize as backend rule files (e.g. `.claude/rules/*.md`)
   through the existing templater/translator path, so `bp verify` (including Stage 1
   enforcement) governs them identically to scaffolded rules.
4. Full runtime validation: external pack data never enters the system without Zod.

## Non-goals

- Remote fetch/publishing and signature-gated installs (Stage 5; leave seams).
- Skill packs (Stage 3 reuses this format).

## Design

### 1. Pack file format

A pack is a single YAML or JSON file, extension `.bp-pack.yaml` / `.bp-pack.json`:

```yaml
schema: "bp-pack/1"
id: acme-internal-security        # irIdentifier rules: ^[a-z0-9_-]+$, ≤64
name: ACME Internal Security
version: 1.2.0                    # semver
kind: rules                       # "rules" now; "skills" added in Stage 3
framework: custom                 # gdpr|soc2|hipaa|pci-dss|iso-27001|custom
description: House security constraints for ACME repos
author: platform-team@acme.com
tags: [security, internal]
rules:
  - id: no-raw-sql
    scope: "src/**/*.ts"
    severity: hard
    action: "Never build SQL via string concatenation"
    rationale: "SQLi prevention; use the query builder"
    check:                        # Stage 1 Check object, optional
      type: content-absent
      glob: "src/**/*.ts"
      pattern: "execute\\(`|query\\(\\s*['\"]SELECT"
metadata:
  compliance_standard: ACME-SEC-001
```

### 2. Schema (`src/rule-library/schema.ts`, new)

Convert the existing `RulePack` TS interface into Zod:

```ts
export const RulePackSchema = z.object({
  schema: z.literal("bp-pack/1"),
  id: irIdentifier, name: irShortString,
  version: z.string().regex(semverRe),
  kind: z.literal("rules"),                 // widened to enum in Stage 3
  framework: z.enum(["gdpr","soc2","hipaa","pci-dss","iso-27001","custom"]),
  description: irShortString, author: irShortString,
  tags: z.array(irShortString).max(16),
  rules: z.array(RuleSchema).min(1).max(200),   // RuleSchema from ir.ts (incl. check)
  metadata: z.object({...}).partial().optional(),
});
```

Reuse `irIdentifier`/`irShortString` by exporting them from `src/translator/ir.ts`.
Refactor `src/rule-library/types.ts` so `RulePack = z.infer<typeof RulePackSchema>`;
migrate `BUILT_IN_PACKS` in `packs.ts` to satisfy the schema (add `schema`/`kind`
fields) and add a test asserting every built-in pack parses.

### 3. Pack store (`src/rule-library/store.ts`, new)

Resolution order for `pack:install <ref>` and `pack:info <ref>`:
1. Path ref (contains `/` or ends with `.bp-pack.{yaml,json}`) ⇒ load file.
2. Project packs dir: `.bp/packs/*.bp-pack.{yaml,json}` matched by `id`.
3. Built-ins (`BUILT_IN_PACKS`).

Loading = read (async fs) → parse YAML (add `yaml` dependency or use a minimal
parser already in tree — gray-matter bundles js-yaml; import js-yaml directly) →
`RulePackSchema.parse` → on ZodError, fail loud with `PACK_INVALID` listing each
issue path + message and the file/approximate line.

Duplicate rule ids inside a pack ⇒ `PACK_DUPLICATE_RULE` error. Pack id colliding
with a built-in ⇒ error unless `--force`.

### 4. Materialization (install)

`installPack` today mutates `BlueprintIR` in memory only. Extend
`src/rule-library/manager.ts` so install (CLI path) does:

1. Load + validate pack (store).
2. Run Stage 1 `CheckSchema` validation per rule (already inside RuleSchema) **and**
   run each rule through `validateSemantic` against the project (scope glob sanity).
3. Render one rule file per rule into the active backend's rules dir
   (`manifest.file_patterns.rules` base, filename `pack-<packId>-<ruleId>.md`)
   with frontmatter: id, scope, severity, action, rationale, tags, check, plus
   provenance keys `pack_id`, `pack_version`. Wrap body in generated-block markers
   consistent with the templater's block-merge conventions (see
   `src/templater/writer.ts`) so re-install is idempotent and `bp:preserve` regions
   survive.
4. Record install in `.bp/packs.lock.json` (new, Zod-schema'd):
   `{ schema: "bp-pack-lock/1", installed: [{ id, version, source, rules_count, installed_at, content_hash }] }`.
   `content_hash` = sha256 of canonical JSON of the pack — Stage 6 uses it for drift.
5. Re-install same id: default merge-by-rule-id (skip existing), `--force` replaces
   the pack's own generated files only. Never touch rules from other packs or
   hand-written rule files.

`pack:remove <id>` (new subcommand): delete that pack's generated rule files +
lockfile entry; refuse if files were hand-edited outside preserve blocks (hash
mismatch) unless `--force`.

### 5. CLI (`src/cli/commands/rule.ts`)

- `pack:create <id>` — scaffold `.bp/packs/<id>.bp-pack.yaml` with a commented
  template (one example rule with a check). `--from-rules <glob>`: harvest existing
  rule files' frontmatter into a pack.
- `pack:lint <path>` — schema + duplicate-id + per-rule check validation; exit
  non-zero on error; `--json` output.
- `pack:install <ref>` / `pack:remove <id>` / `pack:list` (built-ins + project packs
  + installed-with-versions) / `pack:info <ref>` / `pack:search <q>` (extend to
  project packs).

All output through existing chalk/error formatting conventions; errors as
`BpError` with proper `EXIT_CODES`; no `process.exit` outside `src/cli/index.ts`.

### 6. Verify integration

`bp verify` needs no special casing: materialized files flow through structural/
semantic/logical/enforcement automatically. Add one cross-check in
`src/validator/drift.ts` or a small `src/validator/pack-integrity.ts`: every entry in
`.bp/packs.lock.json` must have all its generated files present and hash-consistent ⇒
`PACK_FILE_MISSING` / `PACK_FILE_MODIFIED` warnings (errors with `--fail-on drift`).

### 7. Docs

- New `docs/rule-packs.md`: format reference, authoring walkthrough, lifecycle,
  lockfile, FAQ (how merge/force behave). Link from README "Advanced Customization".
- Update `docs/commands.md` (`bp rule pack:*`), `docs/glossary.md` (Pack, Lockfile,
  Materialization, Provenance).

## Acceptance criteria

1. Hand-written `.bp/packs/acme.bp-pack.yaml` with 2 rules: `bp rule pack:lint` passes;
   broken severity value fails with Zod issue path; duplicate rule id fails.
2. `bp rule pack:install acme` creates `.claude/rules/pack-acme-*.md` (for claude
   backend), updates lockfile; running install twice is a no-op (idempotent);
   `bp verify` validates the generated files; a failing Stage 1 check inside a pack
   rule fails `bp verify --level enforcement`.
3. `bp rule pack:remove acme` cleans files + lock entry; modified file blocks removal
   without `--force`.
4. Built-in packs still install; `pack:list` shows built-in + project + installed.
5. `npm run ci` green.

## Test plan

- Unit: schema (valid/invalid fixtures), store resolution order, lockfile round-trip,
  filename collision, duplicate ids, force/merge semantics.
- Integration: fixture project in `tests/fixtures/packs/` — full create→lint→install→
  verify→remove lifecycle against the claude template manifest; idempotency (byte-equal
  files after second install); preserve-block survival on re-install.
