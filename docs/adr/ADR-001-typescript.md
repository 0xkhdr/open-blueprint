# ADR-001: TypeScript as Implementation Language

**Status**: Accepted  
**Date**: 2024-01-01  

## Context

`bp` is a CLI tool consumed by developers in TypeScript, Go, and Python projects. The implementation language must support: static typing for the IR schema, fast startup, and good Node.js ecosystem interop.

## Decision

Use TypeScript compiled to ESM JavaScript. Source in `src/`, output to `dist/`.

## Rationale

- Zod schema definitions for `BlueprintIR` provide compile-time and runtime safety
- TypeScript's structural typing aligns naturally with the adapter interface pattern
- No additional startup cost vs. plain Node.js (compiled ahead of time)
- `tsx` provides fast DX iteration without a watch build

## Alternatives Considered

- **Go**: Better binary distribution but no native npm ecosystem; template rendering and Handlebars integration would require FFI
- **Python**: Slower startup; not idiomatic for npm-distributed CLI tools
- **Plain JavaScript**: No type safety for IR schema; Zod would still require TS for good DX

## Consequences

- All contributors must write TypeScript
- `tsconfig.json` targets ES2022 with strict mode
- Build step required before distribution (`npm run build`)
