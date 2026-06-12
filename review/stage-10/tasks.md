# Tasks — Stage 10: Final Integration, Gap Closure & Release Readiness

## 1. Integration checks

- [ ] **T1.1** Validate every doc link in `.bp/skills/` against Stage 9 tree.
- [ ] **T1.2** Audit skill content vs Stage 2 interfaces/registries (names, patterns).
- [ ] **T1.3** Spot-audit architecture docs vs refactored code.

## 2. Gap closure

- [ ] **T2.1** Aggregate all `review/stage-*/gaps.md` into disposition table
      (must-fix / defer / closed).
- [ ] **T2.2** Execute must-fix items (security first, then contracts, perf, docs).

## 3. Regression

- [ ] **T3.1** `npm run ci` ×3 consecutive; investigate any flake.
- [ ] **T3.2** E2E on Node 20 / Node 22 / Bun; document unavailable runtimes honestly.
- [ ] **T3.3** Re-run benchmarks; compare to baselines; fix >10% regressions.

## 4. Metrics

- [ ] **T4.1** Collect after-metrics; build before/after table vs
      `review/stage-01/baseline-metrics.md`.

## 5. Release artifacts

- [ ] **T5.1** `CHANGELOG.md` entries; breaking changes + migrations; semver recommendation.
- [ ] **T5.2** Update `docs/production-audit.md`; write ADRs (skills, docs revamp, Stage 2
      architecture if missing).
- [ ] **T5.3** Verify exit-code docs accuracy end-to-end.
- [ ] **T5.4** Write `review/FINAL_REPORT.md` (per-stage summary, metrics, gap disposition,
      known issues, readiness verdict).

## 6. Continuous improvement

- [ ] **T6.1** Opportunity survey (issues, comparable tools, TS practices, advisories).
- [ ] **T6.2** `review/proposed-stage-{NN}.md` per high-value proposal.
- [ ] **T6.3** Write `docs/MAINTENANCE.md` playbook.

## 7. Wrap-up

- [ ] **T7.1** Write `review/stage-10/gaps.md` (cross-stage misses, known issues, post-release
      monitoring recommendations).
