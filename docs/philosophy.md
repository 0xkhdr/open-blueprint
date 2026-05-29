# 🎯 Core Philosophy

Permalink: Core Philosophy

Welcome to the core philosophy of **open-blueprint (`bp`)**. This document explains the principles guiding the development of `bp` and why it is built the way it is.

---

## 💡 Core Principles

Permalink: Core Principles

The design and implementation of `bp` are guided by five fundamental pillars:

```text
scaffolding-only not invasive    — generates native configs, then bp can be uninstalled
idempotent not destructive       — block-level merging preserves manual edits
fail-loud not silent             — line-precise errors with actionable resolutions
backend-agnostic not locked      — IR enables Claude ↔ Cursor ↔ OpenDev translation
brownfield-first not greenfield  — detects existing repos, never assumes blank slate
```

---

## 🔍 The Principles Detailed

Permalink: The Principles Detailed

### 1. Scaffolding-Only & Zero-Runtime

Permalink: Scaffolding-Only & Zero-Runtime
Unlike invasive developer tools that lock you into proprietary runtimes or continuous licensing, `bp` operates entirely at development-time and CI-time. It scaffolds standard configuration files (like `CLAUDE.md`, `.cursorrules`) that agentic AI tools native to your IDE already understand and consume.

Once the files are initialized, you can uninstall `bp` completely. Your agents will continue to be governed by the standard, raw configurations.

### 2. Idempotency via Block-Level Merging

Permalink: Idempotency via Block-Level Merging
Manual edits are the lifeblood of a customized developer environment. Traditional scaffolders either overwrite your files entirely or refuse to update them, leading to configuration drift.

`bp` solves this with logic-less Handlebars templates and custom-crafted marker blocks:

* **Generated Blocks**: Clearly marked sections that `bp` safely replaces on subsequent runs to keep frameworks and tooling configurations up to date.
* **Preserve Blocks**: Dedicated regions (`<!-- bp:preserve -->`) designed specifically for your manual annotations, guidelines, and custom rules. These blocks are never touched by `bp` updates.

### 3. Fail-Loud Diagnostics

Permalink: Fail-Loud Diagnostics
Agentic AI can fail silently, misinterpreting rules or ignoring setup directories completely. `bp` enforces a rigorous 4-layer validation pipeline during local verification and CI. When an error is encountered—be it semantic scope issues, logical contradictions, or dependency drift—it fails loud, pinpointing the line-precise location and presenting actionable steps for remediation.

### 4. Backend-Agnostic Governance

Permalink: Backend-Agnostic Governance
The landscape of AI coding assistants is highly fragmented. One developer may use Claude Code, while another prefers Cursor, Goose, or OpenDev.

Instead of maintaining separate files and risking inconsistencies, `bp` utilizes a Zod-validated Intermediate Representation (`BlueprintIR`). This allows seamless conversion and synchronization across multiple formats while keeping fidelity above 98%.

### 5. Brownfield-First Design

Permalink: Brownfield-First Design
Most software projects are not started from scratch. `bp` is engineered with a "brownfield-first" approach. When run inside a repository, the Detector Engine immediately analyzes the lockfiles, directory structures, and frameworks to determine the exact project topology, language profiles, and package managers without assuming a blank slate.
