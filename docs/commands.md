# 💻 CLI Command Reference
Permalink: CLI Command Reference

This document provides a comprehensive reference for all commands, arguments, and options available in the **open-blueprint (`bp`)** Command Line Interface (CLI).

---

## 📊 Command Quick Reference
Permalink: Command Quick Reference

| Command | Primary Purpose | Common Options |
|---|---|---|
| [`bp init`](#bp-init) | Scaffolds standard blueprints for target agents | `--tool`, `--force`, `--dry-run` |
| [`bp verify`](#bp-verify) | Validates blueprint structural and semantic integrity | `--level`, `--fix`, `--watch` |
| [`bp sync`](#bp-sync) | Checks for and resolves project structural drift | `--auto-apply`, `--report` |
| [`bp convert`](#bp-convert) | Translates rules and tools across agent platforms | `--from`, `--to`, `--output` |
| [`bp template`](#bp-template) | Installs and manages templates from internal registry | `list`, `install`, `publish` |
| [`bp doctor`](#bp-doctor) | Troubleshoots agent ignores or configurations | `--tool`, `--verbose` |
| [`bp rule`](#bp-rule) | Lints and graphs scope dependencies for rules | `lint`, `test`, `graph` |
| [`bp hook`](#bp-hook) | Generates and validates pre-execution agent scripts | `generate`, `validate` |
| [`bp config`](#bp-config) | Modifies global user CLI default variables | `get`, `set`, `reset` |

---

## 🚀 Commands Detailed
Permalink: Commands Detailed

---

### `bp init`
Permalink: bp init

Scaffolds a blueprint for the current repository based on detected framework topologies.

**Best for:** First-time setup, new repos, switching backends

**Syntax:**
```bash
bp init [tool] [options]
```

**Arguments:**
* `tool`: The target agent backend (`claude`, `cursor`, `opendev`, `generic`).

**Options:**
| Option | Description | When to Use |
|---|---|---|
| `--tool <backend>` | Override positional tool argument | Scripting, CI pipelines |
| `--template <name>` | Force specific template pack | Non-standard project layouts |
| `--force` | Overwrite existing files | Re-scaffolding after major changes |
| `--dry-run` | Preview changes without writing | Review before applying |
| `--no-verify` | Skip post-init validation | Custom validation workflows |

**Examples:**
```bash
# Standard initialization for Claude Code
bp init claude

# Dry-run initialization to preview changes
bp init cursor --dry-run
```

---

### `bp verify`
Permalink: bp verify

Validates blueprint integrity across four strict evaluation layers.

**Syntax:**
```bash
bp verify [paths...] [options]
```

**Options:**
| Option | Description | Default |
|---|---|---|
| `--level <level>` | Validation depth (`structural`, `semantic`, `logical`, `drift`, `all`) | `all` |
| `--json` | Print machine-readable JSON | `false` |
| `--fix` | Attempt to auto-correct safe structural anomalies | `false` |
| `--watch` | Watch files and re-validate on change (debounced) | `false` |
| `--fail-on <level>` | Target severity level to trigger non-zero exit code | `logical` |

**Verification Dimensions Terminal Output:**
```
You: bp verify --level all

bp:  Verifying blueprint integrity...

     STRUCTURAL
     ✓ All YAML frontmatter valid
     ✓ Markdown syntax correct
     ✓ UTF-8 encoding confirmed

     SEMANTIC
     ✓ All skill references resolve
     ✓ Tool references exist in backend allowlist
     ✓ Scope globs match at least one file

     LOGICAL
     ✓ No circular skill dependencies (Tarjan SCC)
     ✓ No conflicting hard-rule overlaps
     ✓ Precedence declarations complete

     DRIFT
     ✓ Fingerprint matches current repo topology
     ✓ Entry points unchanged
     ✓ Test commands consistent

     SUMMARY
     ─────────────────────────────
     Critical issues: 0
     Warnings: 1 (legacy/ dir uncovered by rules)
     Exit code: 0 (with warnings)
```

---

### `bp sync`
Permalink: bp sync

Checks for repository drift and resolves differences interactively.

**Syntax:**
```bash
bp sync [options]
```

**Options:**
| Option | Description |
|---|---|
| `--auto-apply` | Automatically apply safe structural/drift fixes |
| `--report` | Print the drift report only and exit |
| `--json` | Emit the drift report as machine-readable JSON |

---

### `bp convert`
Permalink: bp convert

Translates blueprint governance configurations between backends.

**Syntax:**
```bash
bp convert [options]
```

**Options:**
| Option | Description | Required |
|---|---|---|
| `--from <backend>` | Source backend (`claude`, `cursor`, `generic`) | Yes |
| `--to <backend>` | Target backend (`claude`, `cursor`, `generic`) | Yes |
| `--input <path>` | Source directory containing blueprints (defaults to `.`) | No |
| `--output <path>` | Target directory for translated outputs | Yes |

**Example:**
```bash
bp convert --from claude --to cursor --output ./translated-rules
```

---

### `bp template`
Permalink: bp template

Manages blueprint template packs.

**Syntax:**
```bash
bp template <subcommand> [args]
```

**Subcommands:**
* `list`: List all official and locally installed template packs.
* `install <pkg>`: Download, verify cryptographic signatures, and install a package (e.g., `@bp-templates/fastapi`).
* `publish <path>`: Packages, cryptographically signs, and uploads a template pack to the registry.

---

### `bp doctor`
Permalink: bp doctor

Executes full diagnostics to troubleshoot why an agent may be ignoring configurations.

**Syntax:**
```bash
bp doctor [options]
```

**Options:**
| Option | Description |
|---|---|
| `--tool <backend>` | Test configurations for a specific backend |
| `--verbose` | Output timing, path checks, and detailed trace logs |

---

### `bp rule`
Permalink: bp rule

Manages individual rules.

**Syntax:**
```bash
bp rule <subcommand> [args]
```

**Subcommands:**
* `lint <file>`: Check structural and glob scope validity for a rule.
* `test <file>`: Dry-run a rule against mock filesystem scenarios to check behavior.
* `graph`: Renders an ASCII rule scope dependency and directory coverage map.

---

### `bp hook`
Permalink: bp hook

Manages hook integrations.

**Syntax:**
```bash
bp hook <subcommand> [args]
```

**Subcommands:**
* `generate`: Scaffolds hook script stubs for the current active backend.
* `validate <file>`: Runs static analysis on hook scripts to ensure they contain no dangerous APIs.

---

### `bp config`
Permalink: bp config

Manages global CLI configuration.

**Syntax:**
```bash
bp config <subcommand> [args]
```

**Subcommands:**
* `get <key>`: View a configuration property.
* `set <key> <value>`: Modify a configuration property.
* `reset`: Revert all settings to system defaults.
