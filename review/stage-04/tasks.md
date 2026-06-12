# Tasks — Stage 4: Testing Strategy & Coverage Hardening

## 1. Coverage

- [ ] **T1.1** Take Stage 1 coverage backlog; write targeted tests for hot-path files first.
- [ ] **T1.2** Close remaining files below new thresholds; document justified exceptions.
- [ ] **T1.3** Raise thresholds in `vitest.config.ts` to 85/85/75/85; CI green.

## 2. Test architecture

- [ ] **T2.1** Audit existing unit tests for internal-implementation mocking; refit to interface
      boundaries.
- [ ] **T2.2** Build shared adapter round-trip contract suite; parameterize over 31 adapters.
- [ ] **T2.3** Record per-adapter fidelity scores in `review/stage-04/roundtrip-scores.md`;
      assert ≥95% core adapters.
- [ ] **T2.4** Property tests: Fingerprint schema round-trip, BpError code uniqueness,
      merge-marker idempotency.

## 3. E2E

- [ ] **T3.1** Refit `tests/e2e/` to spawn `dist/cli/index.js` (build in globalSetup), temp-dir
      isolated, parallel-safe.
- [ ] **T3.2** Add `bp convert` matrix E2E across representative backends.
- [ ] **T3.3** Flakiness check: run e2e suite 3× locally; fix shared-state offenders.

## 4. Fixtures

- [ ] **T4.1** Audit `tests/fixtures/`; remove unused, minimize oversized, tag schema versions.
- [ ] **T4.2** Add `scripts/validate-fixtures.ts` (Zod check against current schemas); wire into
      CI script.

## 5. Performance

- [ ] **T5.1** Bench: `bp verify` on synthetic 1000+-file repo; record baseline.
- [ ] **T5.2** Bench: `bp init` on standard Node project; assert <2s, record.
- [ ] **T5.3** Document baselines + CI-gating decision in `review/stage-04/benchmarks.md`.

## 6. Wrap-up

- [ ] **T6.1** `npm run ci` green at new thresholds.
- [ ] **T6.2** Write `review/stage-04/gaps.md` (e2e flake sources, property-test strength,
      plugin-system test holes).
