## MODIFIED Requirements

### Requirement: `bp convert` accepts all 28 backend IDs for `--from` and `--to`
`bp convert --from <id> --to <id>` SHALL accept any backend ID from the registry. The valid ID list SHALL be derived from `listBackendIds()`.

#### Scenario: Convert between two new backends
- **WHEN** `bp convert --from roocode --to windsurf` is run
- **THEN** it proceeds to convert without an "unsupported backend" error

#### Scenario: Invalid --from exits with error
- **WHEN** `bp convert --from unknowntool --to claude` is run
- **THEN** it exits non-zero with an error naming the unknown ID

#### Scenario: Invalid --to exits with error
- **WHEN** `bp convert --from claude --to unknowntool` is run
- **THEN** it exits non-zero with an error naming the unknown ID
