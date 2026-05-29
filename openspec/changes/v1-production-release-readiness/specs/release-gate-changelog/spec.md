## ADDED Requirements

### Requirement: CHANGELOG accurately presents v1.0.0 as the inaugural release
`CHANGELOG.md` SHALL NOT contain a `[2.0.0]` section. The first versioned section MUST be `[1.0.0]` describing the complete feature set being published. An `[Unreleased]` section MAY appear above it for post-tag work that has not yet been published.

#### Scenario: No 2.0.0 section exists
- **WHEN** `CHANGELOG.md` is read
- **THEN** the string `[2.0.0]` does not appear anywhere in the file

#### Scenario: 1.0.0 section is the first versioned entry
- **WHEN** `CHANGELOG.md` version sections are enumerated
- **THEN** the first versioned heading encountered is `[1.0.0]`

### Requirement: v1.0.0 CHANGELOG section covers all features present at release
The `[1.0.0]` section SHALL list all user-visible capabilities: core CLI commands (`init`, `verify`, `sync`, `convert`), backend adapters, 4-layer validation, template engine, exit codes, CI/CD pipeline, and test coverage milestone.

#### Scenario: All core capabilities appear in the 1.0.0 section
- **WHEN** the `[1.0.0]` CHANGELOG section is read
- **THEN** it mentions `bp init`, `bp verify`, `bp sync`, `bp convert`, backend adapters, validation layers, and Handlebars templating

### Requirement: semantic-release can prepend future entries without conflict
After the first `semantic-release` run, the tool SHALL be able to prepend a new `[1.0.0]` entry (or future patch entry) at the top of `CHANGELOG.md` without creating duplicate or conflicting headers.

#### Scenario: semantic-release run does not produce duplicate headers
- **WHEN** `npx semantic-release --dry-run` is executed post-fix
- **THEN** the simulated CHANGELOG output has no duplicate version headings
