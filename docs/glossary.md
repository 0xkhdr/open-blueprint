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
