# 🍳 Practical Recipes & Use Cases

Permalink: Practical Recipes & Use Cases

This document compiles the most common developer recipes, CI/CD templates, and advanced configuration patterns for **open-blueprint (`bp`)**.

---

## 🧭 Recipe Selector

Permalink: Recipe Selector

Use this quick-scan matrix to find the exact setup for your current needs:

| If you want to... | Use this recipe | Core Commands / Keys |
|---|---|---|
| Configure a brand-new project for Claude | [1. TypeScript Bootstrapping](#1-bootstrapping-a-new-typescript-repository) | `bp init claude` |
| Block broken rules from entering main branch | [2. CI Verification](#2-ci-verification--drift-protection) | `--fail-on logical` |
| Get per-rule PR annotations + a measured compliance report | [2b. Governance Report in CI](#2b-governance-report--per-rule-pr-annotations) | `bp report --sarif` |
| Share configurations between Claude & Cursor | [3. Cross-Compilation](#3-cross-compile-claude-code-to-cursor) | `bp convert` |
| Enforce strict standards across multiple teams | [4. Enterprise Policy Inheritance](#4-enterprise-private-template-inheritance) | `"extends": "@myorg/base"` |

---

## 📝 Recipes Detailed

Permalink: Recipes Detailed

---

### 1. Bootstrapping a New TypeScript Repository

Permalink: Bootstrapping a New TypeScript Repository

Prepare a new repository for a Claude Code agent in under 10 seconds.

```bash
# 1. Initialize open-blueprint in the directory
npx @agentic/bp init claude

# 2. Inspect the generated directory scaffolding
# Renders:
#   ├── CLAUDE.md
#   ├── .claude/
#   │   ├── agents/ (planner.md, implementer.md, reviewer.md)
#   │   ├── rules/ (01-position.md, 02-security.md, 03-style.md, 04-meta.md)
#   │   └── skills/ (add-test.md, refactor-async.md)
#   └── .bp.json

# 3. Verify structural and semantic conformance
npx @agentic/bp verify --level all
```

---

### 2. CI Verification & Drift Protection

Permalink: CI Verification & Drift Protection

Enforce governance checks on every pull request using GitHub Actions. Create the following workflow file under `.github/workflows/blueprint-verify.yml`:

```yaml
name: "Verify Agent Governance"

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  validate-blueprint:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Dependencies
        run: npm ci

      - name: Verify Blueprint Integrity
        run: npx @agentic/bp verify --level all --fail-on logical
```

---

### 2b. Governance Report & Per-Rule PR Annotations

Permalink: Governance Report & Per-Rule PR Annotations

Go beyond pass/fail: `bp report` measures every governance rule against the repository
and emits SARIF that GitHub code scanning turns into per-rule PR annotations at the
violating `file:line`. Add this job next to the verification job above:

```yaml
  governance-report:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
      contents: read
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Governance report (gates on hard violations)
        run: npx @agentic/bp report --sarif report.sarif --fail-on hard

      - name: Upload SARIF for PR annotations
        if: always()
        uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: report.sarif
          category: bp-report
```

The same command produces a full machine-readable compliance document with
`--json report.json` — measured pass/fail/manual counts per installed pack, replacing
static coverage claims. Details: [Governance Reporting](governance-reporting.md);
exit codes: [troubleshooting](troubleshooting.md#bp-report-exit-codes).

---

### 3. Cross-Compile Claude Code to Cursor

Permalink: Cross-Compile Claude Code to Cursor

If your team uses both Claude Code and Cursor, you can translate the workspace configuration instantly:

```bash
# Convert Claude Code configuration to Cursor-native .cursorrules
bp convert --from claude --to cursor --output ./.cursor

# Verify structural integrity of newly created Cursor assets
bp verify ./.cursor --level structural
```

---

### 4. Enterprise Private Template Inheritance

Permalink: Enterprise Private Template Inheritance

Configure all microservices in your organization to inherit security constraints from a central package.

1. **Global Configuration Setup**:

   ```bash
   bp config set template_registry "https://npm.myorg-internal.net"
   ```

2. **Project Setup (`.bp.json`)**:
   Create a local configuration that extends the org template pack:

   ```json
   {
     "backend": "claude",
     "extends": "@myorg/blueprint-base",
     "overrides": {
       "rules": {
         "severity_defaults": "soft"
       }
     },
     "exclude": ["legacy/", "vendor/"]
   }
   ```

3. **Initialize Service**:

   ```bash
   bp init
   # Installs @myorg/blueprint-base, validates custom overrides, and merges blocks.
   ```
