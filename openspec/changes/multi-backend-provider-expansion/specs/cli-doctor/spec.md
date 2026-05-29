## MODIFIED Requirements

### Requirement: `bp doctor` gains `--tool` and `--all` flags
`bp doctor` SHALL accept `--tool <backend-id>` for single-backend diagnostics and `--all` to check all backends in `.bp.json`. Existing behavior (no flags) SHALL remain unchanged.

#### Scenario: --tool with valid ID runs single check
- **WHEN** `bp doctor --tool claude` is run
- **THEN** only claude diagnostics are run and reported

#### Scenario: --all runs diagnostics for all configured backends
- **WHEN** `bp doctor --all` is run with `backends: ["claude","cursor","kimi"]` in `.bp.json`
- **THEN** diagnostics run for all three and the output has three status sections

#### Scenario: No flag defaults to existing behavior
- **WHEN** `bp doctor` is run with no flags
- **THEN** it runs diagnostics using the `primary_backend` from `.bp.json`
