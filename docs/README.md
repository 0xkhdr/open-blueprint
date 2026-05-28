# open-blueprint (`bp`) — Documentation Suite

Welcome to the comprehensive developer and architect documentation suite for the **open-blueprint (`bp`)** repository governance tool.

---

## 📂 Core Guides & Architectural References

Explore the documentation suite organized by domain:

### 🏗️ Systems & Conceptual Architecture
* **[System Architecture Guide](architecture.md)**:
  Deep-dive into the core philosophy, the 5 Blueprint Layers, the 4 internal engines (Detector, Templater, Validator, Translator), data flows, Zod schemas, scoring heuristics, and block-level merge stability.

---

### 💻 Developer & Contributor References
* **[CLI Command & Exit Code Reference](cli-reference.md)**:
  Exhaustive CLI reference covering all commands (`init`, `verify`, `doctor`, `migrate`, `registry`), option structures, and precise semantic exit codes (Exit 0-10) for CI automation.
* **[Codebase Contributor Guide](developer-guide.md)**:
  Onboarding guide for codebase contributors. Explains setting up the development environment, running linters, Vitest test suites, fuzz testing with `fast-check`, and steps to extend fingerprint/validator schemas.

---

### 🎨 Custom Blueprints & Platform Integrations
* **[Template Authoring Guide](template-authoring.md)**:
  Learn how to build custom Handlebars-based blueprint template packs, utilize detection context variables, implement idempotent merge boundaries, and cryptographically archive and sign template packs using RSA keys.
* **[Custom Backend Adapters](backend-adapter.md)**:
  Step-by-step technical guide to implementing custom platform adapters (e.g. Cursor, Claude, Copilot) using the Intermediate Representation (`BlueprintIR` version 2.0 schema) and registering them with the translator pipeline.
* **[CI/CD Integration Guide](ci-integration.md)**:
  Step-by-step deployment checklists and workflows for GitHub Actions, GitLab CI/CD, and Azure Pipelines to enforce blueprint integrity in build gates.

---

👉 **[Go to root README.md](../README.md)**
