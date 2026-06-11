# 💻 CLI Command Reference

This document provides a comprehensive reference for all 24 commands, arguments, and options available in the **open-blueprint (`bp`)** Command Line Interface (CLI).

---

## 📊 Command Quick Reference

| Command | Primary Purpose | Common Options / Arguments |
|---|---|---|
| [`bp init`](#bp-init) | Scaffolds standard blueprints for target agents | `[tool]`, `--force`, `--dry-run`, `--no-verify` |
| [`bp verify`](#bp-verify) | Validates blueprint structural and semantic integrity | `[paths...]`, `--level`, `--fix`, `--watch` |
| [`bp sync`](#bp-sync) | Checks for and resolves project structural drift | `--auto-apply`, `--report`, `--json` |
| [`bp adopt`](#bp-adopt) | Brings user-authored rules/skills/agents under ownership tracking | `[path]`, `--status`, `--wrap`, `--dry-run`, `--json` |
| [`bp emit`](#bp-emit) | Serializes a BlueprintIR back to governance files (round-trip) | `[path]`, `--input`, `--from`, `--force`, `--dry-run`, `--json` |
| [`bp convert`](#bp-convert) | Translates rules and tools across agent platforms | `--from`, `--to`, `--output` |
| [`bp dev`](#bp-dev) | Live reload dev server with real-time validation | `--watch`, `--level`, `--port`, `--dashboard` |
| [`bp docs`](#bp-docs) | Generate governance documentation from blueprint | `--format`, `--output` |
| [`bp diff`](#bp-diff) | Show semantic diff between two blueprints | `<file1> <file2>`, `--format`, `--ignore-metadata` |
| [`bp merge`](#bp-merge) | Three-way merge of blueprints with conflict detection | `<base> <ours> <theirs>`, `--output` |
| [`bp template`](#bp-template) | Installs and manages templates from internal registry | `list`, `install <pkg>`, `publish <path>` |
| [`bp doctor`](#bp-doctor) | Executes diagnostics and cost calculations | `--tool`, `--verbose`, `--cost` |
| [`bp rule`](#bp-rule) | Lints and graphs scope dependencies for rules; manages rule packs | `lint <file>`, `test <file>`, `graph`, `pack:create`, `pack:lint`, `pack:install` (`--allow-unsigned` for remote artifacts), `pack:remove`, `pack:list` |
| [`bp skill`](#bp-skill) | Authors, validates, dry-runs, and shares skills; manages skill packs | `new <name>`, `lint [glob]`, `list`, `test <file>`, `pack:create`, `pack:lint`, `pack:install` (`--allow-unsigned` for remote artifacts), `pack:remove`, `pack:list` |
| [`bp pack`](#bp-pack) | Publishes signed pack artifacts and installs plugin artifacts (see [docs/pack-distribution.md](pack-distribution.md)) | `keygen <name>`, `publish <file> --key <pem>`, `index:build <dir> --key <pem>`, `plugin:install <ref>` |
| [`bp trust`](#bp-trust) | Manages the local keyring for verifying signed pack artifacts | `add <name> <pub.pem>`, `list`, `remove <name>` |
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
| [`bp marketplace`](#bp-marketplace) | Discover blueprint template packages on npm | `search` |

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
  * `--level <level>`: Validation depth (`structural`, `semantic`, `logical`, `enforcement`, `drift`, `governance`, `all`, default: `all`)
  * `--json`: Print machine-readable JSON (default: `false`)
  * `--fix`: Attempt auto-correction of structural anomalies
  * `--watch`: Watch files and re-validate on change
  * `--fail-on <level>`: Severity level to trigger non-zero exit code
  * `--entropy-scan`: Enable entropy-based high-entropy string detection (opt-in; also configurable via `scan.entropyEnabled: true` in `.bp.json`)
  * `--no-plugins`: Skip plugin validators configured in `.bp.json` (see [Plugin API](plugin-api.md))
* **Example**: `bp verify --level all --watch`
* **Example**: `bp verify --entropy-scan`
* **Example**: `bp verify --level enforcement`
* **Enforcement level**: evaluates each rule's declarative `check` against the repository (see [Check](data-models.md#check)). Failing hard-severity checks are errors (`RULE_VIOLATION`, non-zero exit); failing soft checks are warnings; rules without a check are reported as `RULE_MANUAL` (info) and never affect the exit code; malformed checks are `RULE_CHECK_INVALID` errors. The result summary reports `enforced` / `violations` / `manual` counts (included in `--json` output).
* **Error codes**: [4](troubleshooting.md#code-4) Structural · [5](troubleshooting.md#code-5) Semantic · [6](troubleshooting.md#code-6) Drift · [1](troubleshooting.md#code-1) Unexpected error

### `bp sync`

Detects and resolves repository structural drift.

* **Options**:
  * `--auto-apply`: Automatically apply safe structural/drift fixes
  * `--report`: Print the drift report only and exit
  * `--json`: Emit the drift report as machine-readable JSON
* **Example**: `bp sync --auto-apply`
* **Error codes**: [6](troubleshooting.md#code-6) Drift detected · [1](troubleshooting.md#code-1) Unexpected error

### `bp adopt`

Brings existing user-authored rules, skills, and agents under bp ownership tracking
(records them in `.bp/manifest.json`) so later commands can tell managed files from
developer-modified or untracked ones.

* **Arguments**: `[path]` — project path (default: `.`)
* **Options**:
  * `--status`: Report managed/modified/untracked status without making changes
  * `--wrap`: Wrap adopted file bodies in `bp:preserve` markers
  * `--dry-run`: Preview changes without writing
  * `--json`: Machine-readable JSON output
* **Example**: `bp adopt --status`
* **Error codes**: [1](troubleshooting.md#code-1) Unexpected error

### `bp emit`

Serializes a `BlueprintIR` back to the backend's governance files (round-trip), honoring
`bp:preserve` markers, `.blueprintignore`, path safety, and ownership.

* **Arguments**: `[path]` — project path (default: `.`)
* **Options**:
  * `--input <file>`: Read IR from a JSON file instead of parsing the project
  * `--from <backend>`: Backend to parse the current project as
  * `--force`: Overwrite files that lack bp markers
  * `--dry-run`: Preview writes without modifying disk
  * `--json`: Machine-readable JSON output
* **Example**: `bp emit --from claude --dry-run`
* **Error codes**: [1](troubleshooting.md#code-1) Unexpected error (path-safety violations in the writer are caught and reported as a general command failure)

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
* **Subcommands**:
  * `bp dev plugin:scaffold <name>`: Scaffold a runnable validator plugin (`plugins/<name>.mjs` by default; `--dir <dir>` to change). Refuses to overwrite existing files. See [Plugin API](plugin-api.md).
  * `bp dev plugin:test <pluginPath>`: Run a single plugin against the current repository and print its diagnostics. `--mode isolated|inline` (default `isolated`). Exits non-zero if the plugin reports errors.

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
  * `lint <file>`: Check structural and glob scope validity for a rule, including Zod validation of any `check` frontmatter (`RULE_CHECK_INVALID` with line numbers).
  * `test <file>`: Dry-run a rule against the real repository. Prints scope-glob matches, then — when the rule has a `check` — evaluates it and prints PASS/FAIL with a detail message and up to 10 evidence locations. Exit codes: 0 on pass, validation failure (4) for a failing hard rule, 0 with a warning for a failing soft rule. Rules without a check print `manual — bp cannot evaluate this rule automatically`.
  * `graph`: Renders an ASCII rule scope dependency and directory coverage map.
  * `pack:create <id>`: Scaffolds a commented pack template at `.bp/packs/<id>.bp-pack.yaml`. `--from-rules <glob>` harvests existing rule files' frontmatter into the pack; `--force` overwrites an existing pack file.
  * `pack:lint <path>`: Validates a pack file — `bp-pack/1` schema (every Zod issue path listed on failure), duplicate rule ids, and per-rule `check` conditions. `--json` for machine-readable output. Exits non-zero on any error.
  * `pack:install <ref>`: Resolves a pack (file path → project pack id → built-in id) and materializes one rule file per rule into the active backend's rules dir (`pack-<packId>-<ruleId>.md`), recording the install in `.bp/packs.lock.json`. Idempotent by default (existing files kept); `--force` replaces the pack's own generated files only; `--dry-run` previews.
  * `pack:remove <id>`: Deletes the pack's generated rule files and lockfile entry. Refuses when files were hand-edited outside preserve blocks unless `--force`.
  * `pack:list`: Lists built-in packs, project packs (`.bp/packs/`), and installed packs with versions.
  * `pack:info <ref>`: Shows pack details (source, rules with severity and auto/manual enforcement).
  * `pack:search <query>`: Searches built-in and project packs by name, description, or tags.
* **Example**: `bp rule lint .claude/rules/01-security.md`
* **See also**: [Rule Packs guide](rule-packs.md)

### `bp skill`

Skill authoring and governance (layer 4). Skills use the canonical format (SkillSchema frontmatter + procedure body) and flow through the same validation `bp verify` runs.

* **Subcommands**:
  * `new <name>`: Scaffolds a skill into the active backend's skills directory. Flags: `--description <text>`, `--tools <a,b>` (canonical vocabulary), `--risk low|medium|high`, `--backend <b>`. Refuses name collisions; the output passes `bp skill lint` by construction.
  * `lint [glob]`: Runs the skill validation table (schema, collisions, unknown tools, procedure quality, vague triggers, stale paths) over the matched files (default: the backend's skills dir). `--json` for machine output. Exits 3 on errors.
  * `list`: Table of skills with name, risk, tools, provenance (`scaffolded | pack:<id> | manual`), and file path. `--json` supported.
  * `test <file>`: Static dry-run — prints canonical → backend tool resolution, runs the validation checks against the target backend's capability list, and round-trips the skill through the translator (`--backend cursor` etc.), reporting any fidelity loss explicitly.
  * `pack:create <id>`: Scaffolds a `kind: skills` pack at `.bp/packs/<id>.bp-pack.yaml`.
  * `pack:lint <path>`: Validates a skill pack (schema, kind, duplicate skill ids). `--json` supported.
  * `pack:install <ref>`: Materializes one skill file per entry (`pack-<packId>-<skillId>.md`) into the backend's skills dir and records the install in `.bp/packs.lock.json`. `--force`, `--dry-run`, `--backend` as for rule packs.
  * `pack:remove <id>`: Deletes the pack's generated skill files and lockfile entry (hash-guarded; `--force` to override).
  * `pack:list`: Lists project and installed skill packs.
* **Example**: `bp skill new deploy-check --tools read_file,run_command --risk low`
* **Error codes**: [3](troubleshooting.md#code-3) Semantic failure · [1](troubleshooting.md#code-1) Unexpected error
* **See also**: [Skill Authoring guide](skill-authoring.md)

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

Discover blueprint template packages published on the public npm registry.
Template packs are ordinary npm packages tagged with `backend:`, `framework:`,
`risk:`, and `compliance:` keywords.

* **Subcommands**:
  * `search [query]`: Search npm for blueprint template packages. Supports
    `--backend`, `--framework`, `--risk-tier`, `--compliance`, `--official`, and
    `--json` filters. Network/registry errors are surfaced, not silently swallowed.
* **Example**: `bp marketplace search fastapi --official`
* **Note**: Installing and publishing template packs is handled by
  [`bp template`](#bp-template), not `bp marketplace`.
* **Error codes**: [8](troubleshooting.md#code-8) Network error · [9](troubleshooting.md#code-9) Path traversal

### `bp pack`

Publish and install signed pack artifacts (Stage 5 — see
[docs/pack-distribution.md](pack-distribution.md)).

* **Subcommands**:
  * `keygen <name>`: Generate an RSA signing keypair under `~/.bp/keys/`
    (private key written with `0600`; refuses to overwrite).
  * `publish <file> --key <private.pem> [--out <dir>]`: Validate a pack file
    (or `.mjs` plugin bundle with `--id`, `--version`, `--publisher`), build the
    signed `bp-artifact/1` tarball, and write an `index-entry.json` snippet.
  * `index:build <dir> --key <private.pem> [--base-url <url>]`: Assemble the
    published index entries in a directory into a signed `index.json`/`index.sig`.
  * `plugin:install <ref>`: Install a plugin artifact from an https URL,
    `github:` ref, local `.bp-pack.tgz`, or registry id. Unsigned plugins
    require `--allow-unsigned` and print a security warning (plugins execute code).
* **Example**: `bp pack publish .bp/packs/security.bp-pack.yaml --key ~/.bp/keys/acme.pem --out dist/`

### `bp trust`

Manage the local trust keyring (`~/.bp/trust.json`) used to verify signed
artifacts and registry indexes.

* **Subcommands**:
  * `add <name> <pubkey.pem>`: Trust a publisher's public key.
  * `list [--json]`: Show the configured keys and signature policy.
  * `remove <name>`: Stop trusting a key.
* **Example**: `bp trust add acme-platform ./acme-platform.pub`
