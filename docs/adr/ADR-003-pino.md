# ADR-003: pino as Structured Logger

**Status**: Accepted  
**Date**: 2024-01-01  

## Context

`bp` uses `console.*` calls throughout ~40 source files. These provide no level control, no structured output for log aggregators, no sensitive field masking, and no correlation ID support needed for CI diagnostics.

## Decision

Replace all diagnostic `console.*` calls with a single `pino` logger exported from `src/logger.ts`. Use `pino-pretty` as a dev-only transport when TTY is detected.

## Rationale

- `pino` is the fastest Node.js structured logger; negligible overhead for a CLI tool
- Native NDJSON output is directly ingestible by Datadog, Loki, and CloudWatch
- `redact` option provides zero-cost sensitive field masking at logger creation
- `AsyncLocalStorage` integration enables correlation IDs without threading a context arg through every call
- `pino-pretty` keeps developer output readable without affecting production JSON

## Alternatives Considered

- **winston**: 3× heavier bundle; fragmented plugin ecosystem; no built-in redact
- **consola**: Good DX but not JSON-first; not suitable for structured CI log ingestion
- **debug**: No levels, no JSON, no redaction

## Consequences

- `pino` added as production dependency
- `pino-pretty` added as devDependency
- `BP_LOG_LEVEL` env var controls log level (default `info`; `silent` when `NODE_ENV=test`)
- `console.*` usage in `src/` banned via Biome lint rule
