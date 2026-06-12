# Spec — Stage 4: Testing Strategy & Coverage Hardening

**Status:** Draft — revise with Stage 1 coverage-gap backlog
**Depends on:** Stage 1 T4.x coverage backlog; Stage 2 interfaces (mock boundaries)
**Date:** 2026-06-12

## 1. Goal

Raise coverage thresholds (lines 85%, functions 85%, branches 75%, statements 85%), make E2E run
against the real build, and add contract/property tests that protect the stable contracts.

## 2. Design

- **Threshold raise** in `vitest.config.ts` only after gaps closed — never lower a threshold to
  pass; if 85/85/75/85 is unreachable in a module without rewriting it, document per-module
  exception with justification (honest output).
- **Mocking policy:** unit tests mock at Stage 2 interface boundaries (`LevelValidator`,
  `DetectionStrategy`, `BackendAdapter`, `ILogger`, fs abstraction in `src/utils/`) — never
  monkey-patch internals.
- **Contract tests:** one shared round-trip suite (`IR → emit → parse → IR`) parameterized over
  all 31 adapters; fidelity score asserted per adapter (core adapters ≥95%); non-conforming
  adapters get documented known-deltas fixtures, not weakened assertions.
- **Property tests (fast-check):** Fingerprint schema accepts-what-it-emits; BpError exit-code
  uniqueness; merge-marker idempotency (template applied twice = once).
- **E2E:** run `npm run build` first, execute `dist/cli/index.js` in temp dirs (no repo
  pollution, no shared state between tests); add `bp convert --from X --to Y` matrix over
  representative backends (claude, cursor, copilot + 2 long-tail).
- **Fixtures:** audited minimal set, each tagged with schema version; `scripts/validate-fixtures`
  checks fixtures against current Zod schemas, wired into CI.
- **Performance baselines:** vitest bench (already in `tests/performance/`) — `bp verify` on
  generated 1000-file repo, `bp init` <2s on standard Node project; results recorded, not gated
  hard in CI initially (flaky-runner risk) — gate decision documented in gaps.

## 3. Constraints

- No new runtime deps; fast-check/vitest already present as dev deps.
- E2E must pass on Node 20/22 and Bun (full matrix executed in Stage 10).

## 4. Exit criteria

- New thresholds green in `npm run ci`.
- E2E runs against `dist/`; convert matrix passing.
- Fixture validation script in CI; benchmarks documented with baselines in
  `review/stage-04/benchmarks.md`.
