# ADR-004: Commander as CLI Framework

**Status**: Accepted  
**Date**: 2024-01-01  

## Context

`bp` exposes ~24 subcommands with nested sub-subcommands, options, and help text. The CLI framework must support Commander-style nested commands, TypeScript types, and auto-generated help.

## Decision

Use `commander` v14+ for all CLI command registration and argument parsing.

## Rationale

- Mature, stable API; v14 has full ESM support
- Nested `Command` instances map cleanly to `bp <command> <subcommand>` structure
- Auto-generated `--help` output requires no manual formatting
- `program.hook("preAction")` enables global audit logging without touching each command handler
- TypeScript types shipped in package

## Alternatives Considered

- **yargs**: More configuration surface; API less idiomatic for nested commands
- **meow**: Too minimal for 24-command surface; no built-in help generation
- **oclif**: Heavy framework with file-based command discovery; overkill for single-binary CLI

## Consequences

- Each command exported as `createXxxCommand(): Command` for modularity
- Global error handling via `program.parseAsync().catch()`
- Version flag exposed as `-v, --version`
