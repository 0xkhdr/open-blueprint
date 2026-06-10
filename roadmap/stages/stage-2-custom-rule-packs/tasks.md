# Stage 2 Tasks — Client-Authored Rule Packs

Prereq: Stage 1 merged (RuleSchema has `check`). Keep `npm run ci` green per group.

## 1. Schema & built-in migration

- [ ] 1.1 Export `irIdentifier`, `irShortString` (and semver regex helper) from `src/translator/ir.ts`.
- [ ] 1.2 Create `src/rule-library/schema.ts` with `RulePackSchema` (spec §2) + `PackLockSchema` (spec §4.4).
- [ ] 1.3 Refactor `src/rule-library/types.ts`: `RulePack = z.infer<...>`; keep `RuleLibraryIndex`/`RulePackMetadata`/`InstallOptions`.
- [ ] 1.4 Migrate `BUILT_IN_PACKS` in `packs.ts` to include `schema: "bp-pack/1"`, `kind: "rules"`; test: every built-in parses against `RulePackSchema`.

## 2. Pack store

- [ ] 2.1 Create `src/rule-library/store.ts`: load from path / `.bp/packs/` / built-ins (resolution order spec §3); js-yaml parse; fail-loud `PACK_INVALID` with Zod issue paths.
- [ ] 2.2 Duplicate-rule-id detection (`PACK_DUPLICATE_RULE`); built-in id collision guard.
- [ ] 2.3 Unit tests: resolution order, YAML+JSON, malformed YAML, schema violations, dup ids.

## 3. Materialization

- [ ] 3.1 Rule-file renderer: pack rule → markdown with frontmatter incl. `pack_id`/`pack_version` provenance, generated-block markers matching `src/templater/writer.ts` conventions, filename `pack-<packId>-<ruleId>.md`.
- [ ] 3.2 Extend `RuleLibraryManager.installPack` CLI path: validate → semantic scope check → write files into `manifest.file_patterns.rules` dir → update `.bp/packs.lock.json` with sha256 content_hash. Idempotent re-install; `--force` replaces own files only.
- [ ] 3.3 Implement `removePack`: delete own generated files + lock entry; hash-mismatch guard requiring `--force`.
- [ ] 3.4 Unit tests: idempotency (byte-equal second run), preserve-block survival, force/merge, remove guard.

## 4. CLI

- [ ] 4.1 `pack:create <id>` scaffolder with commented template; `--from-rules <glob>` harvester.
- [ ] 4.2 `pack:lint <path>` with `--json`; wire to store validation.
- [ ] 4.3 Rework `pack:install`/`pack:info`/`pack:search`/`pack:list` to use store (built-in + project + installed); add `pack:remove`.
- [ ] 4.4 CLI tests for each subcommand incl. exit codes.

## 5. Verify integration

- [ ] 5.1 Pack integrity check (`src/validator/pack-integrity.ts` or inside drift): lockfile entries ⇒ files present + hash-consistent ⇒ `PACK_FILE_MISSING`/`PACK_FILE_MODIFIED`.
- [ ] 5.2 Integration test: install pack with failing Stage 1 check ⇒ `bp verify --level enforcement` exits non-zero.

## 6. Docs & wrap-up

- [ ] 6.1 Write `docs/rule-packs.md`; link from README; update `docs/commands.md`, `docs/glossary.md`.
- [ ] 6.2 Full lifecycle integration test in `tests/fixtures/packs/`; confirm acceptance criteria 1–5; `npm run ci` green.
