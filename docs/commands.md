# CLI Command Reference

Complete reference for every `bp` command, generated against the actual CLI
(`bp <command> --help` is always authoritative). Exit codes referenced below are
documented in the [exit code registry](troubleshooting.md#exit-code-registry).

---

## Quick Reference

| Command | Purpose |
|---|---|
| [`bp init`](#bp-init) | Scaffold a blueprint for the current repository |
| [`bp verify`](#bp-verify) | Validate blueprint integrity (6 levels) |
| [`bp report`](#bp-report) | Measured governance posture: per-rule compliance, SARIF/JSON |
| [`bp sync`](#bp-sync) | Detect and resolve repository drift |
| [`bp convert`](#bp-convert) | Translate a blueprint between backends |
| [`bp dev`](#bp-dev) | Live-reload validation server + plugin scaffold/test |
| [`bp docs`](#bp-docs) | Generate governance documentation from the blueprint |
| [`bp diff`](#bp-diff) | Semantic diff between two blueprints |
| [`bp merge`](#bp-merge) | Three-way blueprint merge with conflict resolution |
| [`bp template`](#bp-template) | List, install, publish template packs |
| [`bp doctor`](#bp-doctor) | Diagnostics: backend config, secrets, compliance, cost |
| [`bp health`](#bp-health) | Environment/CI health checks |
| [`bp rule`](#bp-rule) | Rule utilities + rule pack management |
| [`bp skill`](#bp-skill) | Skill authoring, validation, skill packs |
| [`bp hook`](#bp-hook) | Hook generation, listing, removal, safety validation |
| [`bp config`](#bp-config) | User-level configuration (`~/.bp/config.json`) |
| [`bp update`](#bp-update) | Self-update bp |
| [`bp migrate`](#bp-migrate) | Cross-backend migration + `.bp.json` schema upgrade |
| [`bp agent`](#bp-agent) | Agent registry: list, validate, add |
| [`bp mcp`](#bp-mcp) | MCP servers: list, validate, risk report |
| [`bp team`](#bp-team) | Agent teams: list, validate |
| [`bp chain`](#bp-chain) | Agent chains: list, validate DAGs |
| [`bp memory`](#bp-memory) | Memory directory audit and cleanup |
| [`bp telemetry`](#bp-telemetry) | Detect telemetry platform, generate config snippet |
| [`bp cost`](#bp-cost) | Cost dashboard, budget, attribution |
| [`bp drift`](#bp-drift) | Multi-backend file drift + behavioral drift from metrics |
| [`bp adopt`](#bp-adopt) | Bring user-authored files under ownership tracking |
| [`bp emit`](#bp-emit) | Serialize a BlueprintIR back to governance files |
| [`bp marketplace`](#bp-marketplace) | Search npm for blueprint template packages |
| [`bp pack`](#bp-pack) | Publish signed pack artifacts; install plugin artifacts |
| [`bp trust`](#bp-trust) | Manage the local trust keyring |

---

## `bp init`

Scaffold a blueprint for the current repository based on the detected topology.

- **Arguments**: `[tool]` — a backend ID (see [Supported Tools](supported-tools.md))
- **Options**:
  - `--tool <backend>` — alias for the positional argument
  - `--tools <ids>` — comma-separated backend IDs, or `all`
  - `--template <name>` — use a specific template pack
  - `--force` — overwrite existing blueprint files
  - `--dry-run` — show a diff of what would be generated
  - `--no-verify` — skip post-init validation
  - `--interactive` — interactive setup wizard
  - `--confirm-global` — confirm writes to global paths (e.g. `$CODEX_HOME`) without prompting; needed for `codex` in CI
  - `--json` — machine-readable output
- **Examples**: `bp init claude` · `bp init --tools claude,cursor,windsurf` · `bp init --tools all`
- **Exit codes**: [2](troubleshooting.md#code-2) unknown backend · [3](troubleshooting.md#code-3) config error · [9](troubleshooting.md#code-9) path traversal · [1](troubleshooting.md#code-1) unexpected

## `bp verify`

Validate blueprint integrity across six levels: `structural`, `semantic`,
`logical`, `enforcement`, `drift`, `governance` (default `all`).

- **Arguments**: `[paths...]` — one or more repository paths
- **Options**:
  - `--level <level>` — `structural | semantic | logical | enforcement | drift | governance | all`
  - `--json` — machine-readable JSON output
  - `--format <format>` — `json | sarif`
  - `--fix` — auto-correct unambiguous structural issues
  - `--watch` — re-validate on file change (debounced 300 ms)
  - `--fail-on <level>` — exit non-zero only at this severity level (default `logical`)
  - `--entropy-scan` — enable entropy-based secret detection (also `scan.entropyEnabled` in `.bp.json`)
  - `--no-plugins` — skip plugin validators configured in `.bp.json`
- **Enforcement level**: evaluates each rule's declarative [`check`](data-models.md#check)
  against the repository. Failing hard checks → errors (`RULE_VIOLATION`); failing soft
  checks → warnings; rules without a check → `RULE_MANUAL` (info, never affects exit
  code); malformed checks → `RULE_CHECK_INVALID` errors.
- **Examples**: `bp verify` · `bp verify --level enforcement` · `bp verify --format sarif > out.sarif`
- **Exit codes**: [4](troubleshooting.md#code-4) structural · [5](troubleshooting.md#code-5) semantic · [6](troubleshooting.md#code-6) drift (only when explicitly requested) · [1](troubleshooting.md#code-1) unexpected

## `bp report`

Measured governance posture: per-rule enforcement outcomes, per-pack measured
pass/fail/manual counts, pack integrity, SARIF for code scanning. See
[Governance Reporting](governance-reporting.md).

- **Arguments**: `[path]` (default `.`)
- **Options**: `--json [file]` · `--sarif [file]` · `--fail-on hard|soft|none` (default `hard`) · `--framework <id>` · `--snapshot` (writes `.bp/report-snapshot.json`)
- **Exit codes**: see [bp report exit codes](troubleshooting.md#bp-report-exit-codes)

## `bp sync`

Detect and resolve repository drift.

- **Options**: `--auto-apply` (apply all safe fixes) · `--report` (report only, no changes) · `--json`
- **Exit codes**: [6](troubleshooting.md#code-6) drift · [1](troubleshooting.md#code-1) unexpected

## `bp convert`

Translate a blueprint between backends through the `BlueprintIR`.

- **Options**: `--from <backend>` · `--to <backend>` · `--input <path>` (default `.`) · `--output <path>` (default: same as input) · `--json`
- **Example**: `bp convert --from claude --to cursor --output ./.cursor`
- **Exit codes**: [7](troubleshooting.md#code-7) translation · [9](troubleshooting.md#code-9) path traversal

## `bp dev`

Live-reload dev server with real-time validation and optional browser dashboard.

- **Options**: `--watch <path>` (default `.`) · `--level <level>` (`structural|semantic|logical|drift|all`) · `--port <port>` (default `3456`) · `--dashboard`
- **Subcommands**:
  - `plugin:scaffold <name>` — scaffold a runnable validator plugin (`plugins/<name>.mjs`; `--dir <dir>` to change). Refuses to overwrite. See [Plugin API](plugin-api.md).
  - `plugin:test <pluginPath>` — run one plugin against the current repository; `--mode isolated|inline` (default `isolated`). Exits non-zero if the plugin reports errors.

## `bp docs`

Generate governance documentation from the blueprint.

- **Subcommand**: `generate` — `--output <path>` (default `./blueprint-docs`) · `--json`
- **Example**: `bp docs generate --output ./blueprint-docs`

## `bp diff`

Semantic diff between two blueprint files.

- **Arguments**: `<file1> <file2>`
- **Options**: `-f, --format text|json|markdown` (default `text`) · `--ignore-metadata` · `--ignore-order`

## `bp merge`

Three-way merge of blueprints with conflict detection.

- **Arguments**: `<base> <ours> <theirs>`
- **Options**: `-o, --output <file>` · `-s, --strategy ours|theirs|deep|interactive` (default `deep`) · `--allow-partial`
- **Example**: `bp merge base.json ours.json theirs.json -o merged.json`

## `bp template`

Manage template packs.

- **Subcommands**:
  - `list` — list available packs; `--registry <url>` (default `https://registry.npmjs.org`). Enumerates the template packs bundled with bp on disk plus registry results.
  - `install <pkg>` — install a template pack; `--registry <url>`
  - `publish <path>` — package and sign a template pack; `--name <name>`, `--ver <version>`, `--private-key <key>` (all required), `--registry <url>`, `--token <token>`
- **Honest limitation**: there is no live bp-hosted template registry. `publish`
  signs with real RSA crypto but the legacy in-memory registry path is test-only
  (enabled by `BP_REGISTRY_MOCK=1`). For distributing rule/skill/plugin packs, use
  [`bp pack`](#bp-pack) with a static host — see [Pack Distribution](pack-distribution.md).
- **Exit codes**: [8](troubleshooting.md#code-8) network · [9](troubleshooting.md#code-9) path traversal

## `bp doctor`

Diagnostics for backend configuration and project posture.

- **Options**:
  - `--tool <backend>` — diagnose one backend
  - `--all` — diagnose all backends configured in `.bp.json`
  - `--verbose` — full diagnostic trace with timing
  - `--secret-scan` — scan project files for leaked secrets
  - `--compliance-report [framework]` — compliance gap report (`gdpr`, `soc2`, `hipaa`)
  - `--risk-audit` — risk tier classification and escalation runbook
  - `--env-template` — generate `.env.template` from `process.env` references
  - `--cost` — include cost estimation report (configuration-driven; bp does not meter live token usage)
  - `--json`
- **Exit codes**: [3](troubleshooting.md#code-3) config · [1](troubleshooting.md#code-1) unexpected

## `bp health`

Environment/CI health checks: config parseability, engine importability, registry
reachability, config conflicts.

- **Options**: `--json` — `{ status, checks[], version, correlationId }`
- **Exit codes**: 0 all pass · [10](troubleshooting.md#code-10) any check failed

## `bp rule`

Rule utilities and rule pack management. See [Rule Packs](rule-packs.md).

- **Subcommands**:
  - `test <file>` — dry-run a rule against the repository: prints scope-glob matches; when the rule has a `check`, evaluates it and prints PASS/FAIL with evidence (up to 10 locations). Exit 0 on pass, 4 for a failing hard rule, 0 + warning for a failing soft rule; rules without a check print `manual`.
  - `lint <file>` — validate rule syntax, scope pattern, and `check` frontmatter (Zod, line-precise `RULE_CHECK_INVALID`).
  - `graph` — ASCII map of rule scope coverage.
  - `install <framework>` — install a built-in compliance pack (`gdpr`, `soc2`, `hipaa`); `--dry-run`, `--json`.
  - `pack:create <id>` — scaffold `.bp/packs/<id>.bp-pack.yaml`; `--from-rules <glob>` harvests existing rules, `--force` overwrites.
  - `pack:lint <path>` — validate a pack file (schema, duplicate ids, per-rule checks); `--json`.
  - `pack:install <ref>` — install from built-in id, project pack id, file path, `https`/`github:` artifact ref, or registry id; `--force`, `--dry-run`, `--allow-unsigned` (remote artifacts).
  - `pack:remove <id>` — delete the pack's generated files + lockfile entry; refuses on hand-edits unless `--force`.
  - `pack:list` · `pack:info <ref>` · `pack:search <query>`

## `bp skill`

Author, validate, and share skills (governance layer 4). See [Skill Authoring](skill-authoring.md).

- **Subcommands**:
  - `new <name>` — scaffold into the active backend's skills dir; `--description`, `--tools <a,b>` (canonical vocabulary), `--risk low|medium|high`, `--backend`.
  - `lint [glob]` — validate skill files (schema, collisions, unknown tools, procedure quality, vague triggers, stale paths); `--json`, `--backend`.
  - `list` — skills with risk, tools, provenance (`scaffolded | pack:<id> | manual`); `--json`, `--backend`.
  - `test <file>` — static dry-run: tool resolution, capability check, translator round-trip; `--backend <b>`.
  - `pack:create <id>` · `pack:lint <path>` · `pack:install <ref>` · `pack:remove <id>` · `pack:list` — skill-pack (`kind: skills`) equivalents of the rule pack commands, same flags.

## `bp hook`

Hook management for the active backend.

- **Subcommands**:
  - `generate` — scaffold hook stubs.
  - `list` — hooks with trigger, command, enabled status; `--json`.
  - `remove <name>` — delete a hook file; `-y, --yes` skips confirmation.
  - `validate [file]` — advisory static safety analysis (pattern-based denylist: process execution, network, dynamic code, secret leaks). Not a sandbox — passing raises confidence, it cannot prove safety against deliberate obfuscation. `--cycle-check` runs hook dependency cycle detection instead.

## `bp config`

User-level configuration in `~/.bp/config.json` (see [Configuration](configuration.md)).

- **Subcommands**: `get <key>` · `set <key> <value>` · `reset`
- **Example**: `bp config set registry.url https://packs.example.com/index.json`

## `bp update`

Update bp itself to the latest version.

## `bp migrate`

Cross-backend migration or `.bp.json` schema upgrade.

- **Options**: `--from <backend>` · `--to <backend>` (claude|cursor|codex|pi|kiro|antigravity|copilot|gemini|opendev|generic) · `--input <path>` · `--output <path>` · `--report` (write markdown migration report) · `--json` (migration plan)
- **Subcommand**: `config` — upgrade `.bp.json` from v1 (`backend` string) to v2 (`backends` array + `primary_backend`); `--dry-run`, `--json`.

## `bp agent`

Agent registry management (entries live in the blueprint).

- **Subcommands**:
  - `list` — registered agents; `--json`
  - `validate` — validate registry entries; `--json`, `--dry-run`
  - `add <name>` — add an agent; `--owner <owner>`, `--purpose <purpose>`, `--risk-tier low|medium|high|critical`, `--dry-run`, `--json`

## `bp mcp`

MCP server configuration governance.

- **Subcommands**: `list` · `validate` (risk scores and auth scopes) · `risk-report` — all support `--json`; `validate`/`risk-report` support `--dry-run`

## `bp team`

Agent team configurations.

- **Subcommands**: `list` · `validate` — `--json`, `--dry-run`

## `bp chain`

Agent chain configurations.

- **Subcommands**: `list` · `validate` (detects cycles and unresolved references in chain DAGs) — `--json`, `--dry-run`

## `bp memory`

Audit and govern persistent memory directories.

- **Subcommands**:
  - `audit` — size, retention, encryption compliance; `--dir <path>` (default `.claude/memory`), `--max-size <mb>` (default `100`), `--retention session|day|week|persistent` (default `week`), `--require-encryption`, `--json`, `--dry-run`
  - `cleanup` — remove files exceeding the retention policy; `--dir`, `--retention`, `--json`, `--dry-run`

## `bp telemetry`

Telemetry configuration helpers (bp does not transmit telemetry itself).

- **Subcommands**:
  - `detect [project-root]` — auto-detect telemetry platform from project dependencies; `--json`
  - `init [project-root]` — generate a telemetry config snippet; `--platform <platform>` overrides detection; `--json`

## `bp cost`

Cost tracking and budgets. Figures are computed from values configured in the
blueprint's `cost` section — bp does not meter live token usage.

- **Subcommands**:
  - `report [project-root]` — cost dashboard; `--json`, `--output <file>` (markdown)
  - `budget [limit] [project-root]` — show or set monthly budget; `--json`
  - `attribution [level] [project-root]` — show or set attribution (`agent|skill|rule`); `--json`

## `bp drift`

Drift detection. (File-fingerprint drift also runs inside `bp verify --level drift`.)

- **Subcommands**:
  - `backends` — detect file drift across all backends in `.bp.json`; `--save-baseline` records the current state; `--json`
  - `baseline` — build a behavioral baseline from real runtime metrics; `--metrics <ndjson>` (required), `--window <days>` (default `7`), `--json`
  - `behavioral` — compare current metrics against a baseline; `--baseline <file>` and `--current <file>` (required), `--threshold <0-1>` (default `0.15`), `--json`
  - `semantic` — hidden, deprecated alias for `behavioral`

## `bp adopt`

Bring existing user-authored rules/skills/agents under bp ownership tracking
(`.bp/manifest.json`).

- **Arguments**: `[path]` (default `.`)
- **Options**: `--status` (classify managed/modified/untracked, no changes) · `--wrap` (wrap adopted bodies in `bp:preserve` markers) · `--dry-run` · `--json`

## `bp emit`

Serialize a `BlueprintIR` back to governance files (round-trip), honoring
`bp:preserve` markers, ownership, and path safety.

- **Arguments**: `[path]` (default `.`)
- **Options**: `--input <file>` (read IR from JSON) · `--from <backend>` · `--force` (overwrite files lacking bp markers) · `--dry-run` · `--json`

## `bp marketplace`

Discover blueprint template packages on the public npm registry (packages tagged
with `backend:`, `framework:`, `risk:`, `compliance:` keywords).

- **Subcommand**: `search [query]` — `--backend`, `--framework`, `--risk-tier`, `--compliance`, `--official` (only the `@bp-templates` scope — an honest namespace check, not an audit), `--json`
- Installing/publishing is handled by [`bp template`](#bp-template), not `bp marketplace`.

## `bp pack`

Publish and manage signed pack artifacts (rules, skills, plugins). See
[Pack Distribution](pack-distribution.md).

- **Subcommands**:
  - `keygen <name>` — RSA keypair under `~/.bp/keys/` (private key `0600`, never overwritten)
  - `publish <file>` — build a signed `.bp-pack.tgz` from a pack file or plugin `.mjs` bundle; `--key <private.pem>` (required), `--out <dir>`, `--id`/`--version`/`--publisher` (plugin publishes)
  - `index:build <dir>` — assemble `*.index-entry.json` snippets into a signed `index.json`/`index.sig`; `--key <private.pem>` (required), `--base-url <url>`
  - `plugin:install <ref>` — install a plugin artifact (https URL, `github:` ref, `.bp-pack.tgz` path, or registry id); `--allow-unsigned` (prints a security warning — plugins execute code), `--dry-run`

## `bp trust`

Manage the local trust keyring (`~/.bp/trust.json`) for signed artifacts.

- **Subcommands**: `add <name> <pubkeyPath>` · `list [--json]` · `remove <name>`
