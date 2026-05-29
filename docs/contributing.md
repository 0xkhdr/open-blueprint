# 💻 Codebase Contributor Guide
Permalink: Codebase Contributor Guide

Welcome! This guide outlines how to set up, test, compile, and contribute improvements to the **open-blueprint (`bp`)** tool.

---

## 🛠️ Environment Setup
Permalink: Environment Setup

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
Permalink: Verification & Testing

Always verify your changes before proposing pull requests.

```bash
# Run the complete test suite (Unit, Integration, E2E, Snapshots)
npm test

# Check test coverage (requires Vitest v8 coverage tools)
npm run test:coverage

# Run Biome fast linting & formatting checks
npm run lint

# Auto-correct formatting errors
npm run lint:fix

# Run typescript compilation verification
npm run typecheck
```

---

## 💻 Running Locally in Dev Mode
Permalink: Running Locally in Dev Mode

To test CLI commands in real-time without building:

```bash
npm run dev -- --help
npm run dev -- init --tool claude --dry-run
```

---

## 🏗️ Compilation & Build
Permalink: Compilation & Build

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
Permalink: Architecture Decision Records (ADRs)

To maintain context and clarity for modular scaling, all major design architectural adjustments follow the ADR system:

* **[ADR-001] Logic-less Handlebars**: Transitioned from imperative scaffolding templates to highly secure, sandboxed Handlebars files to block malicious code executions.
* **[ADR-002] Tarjan SCC Validator**: Enforced Tarjan's Strongly Connected Components algorithm for logical skill verification to guarantee dependency safety at $O(V+E)$ speed.
* **[ADR-003] Block-level Preservation**: Introduced marker boundary tracking to allow safe, idempotent updates alongside custom developer code.
