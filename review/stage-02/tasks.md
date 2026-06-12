# Tasks — Stage 2: SOLID Refactoring — Core Engines

Draft — renumber/extend after Stage 1 findings. One engine per commit; CI green between commits.

## 1. Interfaces & contracts

- [ ] **T1.1** Define `LevelValidator`, `DetectionStrategy`, `BackendAdapter` (or confirm
      existing base), `ILogger` interfaces in low-layer modules (`src/types/` or per-engine
      `contracts.ts`).
- [ ] **T1.2** Document each interface contract (pre/postconditions, error behavior via
      `BpError`).

## 2. Validator

- [ ] **T2.1** Extract each of six levels behind `LevelValidator`; create level registry.
- [ ] **T2.2** Rewrite `src/validator/index.ts` as `ValidationPipeline` composing registry
      entries via constructor injection (cache, logger, config).
- [ ] **T2.3** Map inter-level data dependencies; introduce explicit `ValidationContext` if
      levels share state.
- [ ] **T2.4** Tests: pipeline order, level isolation, registry extension test (mock level 7).

## 3. Detector

- [ ] **T3.1** Extract language/framework detection into strategy classes.
- [ ] **T3.2** `detector/index.ts` orchestrates only; Fingerprint "1.0" output byte-identical on
      fixtures (snapshot test before refactor).

## 4. Templater

- [ ] **T4.1** Verify coordinator/engine/writer separation; move stragglers.
- [ ] **T4.2** Isolate merge-marker logic; add exhaustive unit tests (idempotency invariant).

## 5. Translator

- [ ] **T5.1** Audit all 31 adapters against common interface; fix divergents.
- [ ] **T5.2** Remove any adapter→adapter imports; hoist shared code to `adapters/base/`.
- [ ] **T5.3** LSP audit: shared contract test suite run against every adapter.
- [ ] **T5.4** Round-trip fidelity before/after comparison on fixtures; assert ≥95% maintained.

## 6. ISP / DIP cross-cutting

- [ ] **T6.1** Split bloated `src/types/` interfaces (list from Stage 1).
- [ ] **T6.2** Trim `src/plugin/` exports to author-needed surface (no breaking change — only
      remove what Stage 1 proved unused externally; otherwise deprecate).
- [ ] **T6.3** Introduce `ILogger`; engines take injected logger; CLI composition root wires
      default Pino instance.
- [ ] **T6.4** Sweep `src/cli/commands/*.ts` for deep-internal imports; route through engine
      public API.

## 7. Verification

- [ ] **T7.1** `npm run ci` after each engine commit; final coverage ≥ baseline.
- [ ] **T7.2** Verify BpError subclass substitutability in `src/cli/index.ts` error mapping.
- [ ] **T7.3** Write `review/stage-02/gaps.md` (round-trip risks, DI blockers, perf impact
      measured against Stage 1 baseline).
