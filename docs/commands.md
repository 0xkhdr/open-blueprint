# 💻 CLI Command Reference

This document provides a comprehensive reference for all 24 commands, arguments, and options available in the **open-blueprint (`bp`)** Command Line Interface (CLI).

---

## 📊 Command Quick Reference

| Command | Primary Purpose | Common Options / Arguments |
|---|---|---|
| [`bp init`](#bp-init) | Scaffolds standard blueprints for target agents | `[tool]`, `--force`, `--dry-run`, `--no-verify` |
| [`bp verify`](#bp-verify) | Validates blueprint structural and semantic integrity | `[paths...]`, `--level`, `--fix`, `--watch` |
| [`bp sync`](#bp-sync) | Checks for and resolves project structural drift | `--auto-apply`, `--report`, `--json` |
| [`bp convert`](#bp-convert) | Translates rules and tools across agent platforms | `--from`, `--to`, `--output` |
| [`bp dev`](#bp-dev) | Live reload dev server with real-time validation | `--watch`, `--level`, `--port`, `--dashboard` |
| [`bp docs`](#bp-docs) | Generate governance documentation from blueprint | `--format`, `--output` |
| [`bp diff`](#bp-diff) | Show semantic diff between two blueprints | `<file1> <file2>`, `--format`, `--ignore-metadata` |
| [`bp merge`](#bp-merge) | Three-way merge of blueprints with conflict detection | `<base> <ours> <theirs>`, `--output` |
| [`bp template`](#bp-template) | Installs and manages templates from internal registry | `list`, `install <pkg>`, `publish <path>` |
| [`bp doctor`](#bp-doctor) | Executes diagnostics and cost calculations | `--tool`, `--verbose`, `--cost` |
| [`bp rule`](#bp-rule) | Lints and graphs scope dependencies for rules | `lint <file>`, `test <file>`, `graph` |
| [`bp hook`](#bp-hook) | Generates and validates pre-execution agent scripts | `generate`, `validate <file>` |
| [`bp config`](#bp-config) | Modifies global user CLI default variables | `get <key>`, `set <key> <value>`, `reset` |
| [`bp update`](#bp-update) | Updates bp itself to the latest version | None |
| [`bp migrate`](#bp-migrate) | Migrates blueprint between backends/schema versions | `--from`, `--to`, `--schema-only` |
| [`bp agent`](#bp-agent) | Manages local agent registration | `list`, `register <name>`, `remove <name>` |
| [`bp mcp`](#bp-mcp) | Manages MCP server configurations | `list`, `add <name>`, `remove <name>` |
| [`bp team`](#bp-team) | Manages agent team configurations | `create`, `list`, `invite` |
| [`bp chain`](#bp-chain) | Manages agent chain configurations | `create`, `list`, `run` |
| [`bp memory`](#bp-memory) | Audits and governs persistent memory directories | `audit`, `prune`, `backup` |
| [`bp telemetry`](#bp-telemetry) | Configures and validates telemetry settings | `enable`, `disable`, `status` |
| [`bp cost`](#bp-cost) | Tracks and manages budgets and costs | `report`, `budget <limit>`, `attribution` |
| [`bp drift`](#bp-drift) | Run advanced semantic drift detection checks | `--level`, `--json`, `--report-only` |
| [`bp marketplace`](#bp-marketplace) | Browse and interact with blueprint marketplace | `search`, `install`, `publish` |

---

## 🚀 Commands Detailed

### `bp init`

Scaffolds a blueprint for the current repository based on detected framework topologies.

* **Arguments**: `[tool]` (claude, cursor, opendev, generic)
* **Options**:
  * `--tool <backend>`: Override positional backend tool
  * `--template <name>`: Force specific template pack
  * `--force`: Overwrite existing files
  * `--dry-run`: Preview changes without writing
  * `--no-verify`: Skip post-init validation
* **Example**: `bp init claude`
* **Error codes**: [3](troubleshooting.md#code-3) Config error · [9](troubleshooting.md#code-9) Path traversal · [1](troubleshooting.md#code-1) Unexpected error

### `bp verify`

Validates blueprint structural and semantic integrity.

* **Arguments**: `[paths...]`
* **Options**:
  * `--level <level>`: Validation depth (`structural`, `semantic`, `logical`, `drift`, `all`, default: `all`)
  * `--json`: Print machine-readable JSON (default: `false`)
  * `--fix`: Attempt auto-correction of structural anomalies
  * `--watch`: Watch files and re-validate on change
  * `--fail-on <level>`: Severity level to trigger non-zero exit code
* **Example**: `bp verify --level all --watch`
* **Error codes**: [4](troubleshooting.md#code-4) Structural · [5](troubleshooting.md#code-5) Semantic · [6](troubleshooting.md#code-6) Drift · [1](troubleshooting.md#code-1) Unexpected error

### `bp sync`

Detects and resolves repository structural drift.

* **Options**:
  * `--auto-apply`: Automatically apply safe structural/drift fixes
  * `--report`: Print the drift report only and exit
  * `--json`: Emit the drift report as machine-readable JSON
* **Example**: `bp sync --auto-apply`
* **Error codes**: [6](troubleshooting.md#code-6) Drift detected · [1](troubleshooting.md#code-1) Unexpected error

### `bp convert`

Translates blueprint governance configurations between backends.

* **Options**:
  * `--from <backend>`: Source backend (`claude`, `cursor`, `generic`)
  * `--to <backend>`: Target backend (`claude`, `cursor`, `generic`)
  * `--input <path>`: Source directory containing blueprints (default: `.`)
  * `--output <path>`: Target directory for translated outputs
* **Example**: `bp convert --from claude --to cursor --output ./translated-rules`
* **Error codes**: [7](troubleshooting.md#code-7) Translation error · [9](troubleshooting.md#code-9) Path traversal · [1](troubleshooting.md#code-1) Unexpected error

### `bp dev`

Live reload dev server with real-time validation and browser dashboard.

* **Options**:
  * `--watch <path>`: Directory to watch (default: `.`)
  * `--level <level>`: Validation level (structural|semantic|logical|drift|all, default: `all`)
  * `--port <port>`: Port for browser dashboard (default: `3456`)
  * `--dashboard`: Serve browser dashboard instead of terminal output
* **Example**: `bp dev --dashboard --port 4000`

### `bp docs`

Generate governance documentation from blueprint.

* **Options**:
  * `--format <format>`: Output format (markdown|html, default: `markdown`)
  * `--output <path>`: Target output file path
* **Example**: `bp docs --format markdown --output docs/GOVERNANCE.md`

### `bp diff`

Show semantic diff between two blueprints.

* **Arguments**: `<file1>` `<file2>`
* **Options**:
  * `-f, --format <format>`: Output format: text, json, markdown (default: `text`)
  * `--ignore-metadata`: Ignore metadata and optional layers
  * `--ignore-order`: Ignore array order
* **Example**: `bp diff base-blueprint.json target-blueprint.json --format markdown`

### `bp merge`

Three-way merge of blueprints with conflict detection and resolution.

* **Arguments**: `<base>` `<ours>` `<theirs>`
* **Options**:
  * `--output <path>`: Path to write the merged blueprint
* **Example**: `bp merge base.json ours.json theirs.json --output merged.json`

### `bp template`

Manage template packs.

* **Subcommands**:
  * `list`: List all official and locally installed template packs.
  * `install <pkg>`: Download, verify cryptographic signatures, and install a package.
  * `publish <path>`: Packages, cryptographically signs, and uploads a template pack.
* **Example**: `bp template install @bp-templates/fastapi`
* **Error codes**: [8](troubleshooting.md#code-8) Network error · [9](troubleshooting.md#code-9) Path traversal

### `bp doctor`

Diagnostic mode for troubleshooting agent ignores or configurations.

* **Options**:
  * `--tool <backend>`: Test configurations for a specific backend
  * `--verbose`: Output timing, path checks, and detailed trace logs
  * `--cost`: Include cost estimation report
* **Example**: `bp doctor --verbose --cost`
* **Error codes**: [3](troubleshooting.md#code-3) Config error · [1](troubleshooting.md#code-1) Unexpected error

### `bp rule`

Rule management utilities.

* **Subcommands**:
  * `lint <file>`: Check structural and glob scope validity for a rule.
  * `test <file>`: Dry-run a rule against mock filesystem scenarios.
  * `graph`: Renders an ASCII rule scope dependency and directory coverage map.
* **Example**: `bp rule lint .claude/rules/01-security.md`

### `bp hook`

Hook management.

* **Subcommands**:
  * `generate`: Scaffolds hook script stubs for the current active backend.
  * `validate <file>`: Runs static analysis on hook scripts to ensure safety.
* **Example**: `bp hook generate`
* **Error codes**: [4](troubleshooting.md#code-4) Hook safety failure · [9](troubleshooting.md#code-9) Path traversal

### `bp config`

Configuration management.

* **Subcommands**:
  * `get <key>`: View a configuration property.
  * `set <key> <value>`: Modify a configuration property.
  * `reset`: Revert all settings to system defaults.
* **Example**: `bp config set default_backend cursor`

### `bp update`

Update bp itself to the latest version.

* **Example**: `bp update`

### `bp migrate`

Migrate blueprint between backends or upgrade schema version.

* **Options**:
  * `--from <backend>`: Source backend platform
  * `--to <backend>`: Target backend platform
  * `--schema-only`: Only migrate configuration schemas, not backend conventions
* **Example**: `bp migrate --from claude --to cursor`

### `bp agent`

Manage local agent registry.

* **Subcommands**:
  * `list`: List all registered agents.
  * `register <name> <path>`: Add an agent configuration path.
  * `remove <name>`: Deregister an agent.
* **Example**: `bp agent list`

### `bp mcp`

Manage MCP server configurations.

* **Subcommands**:
  * `list`: List active MCP configurations.
  * `add <name>`: Add an MCP server config.
  * `remove <name>`: Remove an MCP server configuration.
* **Example**: `bp mcp list`

### `bp team`

Manage agent team configurations.

* **Subcommands**:
  * `create <name>`: Create a new agent team.
  * `list`: List agent teams.
  * `invite <agent>`: Invite an agent to join the active team.
* **Example**: `bp team list`

### `bp chain`

Manage agent chain configurations.

* **Subcommands**:
  * `create <name>`: Instantiate a new chain.
  * `list`: View all registered chains.
  * `run <name>`: Execute the designated chain.
* **Example**: `bp chain run research-and-write`

### `bp memory`

Audit and govern persistent memory directories.

* **Subcommands**:
  * `audit`: Scan memory directories for structural safety.
  * `prune`: Clean up orphaned or stale memory files.
  * `backup`: Back up memory indices.
* **Example**: `bp memory audit`

### `bp telemetry`

Telemetry configuration commands.

* **Subcommands**:
  * `enable`: Turn on global telemetry transmission.
  * `disable`: Turn off telemetry transmission.
  * `status`: View active provider status.
* **Example**: `bp telemetry status`

### `bp cost`

Cost tracking and budget commands.

* **Subcommands**:
  * `report`: Display current month usage estimates.
  * `budget <limit>`: Set monthly cost budget limits.
  * `attribution <level>`: Configure cost tracking attribution (agent|skill|rule).
* **Example**: `bp cost report`

### `bp drift`

Semantic drift detection commands.

* **Options**:
  * `--level <level>`: Set drift sensitivity level (low|medium|high)
  * `--json`: Format drift report as JSON
  * `--report-only`: Print report and skip auto-resolving drift
* **Example**: `bp drift --level high`

### `bp marketplace`

Browse and interact with blueprint marketplace.

* **Subcommands**:
  * `search <query>`: Search for template packs in the registry.
  * `install <pack>`: Download and register a pack.
  * `publish <dir>`: Package and submit a template.
* **Example**: `bp marketplace search fastapi`
* **Error codes**: [8](troubleshooting.md#code-8) Network error · [9](troubleshooting.md#code-9) Path traversal
