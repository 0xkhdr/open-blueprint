# Stage 1 Tasks — Executable Rule Conditions

> **Status: ✅ COMPLETED** (2026-06-11) — all task groups done, `npm run ci` green (1514 tests), acceptance criteria 1–5 verified.

Order matters. Keep `npm run ci` green after each numbered group.

## 1. Schema

- [x] 1.1 Create `src/validator/checks/schema.ts`: `CheckSchema` (z.lazy discriminated union per spec §1), star-height regex guard, depth/children limits, exported `Check` type.
- [x] 1.2 Extend `RuleSchema` in `src/translator/ir.ts` with optional `check` and `enforcement` fields (spec §2). Verify existing IR tests still pass.
- [x] 1.3 Unit tests for schema: valid samples per check type, invalid regex, depth-4 rejection, 17-children rejection, glob `****` rejection.

## 2. Evaluator

- [x] 2.1 Create `src/validator/checks/evaluate.ts` with `evaluateCheck`, `CheckContext`, `CheckOutcome` (spec §3). Leaf checks: file-exists, file-absent, content-match, content-absent, frontmatter-field, fingerprint, json-key.
- [x] 2.2 Implement dependency-present/absent for package.json; graceful manual-downgrade outcome for other ecosystems.
- [x] 2.3 Composites allOf/anyOf/not with short-circuiting and merged evidence.
- [x] 2.4 Resource caps: reuse `MAX_VALIDATION_FILES`/`MAX_VALIDATION_BYTES`, skip files > 1 MiB with detail note. Add module to `lint:no-sync-fs` list in package.json.
- [x] 2.5 Telemetry span `validator.enforcement` via `startSpan`.
- [x] 2.6 Unit + fast-check property tests (random trees never throw).

## 3. Enforcement validation layer

- [x] 3.1 Create `src/validator/enforcement.ts` `validateEnforcement` (spec §4): collect rule files from manifest, parse frontmatter, map outcomes to `ValidationError` with types `RULE_VIOLATION` / `RULE_MANUAL` / `RULE_CHECK_INVALID`, hard⇒error / soft⇒warning, line numbers from frontmatter.
- [x] 3.2 Wire `"enforcement"` into `ValidationLevel`, the `"all"` sequence (after logical, before drift), and result counters in `src/validator/index.ts`.
- [x] 3.3 Thread `--level enforcement` / `--fail-on` through `src/cli/commands/verify.ts`; JSON output includes enforced/violations/manual counts.
- [x] 3.4 Integration tests on `tests/fixtures/enforcement/` fixture repo: pass, hard-fail (non-zero exit), soft-warn, manual-info, malformed-check cases.

## 4. CLI rule tooling

- [x] 4.1 `bp rule test`: evaluate `check` after scope-match output; print PASS/FAIL, detail, ≤10 evidence lines; exit codes per spec §6.
- [x] 4.2 `bp rule lint`: Zod-validate `check` frontmatter, report `RULE_CHECK_INVALID` with line numbers.
- [x] 4.3 Tests for both subcommands (follow existing rule.ts test patterns in `tests/`).

## 5. Built-in packs honesty pass

- [x] 5.1 Audit every rule in `src/rule-library/packs.ts`: add genuine `check` where expressible (≥3 per pack target), else `enforcement: "manual"`. No fake checks.
- [x] 5.2 Recompute `metadata.coverage` = % auto-enforceable; update pack tests.

## 6. Docs

- [x] 6.1 `docs/data-models.md`: Check schema reference + one example per type.
- [x] 6.2 `docs/commands.md`: verify/rule updates. `docs/glossary.md`: Check, Enforcement, Manual rule, Violation. `docs/philosophy.md` pillar 3 note.
- [x] 6.3 Final: `npm run ci` green; confirm acceptance criteria 1–5 in spec.
