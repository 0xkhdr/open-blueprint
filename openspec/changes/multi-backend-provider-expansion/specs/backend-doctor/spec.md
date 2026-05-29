## ADDED Requirements

### Requirement: `bp doctor --tool <id>` diagnoses a specific backend
`bp doctor` SHALL accept `--tool <backend-id>` and run diagnostic checks for that backend: skills directory existence and readability, command directory existence (if `supportsCommands`), expected workflow file presence, and file extension correctness.

#### Scenario: Healthy backend reports ok
- **WHEN** `bp doctor --tool claude` is run with a fully scaffolded `.claude/` directory
- **THEN** output reports `claude: healthy` with skill and command counts and no errors

#### Scenario: Missing skills directory
- **WHEN** `bp doctor --tool cursor` is run with no `.cursor/skills/` directory
- **THEN** output reports an error for the missing skills directory

#### Scenario: Unknown backend ID
- **WHEN** `bp doctor --tool unknowntool` is run
- **THEN** it exits non-zero with an error naming the unknown backend

### Requirement: `bp doctor --all` checks all backends in `.bp.json`
When `--all` is passed, `bp doctor` SHALL run diagnostics for every backend listed in the project's `.bp.json` `backends` field.

#### Scenario: All configured backends diagnosed
- **WHEN** `bp doctor --all` is run with `.bp.json` containing `backends: ["claude","cursor","kimi"]`
- **THEN** output includes a status entry for each of the three backends

#### Scenario: No .bp.json found
- **WHEN** `bp doctor --all` is run with no `.bp.json` in the project
- **THEN** it exits non-zero with an error instructing the user to run `bp init` first

### Requirement: codex doctor checks global path writability
When diagnosing `codex`, `bp doctor` SHALL verify that `$CODEX_HOME/prompts/` (or `~/.codex/prompts/`) exists and is writable.

#### Scenario: Codex global path missing
- **WHEN** `bp doctor --tool codex` is run and `~/.codex/prompts/` does not exist
- **THEN** it reports an error with the resolved path and instructions to create it or set `$CODEX_HOME`

### Requirement: github-copilot doctor emits IDE-only reminder
When diagnosing `github-copilot`, `bp doctor` SHALL always include a warning that generated command files require an IDE extension.

#### Scenario: Copilot healthy with warning
- **WHEN** `bp doctor --tool github-copilot` is run with `.github/prompts/` fully scaffolded
- **THEN** output reports healthy AND includes the IDE-only warning message
