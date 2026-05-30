## ADDED Requirements

### Requirement: README Supported Backends table uses bp-prefixed command syntax
The `README.md` Supported Backends table SHALL use `bp`-prefixed command invocation syntax in the "Command Syntax" column. No cell in that column SHALL contain `opsx`, `openspec`, or any variant thereof.

#### Scenario: Colon-style backend shows bp prefix
- **WHEN** the README Supported Backends table is rendered
- **THEN** backends with colon syntax (claude, codex, amazon-q, etc.) SHALL show `/bp:<workflow>` pattern (e.g., `/bp:verify`)

#### Scenario: Hyphen-style backend shows bp prefix
- **WHEN** the README Supported Backends table is rendered
- **THEN** backends with hyphen syntax (cursor, cline, continue, etc.) SHALL show `/bp-<workflow>` pattern (e.g., `/bp-verify`)

#### Scenario: Bare-style backend shows bp prefix
- **WHEN** the README Supported Backends table is rendered
- **THEN** backends with bare syntax (gemini, qwen, trae) SHALL show `bp-<workflow>` pattern

#### Scenario: Skill-only backend shows bp prefix
- **WHEN** the README Supported Backends table is rendered
- **THEN** skill-only backends (kimi, forgecode) SHALL show `/skill:bp-<workflow>` pattern

### Requirement: supported-tools.md Command Syntax Reference table uses bp-prefixed patterns
The Command Syntax Reference table in `docs/supported-tools.md` SHALL use `bp`-prefixed patterns in the Pattern and Example columns. No Pattern or Example cell SHALL contain `opsx`, `openspec`, or any variant thereof.

#### Scenario: Colon row pattern and example are bp-prefixed
- **WHEN** the Command Syntax Reference table in supported-tools.md is rendered
- **THEN** the colon row SHALL show Pattern `/bp:<workflow>` and Example `/bp:verify`

#### Scenario: Hyphen row pattern and example are bp-prefixed
- **WHEN** the Command Syntax Reference table in supported-tools.md is rendered
- **THEN** the hyphen row SHALL show Pattern `/bp-<workflow>` and Example `/bp-verify`

#### Scenario: Bare row pattern and example are bp-prefixed
- **WHEN** the Command Syntax Reference table in supported-tools.md is rendered
- **THEN** the bare row SHALL show Pattern `bp-<workflow>` and Example `bp-verify`

#### Scenario: Skill row pattern and example are bp-prefixed
- **WHEN** the Command Syntax Reference table in supported-tools.md is rendered
- **THEN** the skill row SHALL show Pattern `/skill:bp-<workflow>` and Example `/skill:bp-verify`

### Requirement: Skill-Only Backends prose uses bp-prefixed invocation descriptions
The Skill-Only Backends section prose in `docs/supported-tools.md` SHALL describe invocation syntax using `bp`-prefixed patterns for Kimi, Trae, and Forge Code. No sentence in that section SHALL reference `openspec`.

#### Scenario: Kimi invocation description is bp-prefixed
- **WHEN** the Skill-Only Backends section is rendered
- **THEN** the Kimi entry SHALL read: Skill invocation syntax `/skill:bp-<workflow>`

#### Scenario: Trae invocation description is bp-prefixed
- **WHEN** the Skill-Only Backends section is rendered
- **THEN** the Trae entry SHALL read: Bare invocation syntax `bp-<workflow>`

#### Scenario: Forge Code invocation description is bp-prefixed
- **WHEN** the Skill-Only Backends section is rendered
- **THEN** the Forge Code entry SHALL read: Skill invocation syntax `/skill:bp-<workflow>`

### Requirement: Backend matrix paths for opsx-nested tools use tool-native flat paths
The Backend Compatibility Matrix in `docs/supported-tools.md` SHALL NOT contain `.opsx`-named directory segments in Skills Path or Commands Path columns. Affected backends: `codebuddy`, `costrict`, `crush`, `lingma`, `qoder`.

#### Scenario: codebuddy paths contain no opsx segment
- **WHEN** the Backend Compatibility Matrix is rendered
- **THEN** the codebuddy row Skills Path SHALL be `.codebuddy/skills` and Commands Path SHALL be `.codebuddy/commands`

#### Scenario: costrict paths contain no opsx segment
- **WHEN** the Backend Compatibility Matrix is rendered
- **THEN** the costrict row Skills Path SHALL be `.costrict/skills` and Commands Path SHALL be `.costrict/commands`

#### Scenario: crush paths contain no opsx segment
- **WHEN** the Backend Compatibility Matrix is rendered
- **THEN** the crush row Skills Path SHALL be `.crush/skills` and Commands Path SHALL be `.crush/commands`

#### Scenario: lingma paths contain no opsx segment
- **WHEN** the Backend Compatibility Matrix is rendered
- **THEN** the lingma row Skills Path SHALL be `.lingma/skills` and Commands Path SHALL be `.lingma/commands`

#### Scenario: qoder paths contain no opsx segment
- **WHEN** the Backend Compatibility Matrix is rendered
- **THEN** the qoder row Skills Path SHALL be `.qoder/skills` and Commands Path SHALL be `.qoder/commands`

### Requirement: Notes column for corrected backends uses neutral descriptions
Notes for `codebuddy`, `costrict`, `crush`, `lingma`, `qoder` backend rows SHALL NOT reference `opsx`. Notes SHALL either be empty or contain a neutral factual annotation.

#### Scenario: Notes no longer say Nested opsx
- **WHEN** the Backend Compatibility Matrix is rendered
- **THEN** no Notes cell for codebuddy, costrict, crush, lingma, or qoder SHALL contain the text `opsx`
