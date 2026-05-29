## ADDED Requirements

### Requirement: Global path backends write command files outside the project root
For backends with `globalHomeEnv` set (codex), `bp init` and `bp convert` SHALL resolve the command output path from the environment variable named in `globalHomeEnv`, falling back to `fallbackGlobalPath` if the variable is unset.

#### Scenario: CODEX_HOME set resolves to custom path
- **WHEN** `CODEX_HOME=/opt/codex` is set and `bp init --tools codex` is run
- **THEN** command files are written to `/opt/codex/prompts/`

#### Scenario: CODEX_HOME unset falls back to default
- **WHEN** `CODEX_HOME` is not set and `bp init --tools codex` is run
- **THEN** command files are written to `~/.codex/prompts/`

### Requirement: Global path is created if it does not exist
When a global path backend's target directory does not exist, `bp init` SHALL create it (including parent directories) after user confirmation.

#### Scenario: Missing global path created after confirmation
- **WHEN** `~/.codex/prompts/` does not exist and user confirms creation
- **THEN** the directory is created and command files are written to it

### Requirement: Skills for global path backends remain project-local
For backends with `globalHomeEnv` set, skill files SHALL still be written to the project-local `skillsPath` (e.g., `.codex/skills/`). Only command files use the global path.

#### Scenario: Codex skills in project, commands global
- **WHEN** `bp init --tools codex` is run
- **THEN** `.codex/skills/` exists in the project root AND command files are at `$CODEX_HOME/prompts/`
