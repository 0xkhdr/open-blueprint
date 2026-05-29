# 📂 open-blueprint (`bp`) — Documentation Suite
Permalink: open-blueprint (bp) — Documentation Suite

Welcome to the comprehensive developer and architect documentation suite for the **open-blueprint (`bp`)** repository governance tool. 

Our documentation is structured using a progressive-disclosure architecture, making it easy to find what you need whether you're a first-time user or an enterprise systems engineer.

---

## 🧭 Navigating the Docs
Permalink: Navigating the Docs

Explore the documentation suite organized by domain and developer persona:

### 🚀 Getting Started & Day-to-Day Use
Permalink: Getting Started & Day-to-Day Use
* **[Getting Started](01-getting-started.md)**: 5-minute onboarding guide showing you how to install, initialize, and verify your first blueprint repository.
* **[Core Philosophy](02-philosophy.md)**: The underlying principles of `bp` (Scaffolding-only, Idempotent, Fail-loud, Backend-agnostic, Brownfield-first).
* **[Workflow Patterns](03-workflows.md)**: Practical guides and decision trees for solo developer flows, team patterns, and enterprise setups.
* **[Practical Recipes](04-recipes.md)**: High-density copy-paste scripts, CI integration templates, and developer snippets.

### 🏗️ Systems & Conceptual Architecture
Permalink: Systems & Conceptual Architecture
* **[Concepts & Architecture](05-concepts.md)**: Structural details covering the 5 Blueprint Layers, the 4 internal engines (Detector, Templater, Validator, Translator), Zod Fingerprints, and data pipelines.
* **[Data Models Reference](19-data-models.md)**: Comprehensive schema reference covering the core Fingerprint, BlueprintIR, and ValidationResult structures.
* **[Observability & Cost Governance](06-observability.md)**: Declarative telemetry configuration, budget thresholds, Slack/PagerDuty alerting rules, and behavioral semantic drift triggers.
* **[Glossary of Terms](07-glossary.md)**: A dictionary and terminology index explaining Fingerprints, BlueprintIR, Block-Level Merges, and more.
* **[Non-Functional Requirements](17-nfrs.md)**: Performance budgets (command latency), reliability targets, and OWASP compliance statements.

### 💻 Reference Manuals
Permalink: Reference Manuals
* **[CLI Command Reference](08-commands.md)**: Detailed syntax blocks, options, arguments, and terminal outputs for every command in the `bp` CLI.
* **[Configuration Schema](09-configuration.md)**: Reference guide mapping global config properties (`~/.bp/config.json`) and repository configs (`.bp.json`).
* **[Diagnostics & Troubleshooting](10-troubleshooting.md)**: Diagnostic routines and a comprehensive mapping of exit codes (0-10) to symptoms and resolutions.
* **[Exit Code Registry](18-errors.md)**: Universal registry mapping every CLI exit code to detailed symptoms and resolution steps.

### 🔌 Developer & Platform Customization
Permalink: Developer & Platform Customization
* **[Plugin API Guide](11-plugin-api.md)**: A step-by-step developer manual for building custom Zod validators in TypeScript.
* **[Codebase Contributor Guide](12-contributing.md)**: Onboarding instructions for codebase contributors (Vitest setups, linting guidelines, Biome formatting, and Architecture Decision Records).
* **[Template Authoring Guide](13-template-authoring.md)**: Deep-dive into building Handlebars template packs, merges, and cryptographically signed packages.
* **[Custom Backend Adapters](14-backend-adapter.md)**: Guide to implementing target platform adapters utilizing the core `BlueprintIR` schema.
* **[Backend Feature Parity Matrix](15-backend-parity.md)**: Compatibility table outlining read/write support across all supported backend platforms.
* **[CI/CD Integration Checklist](16-ci-integration.md)**: Configuration details and integration guidelines for GitHub Actions, GitLab CI, and Azure Pipelines.

---

👉 **[Go to root README.md](../README.md)**
