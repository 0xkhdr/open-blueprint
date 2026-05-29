# ADR-002: Vitest as Test Framework

**Status**: Accepted  
**Date**: 2024-01-01  

## Context

The project needs a test framework compatible with ESM modules, TypeScript source, and fast watch mode for developer iteration.

## Decision

Use Vitest with `@vitest/coverage-v8` for unit, integration, and coverage reporting.

## Rationale

- Native ESM support — no additional Babel/ts-jest transform config
- Compatible with `tsx` import style used in source
- `fast-check` property-based testing integrates without adapters
- V8 coverage provider gives accurate branch coverage without instrumentation overhead
- API mirrors Jest — low migration cost if Jest familiarity exists

## Alternatives Considered

- **Jest**: Requires `ts-jest` transform; ESM support historically fragile
- **Mocha + nyc**: More configuration; no built-in TypeScript support
- **Node built-in test runner**: No coverage, no watch mode, minimal assertion library

## Consequences

- Tests run via `vitest run`; watch via `vitest`
- Coverage gate enforced via `vitest.config.ts` thresholds
- Snapshot tests use Vitest snapshot format
