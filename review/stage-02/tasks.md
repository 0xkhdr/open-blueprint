# Tasks — Stage 2: SOLID Refactoring — Core Engines

Executed 2026-06-12 against Stage 1 findings. One engine per commit; CI green between commits
(commits f5c2ac1 … on `main`). Annotations record what was done and where scope was
deliberately narrowed — residuals live in `gaps.md`.

## 1. Interfaces & contracts

- [x] **T1.1** Interfaces defined in low-layer modules: `LevelValidator` + `ValidationContext`
      + `BlueprintSource` + `PluginEngine` (`src/validator/contracts.ts`), `DetectionStrategy`
      (`src/detector/contracts.ts`), `BlueprintAdapter` confirmed as the backend interface and
      moved to `src/translator/adapter.ts` (was inside `translator/index.ts` — the source of
      cycles C3–C14), `ILogger` (`src/types/logger.ts`), `ValidationError`
      (`src/types/validation.ts`, breaking C1/V1).
- [x] **T1.2** Each interface carries documented pre/postconditions, error behavior
      (`BpError`, never `process.exit`), and the static-analysis-only invariant.

## 2. Validator

- [x] **T2.1** Six levels extracted behind `LevelValidator` into `src/validator/levels/`
      (structural, semantic, logical, enforcement, drift, governance) plus `backend-rules`
      as a seventh registry entry (it shares the logical trigger but, unlike `LogicalLevel`,
      never skipped on structural failure — preserving pre-refactor gating exactly).
      Registry: `levels/registry.ts`; array order = execution order.
- [x] **T2.2** `src/validator/index.ts` rewritten as a thin `ValidationPipeline` (file
      collection, resource limits, per-file cache, timeout, severity partitioning) with
      constructor injection of levels, services, and logger. Public surface unchanged
      (`runValidator`, `exitCodeForResult`, `collectBlueprintFiles`, limits, types).
- [x] **T2.3** Inter-level data mapped into an explicit `ValidationContext`
      (file partitions + `structuralFailed` flag); levels read, only the pipeline writes.
      File-scoped vs global phases model the cache boundary that was implicit before.
- [x] **T2.4** `tests/unit/validator/pipeline.test.ts`: registry order, mock level-7
      extension (no pipeline edits), structural short-circuit gating, context isolation
      across runs, `BlueprintSource` injection seam.

## 3. Detector

- [x] **T3.1** Languages/frameworks/tooling/security detection wrapped in strategy classes
      (`src/detector/strategies.ts`) behind `DetectionStrategy`.
- [x] **T3.2** `detector/index.ts` orchestrates via the interface only; output equality
      verified by test (default path vs explicit-strategies path identical modulo
      `detected_at` clock) plus the full pre-existing detector suite. Note: byte-identical
      snapshots are impossible by design — `detected_at` is a timestamp.

## 4. Templater

- [x] **T4.1** Coordinator/engine/writer separation verified — no stragglers moved; the one
      genuine finding was the static `RegistryClient` import (layering violation V4), now a
      lazy import inside the `extends` path only.
- [x] **T4.2** Merge-marker logic confirmed isolated in `merger.ts`; edge-case tests added
      (merge idempotency invariant, preserve-block dedup, multiple preserve blocks, unclosed
      blocks, mismatched end-marker ids, wrap/extract round-trip). Fixed a latent stateful-
      regex bug: `hasMarkers` alternated true/false on repeated identical calls.

## 5. Translator

- [x] **T5.1** All 31 adapters audited: every adapter `implements BlueprintAdapter` or
      extends an `adapters/base/` class; the loader table types enforce conformance at
      compile time. No divergents found.
- [x] **T5.2** No adapter→adapter imports exist. Sibling imports inside `adapters/`
      (agents-md, mcp-json, chains-yaml, teams-yaml, memory, telemetry) are pure generator
      functions — shared serializers, not adapters — and were left in place deliberately;
      they are documented as such in the audit commit.
- [x] **T5.3** Shared LSP contract suite (`tests/unit/translator/adapter-contract.test.ts`)
      runs 4 substitutability checks × 31 backends: schema-valid parse of an empty project,
      render reports only real in-root files, deterministic + idempotent render
      (generation-timestamp lines are the one documented exemption), round-trip re-parse.
- [x] **T5.4** Round-trip fidelity: no adapter parse/render logic changed this stage (only
      the interface import path), and the pre-existing skill-fidelity suite plus the new
      round-trip contract checks pass unchanged — fidelity is preserved by construction.
      A measured ≥95% fidelity score still does not exist as a number; building that metric
      is recorded in `gaps.md` for Stage 4.

## 6. ISP / DIP cross-cutting

- [x] **T6.1** Stage 1 found no bloated `src/types/` interfaces to split (the module was
      near-empty). The shared-type splits that did happen: `ValidationError` →
      `types/validation.ts`, `ILogger` → `types/logger.ts`. Templater's internally-consumed
      type re-exports left as-is (zero external consumers, zero risk, no payoff in removal).
- [x] **T6.2** Per Stage 1 finding, `src/plugin/` exports are the public plugin API surface —
      nothing pruned, nothing deprecated.
- [x] **T6.3** `ILogger` introduced; `ValidationPipeline` takes an injected logger (defaults
      to the Pino instance — current behavior preserved for all callers). **Partial:**
      detector/templater still use the module-level logger internally; threading injection
      through their helper functions was judged churn without payoff this stage (gaps §2).
- [x] **T6.4** Sweep done: `ValidationError` deep imports in `cli/commands/*`, `report/sarif`,
      `plugins/loader`, `packs/materialize` rerouted to `types/validation.js`. Remaining CLI
      imports of engine module functions are L4→L2 downward edges, sanctioned by the layering
      model (presentation may import anything).

## 7. Verification

- [x] **T7.1** `npm run ci` green at stage exit (now including `check:circular`, added once
      cycles hit 0): 160 files / 1941 tests. Coverage vs Stage 1 baseline: statements
      80.44→81.52, branches 70.08→71.4, functions 84.90→85.53, lines 81.45→82.6 — all up.
- [x] **T7.2** Verified: `src/cli/index.ts` maps any `BpError` subclass polymorphically via
      `e.exitCode`/`e.code` — substitutability holds. Finding: translator's
      `UnsupportedBackendError` extends plain `Error` (maps to generic exit 1); converting it
      to a `BpError` subclass is a Stage 3 item (gaps §4).
- [x] **T7.3** `review/stage-02/gaps.md` written.
