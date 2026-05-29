## ADDED Requirements

### Requirement: All CLI commands support `--json` flag for machine-readable output
`bp init`, `bp verify`, `bp convert`, `bp doctor`, and `bp drift` SHALL accept a `--json` flag that writes structured JSON to stdout and suppresses all non-JSON output (spinners, colored text, progress messages).

#### Scenario: bp doctor --all --json
- **WHEN** `bp doctor --all --json` is run
- **THEN** stdout contains only a valid JSON object with a `backends` array where each entry has `id`, `healthy`, `skills`, `commands`, and `warnings` fields

#### Scenario: bp verify --json on clean project
- **WHEN** `bp verify --json` is run on a valid project
- **THEN** stdout contains `{"status":"ok","errors":[],"warnings":[]}`

#### Scenario: bp verify --json with errors
- **WHEN** `bp verify --json` is run on a project with validation errors
- **THEN** stdout contains `{"status":"error","errors":[...],"warnings":[...]}` and process exits non-zero

#### Scenario: --json suppresses interactive output
- **WHEN** any command is run with `--json`
- **THEN** no spinner, color codes, or progress lines appear in stdout (they may go to stderr)

### Requirement: JSON output schema is documented and stable
The JSON output shape for each command SHALL be documented in `docs/json-output.md` and SHALL not have breaking changes within a minor version.

#### Scenario: JSON shape matches documented schema
- **WHEN** `bp doctor --all --json` output is compared to the documented schema
- **THEN** all required fields are present and types match
