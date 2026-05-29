# ADR-005: Zod for Schema Validation

**Status**: Accepted  
**Date**: 2024-01-01  

## Context

`BlueprintIR` is the internal representation shared across all four engines. It must be validated at parse time (adapters read from disk) and at render time (adapters write to disk). Validation errors must include field paths for actionable error messages.

## Decision

Use Zod for all IR schema definitions and runtime validation. Schemas live in `src/translator/ir.ts`.

## Rationale

- Single source of truth: Zod schemas generate TypeScript types via `z.infer`
- Runtime validation at system boundaries (adapter parse/render) without duplicating type definitions
- Error messages include field paths (e.g., `personas[0].role`) — essential for CLI error output
- Zero runtime overhead when validation is skipped on trusted internal paths
- Tree-shakeable; unused schema branches excluded from bundle

## Alternatives Considered

- **ajv + JSON Schema**: Verbose schema definitions; separate TS type declarations required
- **io-ts**: Functional-style API; steeper learning curve; less idiomatic for team use
- **Manual validation**: Error-prone; no auto-generated types

## Consequences

- All IR types derived from Zod schemas via `z.infer<typeof XxxSchema>`
- New IR fields must be added to both the Zod schema and any affected adapters
- `zod` is a production dependency
