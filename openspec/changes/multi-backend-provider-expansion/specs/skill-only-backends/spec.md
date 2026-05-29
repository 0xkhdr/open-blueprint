## ADDED Requirements

### Requirement: Skill-only backends generate no command files
For backends with `supportsCommands === false` (kimi, trae, forgecode), `bp init` and `bp convert` SHALL NOT create any command file directories or files.

#### Scenario: bp init for skill-only backend
- **WHEN** `bp init --tools kimi` is run
- **THEN** `.kimi/skills/` directories are created and no `.kimi/commands/` or equivalent directory exists

#### Scenario: bp init for trae
- **WHEN** `bp init --tools trae` is run
- **THEN** `.trae/skills/` directories are created with no command files

### Requirement: Skill-only SKILL.md files include invocation usage section
For skill-only backends, each generated `SKILL.md` SHALL include a `## Usage` section containing the correct invocation string for the backend's `commandSyntax`.

#### Scenario: kimi SKILL.md contains skill invocation
- **WHEN** `bp init --tools kimi` generates `.kimi/skills/openspec-propose/SKILL.md`
- **THEN** the file contains `## Usage` with `/skill:openspec-propose`

#### Scenario: trae SKILL.md contains bare invocation
- **WHEN** `bp init --tools trae` generates `.trae/skills/openspec-propose/SKILL.md`
- **THEN** the file contains `## Usage` with `/openspec-propose`

### Requirement: Validator rejects command files for skill-only backends
`bp verify` SHALL report an error if command files are found in a path associated with a skill-only backend.

#### Scenario: Unexpected command directory triggers error
- **WHEN** `bp verify` is run and `.kimi/commands/` exists
- **THEN** it reports a validation error: skill-only backend `kimi` must not have command files
