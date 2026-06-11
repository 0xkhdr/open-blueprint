# Stage 6 Tasks — Governance Reporting

**Status: ✅ Completed (2026-06-11)** — all groups implemented, acceptance criteria 1–5 verified, `npm run ci` green.

Prereqs: Stages 1–2 merged (3 and 5 optional, handled by graceful degradation). Keep `npm run ci` green per group.

## 1. Structured outcomes

- [x] 1.1 Refactor `validateEnforcement` (Stage 1) to also return structured per-rule outcomes (id, status pass|fail|manual|invalid, evidence, pack provenance) alongside the existing `ValidationError[]`; no behavior change to verify.
- [x] 1.2 Unit tests guarding both return shapes.

## 2. Report model & builder

- [x] 2.1 Create `src/report/model.ts`: `bp-report/1` Zod schema (spec §1).
- [x] 2.2 Create `src/report/build.ts`: compose enforcement outcomes + pack lockfile/integrity + (optional) skills inventory + (optional) trust/outdated data; graceful degradation when a source is absent.
- [x] 2.3 Unit tests from synthetic inputs incl. degradation matrix.

## 3. SARIF

- [x] 3.1 Locate existing SARIF output (added in commit `1029fc6`); extract/shared serializer into `src/report/sarif.ts`.
- [x] 3.2 Map report → SARIF 2.1.0: per-rule `rules[]` (rationale, severity, pack, framework props), per-violation `results[]` with evidence locations.
- [x] 3.3 Schema-validate output in tests (SARIF JSON schema fixture).

## 4. CLI

- [x] 4.1 Create `src/cli/commands/report.ts` (register in CLI index): terminal table (cliui), `--json [file]`, `--sarif [file]`, `--fail-on hard|soft|none` (default hard), `--framework`, `--snapshot`.
- [x] 4.2 Exit-code tests for fail-on thresholds.

## 5. Compliance honesty & drift

- [x] 5.1 `pack:info` + report show measured pass/fail/manual; static `metadata.coverage` relabeled "declared (unverified)".
- [x] 5.2 `PACK_DRIFTED` (lockfile hash mismatch) in verify/pack-integrity; surface integrity in report.
- [x] 5.3 Snapshot file `.bp/report-snapshot.json` + `RULE_MANUAL_STALE` info check (skip when no snapshot); tests.
- [x] 5.4 Surface `trust: "unsigned-accepted"` packs in summary when Stage 5 data exists.

## 6. CI & docs

- [x] 6.1 Extend GitHub Actions recipe(s): report --sarif + upload-sarif step (`docs/recipes.md`, `docs/ci-integration.md`); exit codes in `docs/troubleshooting.md`.
- [x] 6.2 Write `docs/governance-reporting.md`; update README pitch + `docs/observability.md` cross-links; `docs/commands.md` entry.
- [x] 6.3 Confirm acceptance criteria 1–5; `npm run ci` green.
