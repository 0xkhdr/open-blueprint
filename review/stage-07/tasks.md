# Tasks — Stage 7: Performance & Resource Optimization

## 1. Measure first

- [ ] **T1.1** Cold-start baseline: `--version`, `--help`, `bp verify` (median of 5, hyperfine
      if available else `time`); record.
- [ ] **T1.2** Memory baseline: RSS peak on 1000-file repo verify (Stage 4 fixture).
- [ ] **T1.3** `dist/` size baseline (total + per-module).

## 2. Lazy loading

- [ ] **T2.1** Extract static command-descriptor manifest (name, summary, flags).
- [ ] **T2.2** Refactor `src/cli/index.ts` to dynamic `import()` per command action.
- [ ] **T2.3** `--help` snapshot test pre/post (must be identical).
- [ ] **T2.4** Dynamic-import LSP/telemetry/observability; verify no-op path cost ≈ 0.
- [ ] **T2.5** Re-measure cold start; record delta.

## 3. I/O & caches

- [ ] **T3.1** Shared per-run file read-cache in `ValidationContext`; wire validators; tests.
- [ ] **T3.2** Audit `src/validator/cache.ts` LRU bounds (count + bytes); eviction tests.
- [ ] **T3.3** Bound Handlebars compile cache; tests.

## 4. Memory leaks

- [ ] **T4.1** Plugin worker lifecycle audit: termination, idle timeout; 100-run RSS leak test.

## 5. Bundle

- [ ] **T5.1** Dead-code removal from Stage 1 export audit (safe items only).
- [ ] **T5.2** Adapter-splitting analysis memo (recommendation only, no packaging change).

## 6. Wrap-up

- [ ] **T6.1** Write `review/stage-07/perf-report.md` (all before/after numbers).
- [ ] **T6.2** `npm run ci` green; write `review/stage-07/gaps.md` (lazy-load race conditions,
      worker-pool leaks, unmeasured paths).
