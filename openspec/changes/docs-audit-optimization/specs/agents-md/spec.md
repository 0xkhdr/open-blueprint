## ADDED Requirements

### Requirement: agents.md exists at repo root
A file `agents.md` SHALL exist at the repository root. It SHALL be the authoritative reference for agent definitions, lifecycle, communication protocols, state management, error handling, and extension points across all supported backends.

#### Scenario: File present after implementation
- **WHEN** the repo root is listed
- **THEN** `agents.md` is present and non-empty

#### Scenario: File linked from root README
- **WHEN** root `README.md` is parsed
- **THEN** a link to `agents.md` is present

---

### Requirement: Agent lifecycle section
`agents.md` SHALL contain a section describing the complete agent lifecycle: creation (scaffold), activation, execution, and teardown. Each lifecycle stage SHALL include the relevant `bp` command or file that triggers it.

#### Scenario: All lifecycle stages documented
- **WHEN** `agents.md` is parsed for lifecycle stages
- **THEN** sections for scaffold, activation, execution, and teardown are all present

#### Scenario: CLI command cross-reference in lifecycle section
- **WHEN** the lifecycle section of `agents.md` is read
- **THEN** at least one `bp` CLI command (e.g., `bp init`, `bp verify`) is referenced with a link to `docs/commands.md`

---

### Requirement: Communication protocols section
`agents.md` SHALL document how agents communicate with each other and with the host environment. This SHALL include: tool invocation format, response schema, and any inter-agent delegation patterns supported by `bp`.

#### Scenario: Tool invocation format documented
- **WHEN** the communication protocols section is read
- **THEN** the expected tool call format (name, parameters, response) is shown in a code block

#### Scenario: Inter-agent delegation documented
- **WHEN** the communication protocols section is read
- **THEN** the mechanism for one agent delegating to another (e.g., skill invocation, sub-agent spawn) is described

---

### Requirement: State management section
`agents.md` SHALL document how agent state is persisted and retrieved. This SHALL include: the `.bp-fingerprint.json` role in state, session scope vs persistent scope, and how state survives `bp init` re-runs via `bp:preserve` blocks.

#### Scenario: Fingerprint role explained
- **WHEN** the state management section is read
- **THEN** `.bp-fingerprint.json` is described with its fields and how it tracks agent-relevant state

#### Scenario: bp:preserve interaction documented
- **WHEN** the state management section is read
- **THEN** the `bp:preserve` / `bp:end-preserve` block mechanism is described with an example

---

### Requirement: Error handling section
`agents.md` SHALL document how agents handle errors. This SHALL include: exit code semantics for agent-triggered failures, how validation errors surface to the agent runtime, and the recommended recovery pattern.

#### Scenario: Exit codes referenced
- **WHEN** the error handling section is read
- **THEN** relevant exit codes (from the bp exit code registry) are referenced with a link to `docs/troubleshooting.md`

#### Scenario: Recovery pattern documented
- **WHEN** the error handling section is read
- **THEN** a recommended pattern for agents to handle a non-zero exit from `bp verify` is shown

---

### Requirement: Extension points section
`agents.md` SHALL document the mechanisms available for extending agent behavior: custom validators (Plugin API), custom backend adapters, and hook scripts.

#### Scenario: Plugin API cross-reference present
- **WHEN** the extension points section is read
- **THEN** a link to `docs/plugin-api.md` is present

#### Scenario: Backend adapter cross-reference present
- **WHEN** the extension points section is read
- **THEN** a link to `docs/backend-adapter.md` is present

#### Scenario: Hook scripts mentioned
- **WHEN** the extension points section is read
- **THEN** the hooks layer (`.claude/hooks/`) is described as an extension mechanism

---

### Requirement: Backend compatibility table in agents.md
`agents.md` SHALL include a summary table showing which agent features (agents layer, skills layer, hooks layer) are supported per backend, sourced from the backend parity matrix.

#### Scenario: Compatibility table present
- **WHEN** `agents.md` is parsed for markdown tables
- **THEN** at least one table comparing agent feature support across backends (Claude, Cursor, Codex, etc.) is present

#### Scenario: Link to full parity matrix
- **WHEN** the compatibility table section is read
- **THEN** a link to `docs/backend-parity.md` is present for the full matrix

---

### Requirement: Code examples use valid bp syntax
All code examples in `agents.md` SHALL use syntactically valid `bp` CLI commands, YAML configuration, or Markdown frontmatter consistent with the project's current coding standards.

#### Scenario: CLI examples match commands reference
- **WHEN** CLI commands in `agents.md` code blocks are cross-referenced against `docs/commands.md`
- **THEN** every command exists in the CLI reference with matching option signatures

#### Scenario: YAML examples are valid YAML
- **WHEN** YAML code blocks in `agents.md` are parsed
- **THEN** all blocks parse without error
