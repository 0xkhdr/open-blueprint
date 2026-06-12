# Spec — Stage 2: SOLID Refactoring — Core Engines

**Status:** Complete (2026-06-12) — executed against the Stage 1 findings (cycle inventory
C1–C14, violations V1–V9, SRP review); deviations and residuals recorded in `gaps.md`
**Depends on:** Stage 1 dependency graph, SRP review, export-surface audit
**Date:** 2026-06-12

## 1. Goal

Refactor the four core engines (Detector, Templater, Validator, Translator) to strict SOLID
compliance without changing observable behavior: same CLI output, same exit codes, same schema
versions, round-trip fidelity ≥95% preserved.

## 2. Target design

### Validator — SRP + OCP
- `src/validator/index.ts` becomes a thin `ValidationPipeline` that composes level validators.
- Each of the six levels (structural, semantic, logical, enforcement, drift, governance)
  implements a common `LevelValidator` interface and is registered in a level registry.
  Adding level 7 = new file + registry entry, no pipeline edits.
- Level validators receive dependencies (fs access, cache, logger, config) via constructor
  injection — no module-level singletons.

### Detector — SRP
- Language/framework-specific detection extracted from `src/detector/index.ts` into strategy
  classes implementing a `DetectionStrategy` interface; `index.ts` orchestrates only.
- Static-analysis-only constraint stated on the interface contract (no network/shell/exec).

### Templater — SRP
- `src/templater/index.ts` coordinates; Handlebars engine setup stays in
  `src/templater/engine.ts`; file writing stays in `writer.ts`. Merge-marker logic
  (`bp-generated` / `bp:preserve`) isolated in one module with exhaustive unit tests.

### Translator — OCP + LSP
- All adapters implement one `BackendAdapter` interface (or extend bases in `adapters/base/`).
  Adapter 32 = new file + `backends/registry.ts` entry only.
- Adapters must not import each other; shared behavior lives only in `adapters/base/`.
- LSP audit: base-class contract documented (pre/postconditions); subclasses tested against a
  shared contract test suite (feeds Stage 4 contract tests).

### Cross-cutting — ISP + DIP
- Bloated interfaces in `src/types/` split per consumer (findings from Stage 1 decide which).
- `src/plugin/` exposes only plugin-author-needed types.
- `ILogger` interface introduced; engines take logger via injection. Default wiring stays in
  CLI composition root (`src/cli/`), preserving current behavior.
- `src/cli/commands/*.ts` import engine interfaces/factories, not engine internals.

## 3. Constraints

- Stable contracts untouched: exit codes 0–10, schema versions, `@agentic/bp/plugin` surface.
- No new runtime dependencies (DI = manual constructor injection, no DI framework).
- No circular imports introduced; interfaces live in the lower layer (`types/` or per-engine
  `contracts.ts`) to keep dependency direction downward.
- Coverage maintained or improved; `npm run ci` passes after each sub-refactor commit.

## 4. Risks (to expand in gaps.md)

- Round-trip fidelity regression in translator refactor — mitigate with before/after fixture
  round-trip comparison.
- Hidden inter-level dependencies in the validator (e.g., drift reusing structural results) may
  force an explicit shared-context object rather than pure DI.
- Abstraction layering can slow hot paths — measure with Stage 1 baseline benchmarks.

## 5. Exit criteria

- Four engines have explicit interface definitions; no engine imports another engine's concrete
  implementation.
- Adding a validation level or backend adapter requires only a new file + registry entry
  (demonstrated by a test or doc walkthrough).
- `npm run ci` passes; coverage not reduced.
