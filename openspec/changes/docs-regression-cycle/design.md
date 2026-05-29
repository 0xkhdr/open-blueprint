## Context

The `@agentic/bp` CLI has expanded significantly to 24 subcommands, but `docs/commands.md` only documents 9. Furthermore, other documentation files need to be audited for readability, open-spec conformance, overload elimination, and codebase parity.

## Goals / Non-Goals

**Goals:**
- Perform a thorough documentation regression cycle over `docs/` and `specs/`.
- Catalog all 24 commands and ensure complete option, argument, and default parity.
- Deliver `docs-regression-report.md`, `docs-readability-scorecard.md`, and `docs-glossary-delta.md`.
- Establish concrete rewrite/patch files to resolve critical disparities.

**Non-Goals:**
- Rewriting codebase core execution or functional logic.
- Restructuring CLI command implementations.

## Decisions

- **Decision 1: Full CLI Command Coverage**
  - *Rationale*: We must document all 24 subcommands (such as `dev`, `diff`, `docs`, `merge`, `agent`, `mcp`, `team`, `chain`, `memory`, `telemetry`, `cost`, `drift`, `marketplace`, `update`, `migrate`) within `docs/commands.md` to ensure codebase parity and prevent user confusion.
  - *Alternatives considered*: Documenting only some commands or keeping them separated. Rejected to preserve a single, comprehensive reference manual.
- **Decision 2: Standardized Readability Metrics**
  - *Rationale*: Apply a unified scorecard based on scannability, purpose statements, and example runnability.

## Risks / Trade-offs

- **Risk: Scope Creep in Spec/Doc Updates** → *Mitigation*: Limit the scope strictly to alignment with existing HEAD code behavior and metadata, without inventing undocumented behaviors.
