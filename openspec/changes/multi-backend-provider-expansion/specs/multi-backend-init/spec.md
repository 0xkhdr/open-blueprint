## ADDED Requirements

### Requirement: `bp init` accepts `--tools` flag with comma-separated backend IDs
`bp init` SHALL accept a `--tools <ids>` option where `<ids>` is a comma-separated list of valid backend IDs. When `--tools` is provided, `bp` SHALL scaffold skills and commands for each listed backend and write `.bp.json` with `backends: [<ids>]`.

#### Scenario: Single backend via --tools
- **WHEN** `bp init --tools claude` is run non-interactively
- **THEN** `.claude/` skills and commands directories are created and `.bp.json` has `backends: ["claude"]`

#### Scenario: Multiple backends via --tools
- **WHEN** `bp init --tools claude,cursor,windsurf` is run
- **THEN** `.claude/`, `.cursor/`, and `.windsurf/` directories are scaffolded and `.bp.json` has `backends: ["claude","cursor","windsurf"]`

#### Scenario: Unknown backend ID in --tools
- **WHEN** `bp init --tools claude,unknowntool` is run
- **THEN** it exits with a non-zero code and prints an error listing the unknown ID and valid options

### Requirement: `--tools all` scaffolds all 28 backends
When `--tools all` is passed, `bp init` SHALL scaffold skills and commands for all 28 backends registered in the backend registry.

#### Scenario: All backends scaffolded
- **WHEN** `bp init --tools all` is run
- **THEN** directories for all 28 backends are created and `.bp.json` has `backends` containing all 28 IDs

#### Scenario: --tools all dry run
- **WHEN** `bp init --tools all --dry-run` is run
- **THEN** it prints the list of files that would be created without writing any files

### Requirement: codex in --tools triggers confirmation
When `codex` is in the tools list, `bp init` SHALL warn that commands will be written outside the project root and require explicit confirmation (interactive prompt in TTY; `--confirm-global` flag in CI).

#### Scenario: Codex requires confirmation in interactive mode
- **WHEN** `bp init --tools codex` is run in a TTY
- **THEN** it prints the resolved `$CODEX_HOME` path and prompts for confirmation before writing

#### Scenario: Codex accepts --confirm-global in CI
- **WHEN** `bp init --tools codex --confirm-global` is run
- **THEN** it writes to the resolved codex path without interactive prompt

### Requirement: github-copilot in --tools emits IDE-only warning
When `github-copilot` is in the tools list, `bp init` SHALL emit a warning that generated command files are only usable in IDE extensions (VS Code, JetBrains, Visual Studio) and not in Copilot CLI.

#### Scenario: Copilot warning printed
- **WHEN** `bp init --tools github-copilot` is run
- **THEN** stdout contains the text "GitHub Copilot commands require an IDE extension"
