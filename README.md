# open-blueprint (`bp`)

[![Version](https://img.shields.io/npm/v/@agentic/bp?color=blue)](https://www.npmjs.com/package/@agentic/bp)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![Build Status](https://img.shields.io/github/actions/workflow/status/0xkhdr/open-blueprint/ci.yml?branch=main)](https://github.com/0xkhdr/open-blueprint/actions)
[![Coverage](https://img.shields.io/badge/Coverage-95%25-brightgreen)](coverage)
[![Bun Supported](https://img.shields.io/badge/Bun-Supported-orange?logo=bun)](https://bun.sh)
[![LSP Enabled](https://img.shields.io/badge/LSP-Integrate-blueviolet)](src/lsp)

**open-blueprint (`bp`)** is a zero-runtime-overhead development and CI command-line utility that prepares software repositories for agentic AI tools (such as Claude Code, Cursor, OpenDev, and Goose) by scaffolding standardized governance structures, verifying their integrity, and actively detecting configuration drift.

By shifting governance to development-time and CI-time, `bp` keeps your production systems clean. It detects project topologies, scaffolds logic-less Handlebars templates, runs 4-layer validation gates, and translates files across agent platforms, letting you enforce strict, drift-proof constraints with absolute confidence.

```
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

## 🚀 Quick Start

Initialize your repository and verify blueprint rules instantly:

```bash
# 1. Scaffolding-only init (TypeScript, Go, Python frameworks auto-detected)
npx @agentic/bp init claude

# 2. Run 4-layer integrity verification
npx @agentic/bp verify
```

---

## 📖 Documentation

Our documentation is designed with progressive disclosure in mind. Read only what you need:

### Core Guides
* **[Getting Started](docs/01-getting-started.md)** — Install, scaffold, and configure your first blueprint in 5 minutes.
* **[Core Philosophy](docs/02-philosophy.md)** — The 5 core pillars of open-blueprint.
* **[Workflows & Guides](docs/03-workflows.md)** — Integration workflows for solo devs, team patterns, and enterprise setups.
* **[Diagnostics & Troubleshooting](docs/10-troubleshooting.md)** — Quick decoder for exit codes (0-10) and agent troubleshooting.

### Conceptual & Reference
* **[System Architecture](docs/05-concepts.md)** — Inside the 5 Blueprint Layers and the 4 internal execution engines.
* **[Data Models Reference](docs/19-data-models.md)** — Zod structure definitions and JSON details for Fingerprint and BlueprintIR schemas.
* **[Observability & Cost Governance](docs/06-observability.md)** — Telemetry configurations, budget thresholds, and semantic drift triggers.
* **[CLI Reference](docs/08-commands.md)** — Detailed option syntax blocks and examples for every CLI subcommand.
* **[Configuration System](docs/09-configuration.md)** — Schema definitions for global and repository settings files.
* **[Practical Recipes](docs/04-recipes.md)** — Copy-paste scripts and GitHub Action yaml CI/CD patterns.
* **[Terminology Index](docs/07-glossary.md)** — Term dictionary covering Fingerprints, IR, Block Merges, and Drift.
* **[Non-Functional Requirements](docs/17-nfrs.md)** — Latency budgets, reliability targets, and OWASP safety statements.
* **[Exit Code Registry](docs/18-errors.md)** — Full reference for all exit codes 0–10 with resolution steps.

### Advanced Customization
* **[Plugin Developer API](docs/11-plugin-api.md)** — Write custom TypeScript validators for company governance policies.
* **[Contributor Guidelines](docs/12-contributing.md)** — Development setup instructions, testing steps, and Architecture Decision Records (ADRs).
* **[Template Authoring Guide](docs/13-template-authoring.md)** — Build, merchandise, and cryptographically sign Handlebars template packages.
* **[Custom Backend Adapters](docs/14-backend-adapter.md)** — Implement target platform translation adapters using BlueprintIR.
* **[Backend Feature Parity Matrix](docs/15-backend-parity.md)** — Compatibility matrix outlining read/write support across all supported backend platforms.
* **[CI/CD Integration Guide](docs/16-ci-integration.md)** — Best practices for deploying verification rules on PR build gates.

---

## 💻 Supported Backends

Translate configurations across different editor and terminal environments seamlessly:

| Backend | Core File Pattern | Translation Fidelity | Target Environments |
|---|---|:---:|---|
| **Claude Code** | `.claude/` / `CLAUDE.md` | **100% (Native)** | Terminal Agent |
| **Cursor** | `.cursorrules` | **>98%** | IDE Integration |
| **OpenDev** | `.opendev/` | **>98%** | Autonomous Agent |
| **Goose** | `.goose/` | **>95%** | CLI Assistant |
| **Generic** | `.blueprint/` | **100%** | Agnostic Fallback |

---

## 📄 License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for full details.
