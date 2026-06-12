# Spec — Stage 1: Architecture & Dependency Audit

**Status:** Complete — executed 2026-06-12; results in `findings.md`, `dependency-graph.md`, `baseline-metrics.md`, `gaps.md`
**Source:** PROMPT.md Stage 1
**Date:** 2026-06-12

## 1. Goal

Establish a measured, evidence-based architectural baseline for `@agentic/bp` before any
refactoring (Stages 2–10). Stage 1 is **read-only with respect to `src/`**: it produces audit
artifacts, baseline metrics, and a prioritized findings list. No production code changes unless a
finding is trivially safe (e.g., removing an unused export) *and* explicitly listed in
`tasks-stage-01.md`.

## 2. Scope

In scope:

- Circular-dependency analysis (madge) — including verifying the madge invocation itself works
  (initial run reported "Processed 0 files" while claiming success; the check may be vacuous).
- Module cohesion / SRP review of all 27 `src/` directories.
- Dependency-direction graph (which module imports which; flag upward dependencies, e.g.
  `detector` importing from `cli`).
- Export-surface audit of every `src/*/index.ts`.
- Test-coverage gap analysis (branch coverage <65% per file, hot paths prioritized).
- Speculative-code audit of `dx/`, `ecosystem/`, `enterprise/`, `multiagent/`,
  `blueprint-sync/`, `rule-library/`.
- Documentation drift check (docs vs. code: commands, exit codes, schema versions, module list).

Out of scope (deferred to later stages):

- Any SOLID refactoring (Stage 2), error/observability changes (Stage 3), test additions
  (Stage 4), security fixes (Stage 5+).

## 3. Pre-measured baseline (gathered during spec drafting)

| Metric | Value | Note |
|---|---|---|
| `src/` TypeScript files | 201 | 27 top-level modules |
| `tests/` TypeScript files | 174 | unit / integration / e2e / fuzz / performance |
| `madge --circular` | "No circular dependency found" | **but "Processed 0 files"** — likely misconfigured; must be fixed or re-run correctly as part of this stage |
| `dx/` | 3 files, imported by core/cli (3 hits) | not dead code; audit depth of usage |
| `ecosystem/` | 5 files, 1 core/cli import | thin usage — candidate for consolidation finding |
| `enterprise/` | 3 files, 2 core/cli imports | verify concrete behavior vs. stub |
| `multiagent/` | 3 files, 3 core/cli imports | verify concrete behavior vs. stub |
| `blueprint-sync/` | 4 files, 2 core/cli imports | |
| `rule-library/` | 4 files, **0** core/cli imports found | strongest speculative-code candidate; verify with full-repo grep (CLI may import via dynamic path) |

## 4. Architectural decisions

1. **Layering model used for the audit.** Modules are classified into layers; an import from a
   lower layer to a higher layer is a violation:
   - L0 foundations: `constants.ts`, `errors.ts`, `types/`, `utils/`, `logger.ts`
   - L1 infrastructure: `config/`, `observability/`, `telemetry/`, `security/`
   - L2 engines: `detector/`, `templater/`, `validator/`, `translator/`, `backends/`
   - L3 services: `packs/`, `registry/`, `report/`, `plugins/`, `plugin/`, `lsp/`,
     `blueprint-sync/`, `rule-library/`, `dx/`, `ecosystem/`, `enterprise/`, `multiagent/`
   - L4 presentation: `cli/`
2. **Findings, not fixes.** Each violation gets a severity (`blocker` / `should-fix` /
   `acceptable`) and a proposed resolution (interface extraction, dependency inversion, deletion)
   recorded for Stage 2 — not applied in Stage 1.
3. **Coverage tooling.** Use the existing vitest v8 coverage JSON output; no new dependencies
   (PROMPT rule 6).
4. **Honest output.** Anything that cannot be measured (e.g., if coverage report fails for a
   module) is reported as "unavailable", never estimated (project value: honest output).

## 5. Deliverables

- `review/stage-01/spec.md` (this file)
- `review/stage-01/tasks.md` — numbered checklist (exists alongside this spec)
- `review/stage-01/gaps.md` — written at the **end** of stage execution, answering the five
  gap-analysis questions from PROMPT.md (missed items, further optimizations, remaining risks,
  value-add opportunities, cross-stage dependencies for Stage 2)
- `review/stage-01/baseline-metrics.md` — machine-checkable before-metrics for Stage 10's before/after
  comparison (LOC, coverage, circular deps, cold-start time, dist/ size)

## 6. Exit criteria

- All deliverable files exist and contain measured (not asserted) data.
- madge check verified to actually process files.
- `npm run ci` passes (no code changes expected, but run to capture the baseline pass).
