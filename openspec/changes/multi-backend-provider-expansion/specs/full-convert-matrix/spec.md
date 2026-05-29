## ADDED Requirements

### Requirement: `bp convert` supports any pair of the 28 registered backends
`bp convert --from <id> --to <id>` SHALL accept any backend ID registered in the backend registry for both `--from` and `--to` arguments.

#### Scenario: Convert between two standard markdown backends
- **WHEN** `bp convert --from claude --to windsurf` is run in a repo with `.claude/` files
- **THEN** `.windsurf/` skills and workflows are created with content translated from the Claude blueprint

#### Scenario: Unknown source backend
- **WHEN** `bp convert --from unknowntool --to claude` is run
- **THEN** it exits non-zero with an error naming the unknown backend

### Requirement: Converting TO a skill-only backend strips command files
When the `--to` backend has `supportsCommands === false` (kimi, trae, forgecode), `bp convert` SHALL NOT generate command files and SHALL include usage invocation examples in each `SKILL.md` body.

#### Scenario: Convert to kimi produces skill files only
- **WHEN** `bp convert --from claude --to kimi` is run
- **THEN** `.kimi/skills/` directories are created and no `.kimi/commands/` directory exists

#### Scenario: Skill-only SKILL.md includes usage examples
- **WHEN** `bp convert --from claude --to kimi` is run
- **THEN** each generated `SKILL.md` contains a `## Usage` section with the `/skill:openspec-<id>` invocation string

### Requirement: Converting TO a TOML backend generates `.toml` command files
When the `--to` backend uses `fileExtension: ".toml"` (gemini, qwen), `bp convert` SHALL generate TOML-formatted command files.

#### Scenario: Convert to gemini generates TOML
- **WHEN** `bp convert --from claude --to gemini` is run
- **THEN** command files in `.gemini/commands/opsx/` have `.toml` extension and valid TOML syntax

### Requirement: Converting TO codex writes to global path
When the `--to` backend is `codex`, `bp convert` SHALL write command files to `$CODEX_HOME/prompts/` (or `~/.codex/prompts/` if `$CODEX_HOME` is unset) rather than the project root.

#### Scenario: Convert to codex uses global path
- **WHEN** `bp convert --from claude --to codex` is run with `CODEX_HOME=/tmp/codex-test`
- **THEN** command files are written to `/tmp/codex-test/prompts/` not to `./`

### Requirement: Converting FROM a skill-only backend generates command files for target
When `--from` backend has `supportsCommands === false`, `bp convert` SHALL use skill file content as the source and generate command files appropriate for the `--to` backend.

#### Scenario: Convert from forgecode to claude
- **WHEN** `bp convert --from forgecode --to claude` is run with `.forge/skills/` present
- **THEN** `.claude/commands/opsx/` command files are generated from the skill content
