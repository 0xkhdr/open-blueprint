# open-blueprint (`bp`) — CLI Command & Exit Code Reference

This document provides a comprehensive command-line reference for the `bp` utility, detailing all available commands, options, semantic exit codes, and the fail-loud diagnostic output system.

---

## 1. Commands and Options

The `bp` command-line structure is built using **Commander**.

### 1.1 `bp init [tool]`
Scaffolds a new blueprint environment by scanning the repository structure and applying matched template packs.

- **Parameters**: `tool` (Optional): The target AI assistant platform (e.g., `claude`, `cursor`, `copilot`, `gemini`, `generic`). Defaults to `claude`.
- **Options**:
  - `-f, --force`: Force overwrite existing blueprint files without block-level merging.
  - `-d, --dry-run`: Inspect actions in stdout without writing any files to disk.
  - `-t, --template <path>`: Supply a path to a local custom template pack instead of using auto-detection.
- **Example**:
  ```bash
  bp init claude --template ./my-corporate-template
  ```

---

### 1.2 `bp verify`
Runs the multi-layered validation pipeline on active blueprints to check structural, semantic, logical, drift, and governance compliance.

- **Options**:
  - `-l, --level <level>`: Set the maximum verification layer depth. Levels: `structural`, `semantic`, `logical`, `drift`, `governance`, `all`. Defaults to `all`.
  - `--fail-on <level>`: Trigger non-zero exit codes if errors are found at or above this layer.
  - `--json`: Output validation diagnostics as a structured JSON object for CI parsing.
- **Example**:
  ```bash
  bp verify --level logical --fail-on semantic
  ```

---

### 1.3 `bp doctor`
Performs detailed diagnostics on the repository environment and reads active configuration structures to trace schema compliance and tool compatibility.

- **Example**:
  ```bash
  bp doctor
  ```

---

### 1.4 `bp migrate <source> <target>`
Translates repository blueprints between different platform configurations without losing governance context.

- **Parameters**:
  - `source`: Active platform layout to read from (e.g., `claude`).
  - `target`: Output platform format to render (e.g., `cursor`).
- **Example**:
  ```bash
  bp migrate claude cursor
  ```

---

### 1.5 `bp registry <action>`
Manage custom blueprint template packs via the shared package registry.

- **Actions**:
  - `list`: Lists available templates.
  - `install <packageName>`: Downloads, verifies, and installs a template pack.
  - `publish <packageName> <version> <dir> <privateKey>`: Publishes a cryptographically signed template pack.
  - `keygen`: Generates a secure RSA-2048 key pair.
- **Example**:
  ```bash
  bp registry install @bp-templates/nestjs
  ```

---

## 2. CLI Exit Codes

`bp` uses rigorous, semantic exit codes during verification and operations. This enables CI/CD systems to handle failures gracefully.

| Code | Label | Trigger Event |
| :--- | :--- | :--- |
| **`0`** | `SUCCESS` | Operation or verification passed with zero hard errors. |
| **`1`** | `GENERAL_ERROR` | Syntax failures, missing arguments, or unhandled file exceptions. |
| **`2`** | `STRUCTURAL_FAILURE` | Broken Markdown syntax, invalid frontmatter YAML, UTF-8 decoding issues, or files exceeding sizes. |
| **`3`** | `SEMANTIC_FAILURE` | Invalid tool references, broken skill links, or rule scope globs matching zero files. |
| **`4`** | `LOGICAL_FAILURE` | Circular skill cycles detected, or overlapping rules directing contradicting actions. |
| **`5`** | `DRIFT_DETECTED` | Codebase topology fingerprint delta found, or new directories created without rule coverage. |
| **`6`** | `UNSUPPORTED_BACKEND` | Requested translation format is not supported by the adapters. |
| **`7`** | `TEMPLATE_NOT_FOUND` | Specified local or registry template pack cannot be located. |
| **`8`** | `PERMISSION_DENIED` | Operations halted by OS permission issues or read/write lockouts. |
| **`9`** | `REGISTRY_UNREACHABLE`| Network or API error occurred while connecting to the template registry. |
| **`10`**| `SIGNATURE_FAILED` | Cryptographic RSA public-key verification failed during template installation. |

---

## 3. Fail-Loud Diagnostic Reports

When verification fails, `bp` emits a clear, actionable diagnostic trace to `stderr` (or formatted as JSON when utilizing `--json`). Every error maps to a line-precise instruction to simplify troubleshooting.

### 3.1 Terminal Output Format
A typical structural or logical failure prints:

```
[bp verify] FAILED — 2 Errors, 1 Warning

✖ ERROR [STRUCTURAL_FAILURE]: Malformed frontmatter configuration.
  File: .claude/rules/style-conventions.md
  Line: 2, Column: 8
  Problem: Severity must be either "hard" or "soft", found "critical".
  Resolution: Update 'severity' in the rule YAML frontmatter to "hard" or "soft".

✖ ERROR [LOGICAL_FAILURE]: Circular skill dependencies detected.
  File: .claude/skills/deploy-service.md
  Problem: Skill cycle found: deploy-service.md -> run-tests.md -> build-assets.md -> deploy-service.md.
  Resolution: Decouple procedures. Circular skill structures cause infinite AI loops.

⚠ WARNING [DRIFT_DETECTED]: Uncovered directory found.
  Directory: src/payments/
  Problem: No active governance rule scope covers this newly created path.
  Resolution: Create a rule or amend an existing glob scope inside .claude/rules/ to cover src/payments/**.
```
