# 📖 Glossary of Terms

Permalink: Glossary of Terms

This document provides a dictionary of key terms, architectural definitions, and phrases used within **open-blueprint (`bp`)**.

---

## 🔤 Term Index

Permalink: Term Index

---

### Fingerprint

Permalink: Fingerprint

* **Definition**: A Zod-validated static analysis snapshot representing a repository's topology, language profiles, primary entry points, test commands, package managers, and safety signals.
* **Where Used**: Created by the [Detector Engine](concepts.md#1-detector-engine), cached in `.bp-fingerprint.json`, and evaluated by validation layers during [Drift Detection](concepts.md#3-validator-engine).

---

### BlueprintIR

Permalink: BlueprintIR

* **Definition**: The backend-agnostic Intermediate Representation used to represent the full AST (Abstract Syntax Tree) of a project's governance rules, files, personas, and skill blocks.
* **Where Used**: Utilized by the [Translator Engine](concepts.md#4-translator-engine) to parse configurations and compile them between platforms (e.g. Claude Code to Cursor).

---

### Block-Level Merge

Permalink: Block-Level Merge

* **Definition**: An update execution strategy designed to ensure idempotency. It isolates scaffolding updates inside designated generated blocks while keeping custom developer annotations intact inside preserve blocks (`<!-- bp:preserve -->`).
* **Where Used**: Orchestrated by the [Templater Engine](concepts.md#2-templater-engine) during `bp init` or `bp sync`.

---

### The 5 Layers

Permalink: The 5 Layers

* **Definition**: The structural division of agentic workspace governance: Spatial Anchor, Personas, Rules, Skills, and Hooks.
* **Where Used**: Defines the filesystem structure of active config directories (e.g., inside `.claude/`). See the [Blueprint Layers](concepts.md#-the-5-blueprint-layers) section in concepts guide.

---

### The 4 Engines

Permalink: The 4 Engines

* **Definition**: The modular sub-systems that compose the core pipeline: Detector, Templater, Validator, and Translator.
* **Where Used**: Runs behind the scenes for all CLI commands. See the [Internal Engines](concepts.md#-the-4-internal-engines) schema in concepts guide.

---

### Drift

Permalink: Drift

* **Definition**: Any detected deviation between the cached topological state (`.bp-fingerprint.json`) and the actual, live filesystem state (e.g. newly introduced packages, altered build runners, or unmapped directories).
* **Where Used**: Audited using `bp verify --level drift` or fixed with `bp sync`. See the [Workflows Guide](workflows.md#-workflow-pattern-table).

---

### Template Pack

Permalink: Template Pack

* **Definition**: A cryptographically signed collection of Handlebars templates mapping to specific repository setups (e.g., Python FastAPI, Go Fiber, TypeScript Express).
* **Where Used**: Distributed via NPM registries and installed using `bp template install`.

---

### Model Context Protocol (MCP)

* **Definition**: A standard protocol enabling AI models to safely and securely connect to external data sources and tools.
* **Where Used**: Managed via the `bp mcp` CLI subcommands to audit, inspect, and register MCP servers.

---

### Agent Registry

* **Definition**: A centralized database or local config tracking known agent signatures, configurations, and environment mappings.
* **Where Used**: Accessed and managed via the `bp agent` command suite.

---

### Semantic Drift

* **Definition**: High-level behavioral or statistical deviations in agent outputs, latencies, or token usage, occurring even when physical repository structures remain identical.
* **Where Used**: Audited via `bp verify --level drift` and `bp doctor` drift parameters.

---

### Preserve Block

* **Definition**: Custom comment sections (`<!-- bp:preserve -->` ... `<!-- bp:end-preserve -->`) that designate manual developer guidelines that the Templater Engine must not overwrite.
* **Where Used**: Used to maintain custom team guidelines across automated scaffolding syncs.

---

### Blueprint Marketplace

* **Definition**: A public or private organizational repository where signed blueprint templates are published and shared.
* **Where Used**: Accessed via `bp marketplace` subcommands.

---

### Check

Permalink: Check

* **Definition**: A declarative, Zod-validated condition attached to a rule (`check:` frontmatter) that bp can evaluate against the repository using only static filesystem and Fingerprint reads — file/content globs, frontmatter fields, `package.json` dependencies, JSON keys, and boolean composites (`allOf`/`anyOf`/`not`). See [Check](data-models.md#check).
* **Where Used**: Evaluated by `bp verify --level enforcement` and `bp rule test`; validated by `bp rule lint`.

---

### Enforcement

Permalink: Enforcement

* **Definition**: The validation layer that evaluates each rule's `check` against the real repository. Failing hard-severity checks are errors that fail the build; failing soft checks are warnings; results are summarized as `enforced` / `violations` / `manual` counts.
* **Where Used**: `bp verify --level enforcement` (also part of `--level all`, after logical and before drift).

---

### Manual rule

Permalink: Manual rule

* **Definition**: A rule bp cannot evaluate automatically — it has no `check`, declares `enforcement: manual`, or its check is unsupported in the repository's ecosystem. Reported as `RULE_MANUAL` (info-level); never counted as passing and never affects the exit code. It is a documented obligation for a human reviewer.
* **Where Used**: Reported by `bp verify --level enforcement` and `bp rule test`.

---

### Violation

Permalink: Violation

* **Definition**: A failed rule check (`RULE_VIOLATION`). Severity follows the rule: `hard` ⇒ error (non-zero exit), `soft` ⇒ warning. The message carries the rule id, action text, and the check outcome detail with up to 10 evidence locations; the resolution comes from the rule's `rationale` when present.
* **Where Used**: Emitted by the enforcement layer during `bp verify` and by `bp rule test`.

---

### Rule Pack

Permalink: Rule Pack

* **Definition**: A single YAML/JSON file (`*.bp-pack.{yaml,yml,json}`, schema `bp-pack/1`) bundling 1–200 related rules with identity metadata (id, semver version, framework, author, tags). Built-in compliance packs and client-authored packs share the same Zod schema; external pack data never enters the system unvalidated. See [Rule Packs](rule-packs.md).
* **Where Used**: `bp rule pack:create | pack:lint | pack:install | pack:remove | pack:list | pack:info | pack:search`; project packs live in `.bp/packs/`.

---

### Pack Lockfile

Permalink: Pack Lockfile

* **Definition**: `.bp/packs.lock.json` (schema `bp-pack-lock/1`) — the record of installed packs: id, version, source, rule count, install timestamp, a sha256 of the pack's canonical JSON, and per-generated-file content hashes (preserve blocks excluded). The drift layer cross-checks it (`PACK_FILE_MISSING` / `PACK_FILE_MODIFIED`).
* **Where Used**: Written by `bp rule pack:install`, consumed by `pack:remove`, `pack:list`, and `bp verify` (drift level).

---

### Materialization

Permalink: Materialization

* **Definition**: Turning a validated pack rule into an on-disk backend rule file (`pack-<packId>-<ruleId>.md` in the backend's rules dir) with full frontmatter, provenance keys, and bp-generated block markers — so installed pack rules flow through the same structural/semantic/logical/enforcement validation as scaffolded rules. Idempotent: re-installing without changes is a byte-equal no-op.
* **Where Used**: `bp rule pack:install`; verified by `bp verify`.

---

### Provenance

Permalink: Provenance

* **Definition**: The `pack_id` and `pack_version` frontmatter keys stamped into every materialized rule file, identifying which pack (and version) generated it. Provenance is what lets `--force` re-installs and `pack:remove` touch only a pack's own files, never foreign or hand-written rules.
* **Where Used**: Written during materialization; checked by `pack:install --force`, `pack:remove`, and the pack integrity drift check.

---

### Skill

Permalink: Skill

* **Definition**: A governance layer-4 artifact: a markdown file whose YAML frontmatter carries the `SkillSchema` fields (`name`, `description`, `when_to_use`, `tools_required`, optional `risk`/`id`/`disable_model_invocation`) and whose body is the numbered procedure the agent follows. Authored once in the canonical, backend-neutral format and translated to any backend through the IR. See [Skill Authoring](skill-authoring.md).
* **Where Used**: `bp skill new | lint | list | test`; validated by `bp verify` (semantic level, `SKILL_*` findings).

---

### Canonical Tool

Permalink: Canonical Tool

* **Definition**: An entry in the backend-neutral tool vocabulary (`read_file`, `write_file`, `edit_file`, `run_command`, `run_tests`, `search`, `web_fetch`, plus pass-through `mcp:<tool>` references). Skills declare `tools_required` canonically; per-backend alias maps translate to native names (e.g. `read_file` → `read` on claude, `file_read` on opendev), and each backend manifest's `tools` array is its capability list.
* **Where Used**: `src/translator/tools.ts`; checked by the skill validator (`SKILL_UNKNOWN_TOOL`) and resolved by `bp skill test`.

---

### Skill Pack

Permalink: Skill Pack

* **Definition**: A `bp-pack/1` file with `kind: skills`: 1–100 complete skill entries (procedure body included) sharing the rule-pack identity metadata, store resolution, lockfile, idempotent materialization (`pack-<packId>-<skillId>.md` in the backend's skills dir), and hash-guarded removal. Installed pack skills flow through the same skill validation as hand-written ones.
* **Where Used**: `bp skill pack:create | pack:lint | pack:install | pack:remove | pack:list`; recorded in `.bp/packs.lock.json` with `kind` and `skills_count`.
