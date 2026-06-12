# Stage 1 — Baseline Metrics

Measured 2026-06-12 on Linux 6.17.0-35-generic, Node from local environment, commit `82be70b`
plus the Stage 1 `check:circular` script fix. All values measured directly; nothing estimated.
These are the "before" numbers for Stage 10's before/after comparison.

## Size

| Metric | Value | How measured |
|---|---|---|
| `src/` TypeScript files | 201 | `find src -name '*.ts' \| wc -l` |
| `src/` LOC | 31,713 | `wc -l` over the same set |
| `tests/` TypeScript files | 174 | `find tests -name '*.ts' \| wc -l` |
| `tests/` LOC | 25,228 | `wc -l` over the same set |
| `dist/` size | 4.7 MB | `du -sh dist/` (local `tsc` build) |
| Largest source files | `cli/commands/rule.ts` 952, `validator/index.ts` 630, `cli/commands/doctor.ts` 623, `cli/commands/skill.ts` 611, `validator/checks/evaluate.ts` 569 LOC | `wc -l \| sort -rn` |

## Circular dependencies

| Metric | Value |
|---|---|
| `check:circular` before Stage 1 | **vacuous** — "Processed 0 files", false green (missing `--extensions ts`) |
| Real file-level cycles (corrected madge, 201 files processed) | **14** |
| Runtime-value cycles | 1 (`registry/signer.ts ↔ registry/trust.ts`) |
| Type-only cycles | 13 (1 validator↔security, 12 translator/index ↔ adapters) |

Details and per-cycle resolutions: `findings.md` §1.

## Test suite & coverage

`npm run test:coverage` (vitest v8 provider, e2e excluded): **157 test files, 1800 tests, all
passing**, exit 0.

| Global coverage | % |
|---|---|
| Statements | 80.44 |
| Branches | 70.08 |
| Functions | 84.90 |
| Lines | 81.45 |

Stage 4 targets are 85/85/75/85 — branch coverage (70.08) is the furthest from target.

### Files with branch coverage < 65% (37 files — Stage 4 backlog)

Priority 1 — hot-path files (members of the `lint:no-sync-fs` list) and `errors.ts`:

| File | Branch % | Branches |
|---|---|---|
| `src/cli/commands/doctor.ts` | 0.0 | 135 |
| `src/registry/signer.ts` | 33.3 | 6 |
| `src/templater/engine.ts` | 42.6 | 68 |
| `src/validator/drift.ts` | 59.8 | 97 |

(`errors.ts` is at 93.3% branch — above threshold, no action.)

Priority 2 — engine/service code:

| File | Branch % | Branches |
|---|---|---|
| `src/translator/adapters/gemini.ts` | 16.7 | 36 |
| `src/plugins/runner.ts` | 28.6 | 14 |
| `src/translator/adapters/base/MarkdownAdapter.ts` | 27.8 | 36 |
| `src/translator/adapters/antigravity.ts` | 31.3 | 48 |
| `src/translator/adapters/copilot.ts` | 34.0 | 50 |
| `src/translator/adapters/kiro.ts` | 37.0 | 54 |
| `src/ecosystem/merge.ts` | 39.1 | 46 |
| `src/dx/dev-server.ts` | 40.0 | 35 |
| `src/rule-library/manager.ts` | 43.3 | 30 |
| `src/dx/migrate.ts` | 44.2 | 52 |
| `src/detector/workspace-parser.ts` | 44.7 | 38 |
| `src/translator/adapters/cursor.ts` | 59.8 | 82 |
| `src/blueprint-sync/diff.ts` | 60.0 | 75 |
| `src/translator/adapters/base/SkillOnlyAdapter.ts` | 60.0 | 10 |
| `src/plugins/worker-host.ts` | 63.2 | 19 |

Priority 3 — CLI command files and small files:

| File | Branch % | Branches |
|---|---|---|
| `src/cli/pack-install.ts` | 0.0 | 14 |
| `src/cli/commands/docs.ts` | 0.0 | 16 |
| `src/cli/commands/init.ts` | 0.0 | 70 |
| `src/cli/commands/migrate.ts` | 0.0 | 42 |
| `src/cli/orchestrators/init.ts` | 0.0 | 14 |
| `src/utils/pkg.ts` | 0.0 | 2 |
| `src/cli/commands/report.ts` | 19.5 | 87 |
| `src/cli/commands/health.ts` | 22.2 | 27 |
| `src/cli/commands/dev.ts` | 27.3 | 66 |
| `src/cli/commands/rule.ts` | 45.0 | 258 |
| `src/telemetry/tracer.ts` | 50.0 | 2 |
| `src/templater/risk-selector.ts` | 50.0 | 2 |
| `src/translator/index.ts` | 50.0 | 2 |
| `src/translator/adapters/registry.ts` | 50.0 | 2 |
| `src/translator/adapters/base/TomlCommandAdapter.ts` | 50.0 | 2 |
| `src/cli/commands/emit.ts` | 54.2 | 24 |
| `src/logger.ts` | 58.3 | 12 |
| `src/cli/commands/skill.ts` | 64.7 | 139 |

Note: e2e tests are excluded from coverage (matching the `test:coverage` script), so CLI
command files are systematically under-counted here; some are exercised by `tests/e2e/`.
Stage 4 should decide whether to measure e2e coverage separately rather than chase unit
coverage of command glue.

## CLI cold-start

`node dist/cli/index.js --version`, 5 runs: 0.72, 0.58, 0.58, 0.55, 0.58 s — **median 0.58 s**.
(First run includes filesystem cache warm-up.)

## CI baseline

`npm run ci` (typecheck + biome lint + lint:custom + coverage): **pass** — see `gaps.md` for
the end-of-stage confirmation run.
