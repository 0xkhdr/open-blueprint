# Spec — Stage 7: Performance & Resource Optimization

**Status:** Draft — revise with Stage 1 baseline + Stage 4 benchmarks
**Date:** 2026-06-12

## 1. Goal

Faster CLI startup, bounded memory, optimized I/O — measured against Stage 1 baseline; no
optimization without a before-number (honest output).

## 2. Design

### Lazy loading
- `src/cli/index.ts` imports all 30+ command factories eagerly → refactor to dynamic `import()`
  per command: Commander registers name/description/flags cheaply; action handler awaits the
  command module on invocation.
  - Flags must remain statically known for `--help` — keep lightweight command *descriptors*
    (name, summary, flags) in a static manifest; heavy implementation loaded on demand.
  - Risk: `docs/commands.md` sync + Stage 9 help-consistency check must still see full flag
    surface — descriptors are the single source for both.
- LSP, telemetry, observability behind dynamic import (no-op fast path when disabled, per
  Stage 3).
- Measure: cold start (`--version`, `--help`, `bp verify` first-run) median-of-5 before/after.

### I/O
- Confirm async fs exclusively in hot paths (list from `lint:no-sync-fs` + Stage 6 config add).
- Shared read-cache for files touched by multiple validation levels (keyed path+mtime; lives in
  `ValidationContext` from Stage 2 — per-run scope, no cross-run staleness).
- Audit `src/validator/cache.ts` LRU: bounded entries + bounded byte size; eviction tested.

### Memory
- Handlebars compiled-template cache: bounded, keyed by template path+hash.
- Plugin worker pool: workers terminated after run / idle timeout; leak test (RSS across 100
  sequential runs).

### Bundle
- Measure `dist/` size; remove dead code found in Stage 1 export audit.
- Splitting adapters into optional peer deps = packaging breaking-change candidate → analyze and
  record recommendation only; implementation needs approval.

## 3. Constraints

- No behavior change: identical output and exit codes; `--help` identical pre/post lazy loading
  (snapshot test).
- No new runtime deps; no bundler introduction without approval.

## 4. Exit criteria

- Cold-start before/after documented in `review/stage-07/perf-report.md`.
- Memory profile on large repo documented; caches bounded with tests.
- `npm run ci` green.
