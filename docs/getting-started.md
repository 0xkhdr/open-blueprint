# 🚀 Getting Started

Permalink: Getting Started

Welcome to the 5-minute onboarding guide for **open-blueprint (`bp`)**. This document will take you from installation to active repository governance.

---

## 🚦 Prerequisites & Installation

Permalink: Prerequisites & Installation

To run `bp`, ensure you have Node.js (v20+) or Bun (v1.1+) installed in your workspace.

```bash
# Install globally via npm
npm install -g @agentic/bp

# Or run instantly without installation via npx
npx @agentic/bp --help
```

---

## ⏱️ The 5-Minute Walkthrough

Permalink: The 5-Minute Walkthrough

### Step 1: Initialize Your Project

Permalink: Step 1: Initialize Your Project

Navigate to your project directory and run `bp init` to analyze your repository and scaffold a customized blueprint structure:

```bash
bp init claude
```

**See it in action:**

```text
You: bp init claude
bp:  Detecting repository...
     ✓ TypeScript (Express) detected (confidence: 1.0)
     ✓ Scaffolding CLAUDE.md
     ✓ Scaffolding .claude/agents/
     ✓ Scaffolding .claude/rules/
     ✓ Scaffolding .claude/skills/
     ✓ Writing .bp-fingerprint.json
     Ready for agent governance!
```

---

### Step 2: Verify Your Blueprint

Permalink: Step 2: Verify Your Blueprint

Enforce validation layers immediately to ensure that all rules, tools, and skill definitions are logically correct:

```bash
bp verify
```

**See it in action:**

```text
You: bp verify
bp:  Validating blueprint...
     ✓ Structural: 12 files passed
     ✓ Semantic: All scopes resolve
     ✓ Logical: No circular dependencies
     ✓ Drift: Repository matches fingerprint
     All checks passed!
```

---

### Step 3: Customize Rules (Idempotent Merging)

Permalink: Step 3: Customize Rules (Idempotent Merging)

Open the newly generated `.claude/rules/01-position.md` file. You'll see structured blocks. Add your custom instructions inside a `bp:preserve` boundary:

```markdown
<!-- bp:preserve -->
# Custom Team Conventions
- Always write async actions using async/await, avoiding .then() chains.
- Port numbers must be retrieved from process.env.PORT.
<!-- bp:end-preserve -->
```

Subsequent runs of `bp init` will update all structural metadata while preserving your manual guidelines!

---

## 🗺️ Developer Paths

Permalink: Developer Paths

`bp` scales to match different execution personas:

### ⚡ Quick Path (Individual Developers)

Permalink: Quick Path (Individual Developers)

Designed for solo developers seeking instant agent governance inside a single repository:

```text
bp init claude ➔ bp verify ➔ [code with agent] ➔ bp sync
```

### 🏢 Expanded Path (Team & Enterprise)

Permalink: Expanded Path (Team & Enterprise)

Designed for teams enforcing governance blocks across multiple repositories and automated CI pipelines:

```text
bp config set template_registry ➔ bp init ➔ bp verify --level all ➔ bp convert ➔ CI Validation
```

---

## 🐳 Docker Usage

`bp` ships as a multi-stage Docker image with a non-root `node` user and minimal footprint.

### Pull & Run

```bash
# Pull the latest image
docker pull ghcr.io/0xkhdr/open-blueprint:latest

# Check version
docker run --rm ghcr.io/0xkhdr/open-blueprint:latest --version

# Run bp verify against your project (mount current dir as /project)
docker run --rm -v "$(pwd):/project" -w /project ghcr.io/0xkhdr/open-blueprint:latest verify --level all

# Run bp init claude inside a container
docker run --rm -v "$(pwd):/project" -w /project ghcr.io/0xkhdr/open-blueprint:latest init claude
```

### Mount Notes

- Mount your project root at `/project` and set `-w /project` (or any consistent path).
- The container runs as the non-root `node` user — ensure write permissions on the mounted directory if `bp` needs to write files.
- Pass `--env BP_LOG_LEVEL=debug` for verbose structured JSON logging.
