# Stage 1 — Gap Analysis

Written at stage completion, 2026-06-12. Companion artifacts: `findings.md`,
`dependency-graph.md`, `baseline-metrics.md`.

## What did we miss?

- **Flag-level command documentation drift.** T6.1 verified command-level parity (31 docs
  headers ↔ 31 command files) but did not diff every flag in `docs/commands.md` against the
  Commander registrations. Deferred to Stage 9 with this explicit note.
- **e2e coverage blind spot.** Coverage excludes `tests/e2e/**` (per the `test:coverage`
  script), so the 0%-branch CLI command files in the backlog may in fact be exercised
  end-to-end. Stage 4 must measure or consciously waive e2e coverage before chasing those
  numbers.
- **Runtime behavior of speculative modules.** The audit traced entry points and read code
  (static), but did not execute `bp dev`, `bp marketplace`, `bp chain` etc. to confirm the
  features work. Stage 2/7 should smoke-test before refactoring them.
- **Dynamic-import edges are invisible to madge.** The dependency graph is built from static
  imports; `cli/commands/rule.ts` alone has 3 dynamic imports (`rule-library`, `ecosystem`).
  Any module-graph tooling adopted later must account for `await import(...)` edges.
- **dist/ build provenance.** Cold-start and `dist/` size were measured against the existing
  local build; the build was not regenerated from HEAD first. Numbers are representative but
  Stage 10 should rebuild before the "after" measurement.

## What could be optimized further?

- **One-change cycle elimination:** moving `BlueprintAdapter` out of `translator/index.ts`
  removes 12 of 14 cycles mechanically (findings C3–C14).
- **`check:circular` in CI.** The script is fixed but still not part of `npm run ci`. Once
  Stage 2 drives cycles to 0, add it to the `ci` chain so the false-green regression can never
  recur. (Adding it today would fail CI with the 14 known cycles, violating PROMPT rule 5.)
- **CLI cold-start (0.58 s median)** is high for a `--version` call; likely eager-loading all
  31 command modules. Stage 7 candidate: lazy command registration.
- **`cli/commands/rule.ts` (952 LOC, 258 branches)** is the single largest
  complexity/coverage hotspot; extracting its logic into `rule-library/` would serve Stages 2
  and 4 simultaneously.

## What risks remain?

- **The runtime cycle C2 (`registry/signer ↔ registry/trust`)** is live; ESM tolerates it
  today, but reordering exports during Stage 2 refactoring could surface
  temporal-dead-zone failures. Break it early in Stage 2.
- **`security/` layer ambiguity.** It imports validator, translator, and registry (V1–V3).
  Stage 2's refactor must decide its layer before touching engine interfaces, or the
  violations will be re-created.
- **Duplicate diff/merge/rule-library implementations** (`ecosystem/` vs `blueprint-sync/` vs
  `rule-library/`) risk divergent behavior for the same user-facing concepts; consolidation
  itself risks behavior change — needs characterization tests first (Stage 4 prerequisite for
  the Stage 2 consolidation).
- **Branch coverage 70.08% vs 85% target** — the gap is concentrated in translator adapters
  and CLI commands; refactoring before testing (Stage 2 before Stage 4) means refactors land
  on weakly covered code. Mitigate: Stage 2 should add characterization tests around any file
  in the <65% list it touches.

## What value-add opportunities exist?

- **`bp doctor` self-check for the circular-dep false green:** doctor could verify that
  repo-level lint/check scripts actually process files (guards against the exact class of
  vacuous-check bug found in T1.1).
- **Architecture conformance test:** the L0–L4 layer table from `dependency-graph.md` can be
  encoded as a unit test over madge JSON output (no new runtime dep; madge is already a dev
  dep), making layering violations CI-visible from Stage 2 onward.
- **Adapter conformance suite:** 12 adapters share the `BlueprintAdapter` contract; one
  parameterized test suite over all 31 backends would lift translator branch coverage cheaply.

## Cross-stage dependencies — what Stage 2 must know

1. **Cycle inventory and resolutions are pre-decided** (findings §1): C2 is the only runtime
   cycle; C3–C14 die by moving `BlueprintAdapter` to `translator/adapter.ts`; C1 dies by
   moving `ValidationError` to shared types.
2. **Nine layering violations V1–V9** with proposed resolutions are in
   `dependency-graph.md`; V5–V7 (validator → packs/plugins/registry) imply the Stage 2
   validator refactor must introduce injection from the CLI orchestrator.
3. **`validator/` is the primary SRP target** (24 files, 630-LOC index, alerting/cost/rbac/
   compliance bolted on); `cli/commands/rule.ts` and `doctor.ts` are the CLI-side targets.
4. **Speculative-module verdicts:** nothing is dead; consolidate `ecosystem/{diff,merge}` into
   `blueprint-sync/` and `ecosystem/rule-library.ts` into `rule-library/`; dissolve the `dx/`
   junk drawer. Removal-style changes need characterization tests first.
5. **Export-surface cleanups** (findings §3) are safe Stage 2 fodder, except `plugin/` exports
   which are public API and must not be pruned.
6. **Spec correction:** `rule-library/` is used (dynamic imports) — the spec's
   "strongest speculative-code candidate" line is superseded.

## Exit criteria confirmation

- All deliverables exist with measured data: `spec.md`, `tasks.md` (all 23 tasks checked),
  `findings.md`, `dependency-graph.md`, `baseline-metrics.md`, `gaps.md`.
- madge verified to process all 201 files; `check:circular` script fixed (the stage's only
  non-`review/` change, authorized by T1.3).
- `npm run ci` at stage exit: **pass** (exit 0; typecheck + biome + lint:custom + coverage,
  157 files / 1800 tests green).
