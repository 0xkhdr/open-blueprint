## ADDED Requirements

### Requirement: Documentation Readability Validation
All project documentation files MUST have a stated purpose in the first 2 lines and use scannable heading hierarchies.

#### Scenario: Verify scannability and purpose statements
- **WHEN** the regression cycle runs over all `.md` files
- **THEN** all files must have purpose statements at the beginning and proper headers

### Requirement: Open-Spec Conformance
Technical specification files MUST conform to structural spec patterns and RFC 2119 keyword discipline.

#### Scenario: Audit RFC 2119 keywords
- **WHEN** spec documents are parsed
- **THEN** keywords like SHALL, MUST, and SHOULD are verified for correct usage

### Requirement: Codebase Parity Verification
Every documented CLI subcommand, option, environment variable, and default value MUST match the current codebase.

#### Scenario: Verify command parity
- **WHEN** commands in `docs/commands.md` are audited against `bp` subcommands
- **THEN** all 24 subcommands registered in code must have corresponding documentation entries
