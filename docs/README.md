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
* **[Getting Started](getting-started.md)**: 5-minute onboarding guide showing you how to install, initialize, and verify your first blueprint repository.
* **[Core Philosophy](philosophy.md)**: The underlying principles of `bp` (Scaffolding-only, Idempotent, Fail-loud, Backend-agnostic, Brownfield-first).
* **[Workflow Patterns](workflows.md)**: Practical guides and decision trees for solo developer flows, team patterns, and enterprise setups.
* **[Practical Recipes](recipes.md)**: High-density copy-paste scripts, CI integration templates, and developer snippets.

### 🏗️ Systems & Conceptual Architecture
Permalink: Systems & Conceptual Architecture
* **[Concepts & Architecture](concepts.md)**: Structural details covering the 5 Blueprint Layers, the 4 internal engines (Detector, Templater, Validator, Translator), Zod Fingerprints, and data pipelines.
* **[Observability & Cost Governance](observability.md)**: Declarative telemetry configuration, budget thresholds, Slack/PagerDuty alerting rules, and behavioral semantic drift triggers.
* **[Glossary of Terms](glossary.md)**: A dictionary and terminology index explaining Fingerprints, BlueprintIR, Block-Level Merges, and more.

### 💻 Reference Manuals
Permalink: Reference Manuals
* **[CLI Command Reference](commands.md)**: Detailed syntax blocks, options, arguments, and terminal outputs for every command in the `bp` CLI.
* **[Configuration Schema](configuration.md)**: Reference guide mapping global config properties (`~/.bp/config.json`) and repository configs (`.bp.json`).
* **[Diagnostics & Troubleshooting](troubleshooting.md)**: Diagnostic routines and a comprehensive mapping of exit codes (0-10) to symptoms and resolutions.

### 🔌 Developer & Platform Customization
Permalink: Developer & Platform Customization
* **[Plugin API Guide](plugin-api.md)**: A step-by-step developer manual for building custom Zod validators in TypeScript.
* **[Codebase Contributor Guide](contributing.md)**: Onboarding instructions for codebase contributors (Vitest setups, linting guidelines, Biome formatting, and Architecture Decision Records).
* **[Template Authoring Guide](template-authoring.md)**: Deep-dive into building Handlebars template packs, merges, and cryptographically signed packages.
* **[Custom Backend Adapters](backend-adapter.md)**: Guide to implementing target platform adapters utilizing the core `BlueprintIR` schema.
* **[Backend Feature Parity Matrix](backend-parity.md)**: Compatibility table outlining read/write support across all supported backend platforms.
* **[CI/CD Integration Checklist](ci-integration.md)**: Configuration details and integration guidelines for GitHub Actions, GitLab CI, and Azure Pipelines.

---

👉 **[Go to root README.md](../README.md)**
