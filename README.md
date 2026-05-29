# open-blueprint (`bp`)

[![Version](https://img.shields.io/npm/v/@agentic/bp?color=blue)](https://www.npmjs.com/package/@agentic/bp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/0xkhdr/open-blueprint/ci.yml?branch=main)](https://github.com/0xkhdr/open-blueprint/actions)
[![Coverage](https://img.shields.io/badge/Coverage-95%25-brightgreen)](coverage)
[![Bun Supported](https://img.shields.io/badge/Bun-Supported-orange?logo=bun)](https://bun.sh)
[![LSP Enabled](https://img.shields.io/badge/LSP-Integrate-blueviolet)](src/lsp)

**open-blueprint (`bp`)** is a zero-runtime-overhead development and CI command-line utility that prepares software repositories for agentic AI tools (such as Claude Code, Cursor, OpenDev, and Goose) by scaffolding standardized governance structures, verifying their integrity, and actively detecting configuration drift.

By shifting governance to development-time and CI-time, `bp` keeps your production systems clean. It detects project topologies, scaffolds logic-less Handlebars templates, runs 4-layer validation gates, and translates files across agent platforms, letting you enforce strict, drift-proof constraints with absolute confidence.

```text
                  ┌──────────────────────────────┐
                  │            bp CLI            │
                  └──────────────┬───────────────┘
                                 │
          ┌───────────────────────┼───────────────────────┐
          ▼                       ▼                       ▼
  ┌──────────────┐        ┌──────────────┐        ┌──────────────┐
  │   DETECTOR   │        │  TEMPLATER   │        │  VALIDATOR   │
  │  (Repo MRI)  ├───────►│ (Handlebars) ├───────►│ (4-Layer QA) │
  └──────────────┘        └──────────────┘        └──────────────┘
                                                          │
                                                          ▼
                                                  ┌──────────────┐
                                                  │  TRANSLATOR  │
                                                  │(Backend Sync)│
                                                  └──────────────┘
```

---

## Quick Start

Initialize your repository and verify blueprint rules instantly:

```bash
# 1. Scaffolding-only init (TypeScript, Go, Python frameworks auto-detected)
npx @agentic/bp init claude

# 2. Run 4-layer integrity verification
npx @agentic/bp verify
```

---

## Documentation

Documentation follows a progressive-disclosure structure. Read only what you need.

### Core Guides

* **[Getting Started](docs/getting-started.md)** — Install, scaffold, and configure your first blueprint in 5 minutes.
* **[Core Philosophy](docs/philosophy.md)** — The 5 core pillars of open-blueprint.
* **[Workflows & Guides](docs/workflows.md)** — Integration workflows for solo devs, team patterns, and enterprise setups.
* **[Diagnostics & Troubleshooting](docs/troubleshooting.md)** — Exit codes 0–10 decoder and agent troubleshooting guide.
* **[Agent Reference](agents.md)** — Agent lifecycle, communication protocols, state management, error handling, and extension points.

### Conceptual & Reference

* **[System Architecture](docs/concepts.md)** — Inside the 5 Blueprint Layers and the 4 internal execution engines.
* **[Data Models Reference](docs/data-models.md)** — Zod structure definitions and JSON details for Fingerprint and BlueprintIR schemas.
* **[Observability & Cost Governance](docs/observability.md)** — Telemetry configurations, budget thresholds, and semantic drift triggers.
* **[CLI Reference](docs/commands.md)** — Detailed option syntax blocks and examples for every CLI subcommand.
* **[Configuration System](docs/configuration.md)** — Schema definitions for global and repository settings files.
* **[Practical Recipes](docs/recipes.md)** — Copy-paste scripts and GitHub Action YAML CI/CD patterns.
* **[Terminology Index](docs/glossary.md)** — Term dictionary covering Fingerprints, IR, Block Merges, and Drift.
* **[Non-Functional Requirements](docs/nfrs.md)** — Latency budgets, reliability targets, and OWASP safety statements.
* **[Documentation Style Guide](docs/style-guide.md)** — Authoring standards for contributing to this documentation.

### Advanced Customization

* **[Plugin Developer API](docs/plugin-api.md)** — Write custom TypeScript validators for company governance policies.
* **[Contributor Guidelines](docs/contributing.md)** — Development setup instructions, testing steps, and Architecture Decision Records.
* **[Template Authoring Guide](docs/template-authoring.md)** — Build, merchandise, and cryptographically sign Handlebars template packages.
* **[Custom Backend Adapters](docs/backend-adapter.md)** — Implement target platform translation adapters using BlueprintIR.
* **[Backend Feature Parity Matrix](docs/backend-parity.md)** — Compatibility matrix outlining read/write support across all supported backend platforms.
* **[CI/CD Integration Guide](docs/ci-integration.md)** — Best practices for deploying verification rules on PR build gates.

### Architecture Decision Records

* **[ADR-001: TypeScript](docs/adr/ADR-001-typescript.md)** — Why TypeScript over JavaScript.
* **[ADR-002: Vitest](docs/adr/ADR-002-vitest.md)** — Test framework selection.
* **[ADR-003: Pino](docs/adr/ADR-003-pino.md)** — Structured logging with Pino.
* **[ADR-004: Commander](docs/adr/ADR-004-commander.md)** — CLI framework selection.
* **[ADR-005: Zod](docs/adr/ADR-005-zod.md)** — Schema validation with Zod.
* **[ADR-006: Handlebars](docs/adr/ADR-006-handlebars.md)** — Template engine selection.

### API Reference

* **[Detector API](docs/api/detector.md)** — Repo topology detection interface.
* **[Templater API](docs/api/templater.md)** — Handlebars template rendering interface.
* **[Translator API](docs/api/translator.md)** — Backend translation adapter interface.
* **[Validator API](docs/api/validator.md)** — 4-layer validation engine interface.

---

## Supported Backends

Translate configurations across different editor and terminal environments seamlessly:

| Backend | Core File Pattern | Translation Fidelity | Target Environments |
|---|---|:---:|---|
| **Claude Code** | `.claude/` / `CLAUDE.md` | **100% (Native)** | Terminal Agent |
| **Cursor** | `.cursorrules` | **>98%** | IDE Integration |
| **OpenDev** | `.opendev/` | **>98%** | Autonomous Agent |
| **Goose** | `.goose/` | **>95%** | CLI Assistant |
| **Generic** | `.blueprint/` | **100%** | Agnostic Fallback |

---

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for full details.
