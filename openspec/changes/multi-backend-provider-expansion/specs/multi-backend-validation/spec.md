## ADDED Requirements

### Requirement: Validator applies backend-specific rules based on registry flags
`bp verify` SHALL run backend-specific validation rules when the relevant backend is present in `.bp.json` `backends`. Rules are gated by `appliesTo` matching a backend ID or `"all"`.

#### Scenario: Skill-only rule runs for kimi
- **WHEN** `bp verify` is run with `backends: ["kimi"]` and `.kimi/commands/` exists
- **THEN** it reports a logical validation error for the unexpected command directory

#### Scenario: TOML rule runs for gemini
- **WHEN** `bp verify` is run with `backends: ["gemini"]` and a `.toml` command file has syntax errors
- **THEN** it reports a structural validation error identifying the malformed file

#### Scenario: Copilot IDE-only warning always fires
- **WHEN** `bp verify` is run with `backends: ["github-copilot"]`
- **THEN** output contains a warning that copilot commands require an IDE extension, regardless of file state

### Requirement: Validator detects multi-backend config conflicts
When `.bp.json` contains multiple backends, `bp verify` SHALL check that no two backends produce conflicting governance constraints (e.g., one backend's rules require `hard` severity while another requires `soft` for the same rule ID).

#### Scenario: No conflict passes
- **WHEN** `bp verify` is run with two backends whose rule files have non-overlapping rule IDs
- **THEN** it passes the multi-backend conflict check

#### Scenario: Conflicting severity triggers error
- **WHEN** `bp verify` detects the same rule ID with `hard` severity in one backend and `soft` in another
- **THEN** it reports a logical validation error identifying the rule ID and the conflicting backends

### Requirement: Validator detects backend presence/absence drift
`bp verify` SHALL check that every backend in `.bp.json` `backends` has its expected skill and command directories present, and warn if a backend directory exists but is not listed in `backends`.

#### Scenario: Backend in config but files missing
- **WHEN** `.bp.json` lists `cursor` in `backends` but `.cursor/skills/` does not exist
- **THEN** it reports an error that cursor is configured but not scaffolded

#### Scenario: Backend files exist but not in config
- **WHEN** `.windsurf/` exists in the project but `windsurf` is not in `.bp.json` `backends`
- **THEN** it reports a warning that windsurf files were found but backend is not configured
