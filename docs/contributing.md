# 💻 Codebase Contributor Guide

Welcome! This guide outlines how to set up, test, compile, and contribute improvements to the **open-blueprint (`bp`)** tool.

---

## 🛠️ Environment Setup

Ensure you have [Bun](https://bun.sh) (v1.1+) or [Node.js](https://nodejs.org) (v20+) installed before starting development.

```bash
# Clone the repository
git clone https://github.com/0xkhdr/open-blueprint.git
cd open-blueprint

# Install development dependencies
npm install
```

---

## 🧪 Verification & Testing

Always verify your changes before proposing pull requests.

```bash
# Run the test suite (unit + integration; e2e excluded)
npm test

# Run the e2e suite
npm run test:e2e

# Check test coverage (requires Vitest v8 coverage tools)
npm run test:coverage

# Run Biome fast linting & formatting checks
npm run lint

# Auto-correct formatting errors
npm run lint:fix

# Run typescript compilation verification
npm run typecheck

# Project-specific lint gates (no sync fs in hot paths, no interior process.exit, no require)
npm run lint:custom

# Everything CI runs (typecheck + lint + custom lints + coverage)
npm run ci
```

---

## 💻 Running Locally in Dev Mode

To test CLI commands in real-time without building:

```bash
npm run dev -- --help
npm run dev -- init --tool claude --dry-run
```

---

## 🏗️ Compilation & Build

To compile standard ES Modules for npm release:

```bash
npm run build
```

To compile single, standalone executables for your platform (requires Bun):

```bash
bun build --compile src/cli/index.ts --outfile bp
```

---

## 📋 Architecture Decision Records (ADRs)

Major design decisions are recorded as ADRs in [docs/adr/](adr/):

* **[ADR-001](adr/ADR-001-typescript.md)** — TypeScript over JavaScript
* **[ADR-002](adr/ADR-002-vitest.md)** — Vitest as the test framework
* **[ADR-003](adr/ADR-003-pino.md)** — Structured logging with Pino
* **[ADR-004](adr/ADR-004-commander.md)** — Commander as the CLI framework
* **[ADR-005](adr/ADR-005-zod.md)** — Zod for schema validation
* **[ADR-006](adr/ADR-006-handlebars.md)** — Logic-less Handlebars templates

Add a new ADR when a decision affects architecture, public contracts (exit codes,
schema versions, the plugin API), or a core dependency. See also
[AGENTS.md](../AGENTS.md) for codebase conventions and stable contracts.
