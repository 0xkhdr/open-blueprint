# Spec — Stage 10: Final Integration, Gap Closure & Release Readiness

**Status:** Draft — executable only after Stages 1–9 complete
**Date:** 2026-06-12

## 1. Goal

Integrate all stages, close must-fix gaps, run full regression across runtimes, collect
before/after metrics against the Stage 1 baseline, and certify release readiness in
`review/FINAL_REPORT.md`.

## 2. Design

### Cross-stage integration checks
- Stage 8 skills ↔ Stage 9 doc paths: every doc link in `.bp/skills/` resolves.
- Stage 2 architecture ↔ Stage 8 skill content: interface names, registry patterns accurate.
- Stage 9 docs ↔ actual code: spot-audit of architecture docs against refactored modules.

### Gap closure
- Aggregate all `review/stage-*/gaps.md`; classify each item: `must-fix` / `defer-with-
  justification` / `closed-by-later-stage`. Priority: security > contract breaks > performance
  regressions > docs.
- Must-fix items become tasks executed in this stage; deferrals documented in FINAL_REPORT with
  owner-facing justification.

### Regression matrix
- `npm run ci` ×3 consecutive (flake detection).
- E2E on Node 20, Node 22, Bun ≥1.0 (whatever runtimes are installed locally; unavailable
  runtimes reported as "not run — unavailable", never assumed passing).
- Performance benchmarks vs Stage 1/4 baselines; regressions >10% are must-fix.

### Metrics (before = Stage 1 baseline-metrics.md)
LOC, coverage (4 numbers), cyclomatic complexity (via existing tooling or documented as
unavailable — no new dep just for a metric), circular deps, cold start, dist size.

### Release artifacts
- `CHANGELOG.md` entries; breaking changes + migration paths; semver bump recommendation
  (actual publish = user decision).
- `docs/production-audit.md` updated; new ADRs: skills ecosystem, docs revamp (and any Stage 2
  architecture ADR not yet written).
- `review/FINAL_REPORT.md`: per-stage summary, metrics table, gap disposition, known issues,
  release-readiness verdict (honest — "not ready" is an acceptable verdict).

### Continuous improvement directive (post-Stage-10, per PROMPT)
- Survey: repo issues (if accessible), comparable tools, 2026 TS practices, dep advisories.
- `review/proposed-stage-{NN}.md` per high-value proposal (problem, solution, effort, value).
- `docs/MAINTENANCE.md` playbook: dependency cadence, security review cadence, perf monitoring,
  docs freshness.

## 3. Exit criteria

- CI green ×3; e2e matrix run (or unavailability documented); FINAL_REPORT complete with real
  metrics; all gaps closed or justified; repo mergeable/release-ready (or honestly assessed
  otherwise).
