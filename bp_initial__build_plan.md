# Blueprint (`bp`) — Production Implementation Plan

> **Version:** 1.0  
> **Status:** Technical Specification  
> **Target:** Production-ready CLI tool for agentic code repository preparation and integrity verification  
> **Date:** 2026-05-27

---

## 1. Executive Summary

`blueprint` (`bp`) is a zero-runtime-overhead CLI utility that prepares software repositories for agentic AI tools (Claude Code, Cursor, OpenDev, etc.) by scaffolding governance structures and verifying their integrity. It operates entirely at **development-time and CI-time** — never at runtime — ensuring that agentic tools receive consistent, validated, and semantically coherent configuration without competing for context window tokens or adding latency to the agentic loop.

### 1.1 Value Proposition

| Pain Point | `bp` Solution |
|---|---|
| Agentic tools ignore malformed config files silently | Structural + semantic validation with actionable error reporting |
| Teams manually duplicate governance across repos | Idempotent, templated scaffolding from a shared registry |
| Rules contradict each other across directories | Scope-intersection analysis detects logical conflicts before execution |
| Repository drift breaks agentic conventions | Automated fingerprinting and sync detection |
| Vendor lock-in to a single agentic tool | Backend-agnostic blueprint with format translation |

### 1.2 The Zero-Overhead Contract

After `bp init` completes, the tool may be uninstalled and the blueprint continues to function natively within the target agentic tool. `bp` generates **static configuration files** that the agentic tool already consumes. It is a **scaffolding generator**, not a runtime middleware.

---

## 2. Problem Analysis & Market Context

### 2.1 The Agentic Configuration Gap

Current agentic coding tools (Claude Code, Cursor, OpenDev, Goose) provide extension surfaces:
- **Claude Code:** `CLAUDE.md`, `.claude/rules/*.md`, `.claude/skills/*.md`, subagent specs, hooks
- **Cursor:** `.cursor/rules/*.md`, `.cursor/agents/`, context files
- **OpenDev:** `.opendev/`, skill registry, MCP tools

However, none of these tools provide:
1. **Validation** of the config files they consume
2. **Conflict detection** between overlapping rules
3. **Auto-detection** of repository structure to generate sensible defaults
4. **Portability** between tool formats

This creates a governance vacuum where teams write rules that are silently ignored, malformed, or contradictory.

### 2.2 The Drift Problem

Repositories evolve. Entry points change, test commands migrate (Jest → Vitest), new directories are created, package managers switch. Agentic configuration files become stale. Without a verification mechanism, the AI operates on outdated assumptions, leading to:
- Incorrect test commands
- Missing coverage for new directories
- Orphaned skills referencing deleted tools
- Style rules that no longer match the actual linter config

### 2.3 The Scale Problem

For organizations with 50+ repositories, manual configuration of agentic governance is infeasible. Each repo needs:
- Spatial anchors (where am I in the codebase?)
- Security constraints (what must never happen?)
- Style conventions (what should the code look like?)
- Capability skills (how do I perform common tasks?)

`bp` solves this by treating blueprints as **infrastructure-as-code** that can be templated, versioned, and enforced in CI.

---

## 3. Architecture Deep Dive

### 3.1 Core Philosophy

`bp` follows four architectural principles derived from the zero-overhead contract:

1. **Scaffolding-Only:** The tool runs once at setup or in CI. It never intercepts the agentic loop.
2. **Idempotency:** Running `bp init` twice produces the same result (with user edits preserved via block-level merging).
3. **Backend-Native Output:** Generated files conform exactly to the target tool's documented schema. No abstraction layers at runtime.
4. **Semantic Preservation:** A blueprint's meaning (rules, constraints, skills) is tool-agnostic. Only the file format changes between backends.

### 3.2 System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              blueprint CLI                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐           │
│  │   DETECTOR      │───▶│   TEMPLATER     │───▶│    WRITER       │           │
│  │  (Repo MRI)     │    │  (Template      │    │  (File System   │           │
│  │                 │    │   Engine)       │    │   Output)       │           │
│  └─────────────────┘    └─────────────────┘    └─────────────────┘           │
│           │                                              │                    │
│           ▼                                              ▼                    │
│  ┌─────────────────┐                            ┌─────────────────┐           │
│  │  Fingerprint    │                            │  Blueprint      │           │
│  │  (JSON Schema)  │                            │  Directory      │           │
│  │                 │                            │  (.claude/, etc)│           │
│  └─────────────────┘                            └─────────────────┘           │
│           │                                              │                    │
│           └──────────────────┬─────────────────────────┘                    │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                         VALIDATOR                                  │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐  │       │
│  │  │ Structural  │  │  Semantic   │  │  Logical    │  │ Drift  │  │       │
│  │  │  Engine     │  │   Engine    │  │  Engine     │  │ Engine │  │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │                       TRANSLATOR                                   │       │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────┐  │       │
│  │  │   Claude    │  │   Cursor    │  │   OpenDev   │  │ Generic│  │       │
│  │  │   Adapter   │  │   Adapter   │  │   Adapter   │  │ Adapter│  │       │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └────────┘  │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.3 The Four Engines

#### 3.3.1 Engine 1: Detector (Repository MRI)

**Purpose:** Build a deterministic, comprehensive fingerprint of the repository without executing any build commands.

**Detection Heuristics:**

| Category | Signals | Confidence |
|---|---|---|
| **Language** | `package.json` → Node/TS, `go.mod` → Go, `Cargo.toml` → Rust, `requirements.txt` → Python, `pom.xml` → Java | High |
| **Framework** | Dependency names in lockfiles (`react`, `next`, `django`, `fastapi`, `spring-boot`) | High |
| **Entry Points** | `src/index.ts`, `main.py`, `cmd/server/main.go`, `app.py`, `lib/main.dart` | Medium-High |
| **Test Runner** | `jest.config.*`, `vitest.config.*`, `pytest.ini`, `go test`, `cargo test` | High |
| **Package Manager** | `package-lock.json` → npm, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm, `poetry.lock` → poetry | High |
| **Build Tool** | `vite.config.*`, `webpack.config.*`, `Dockerfile`, `Makefile`, `bazel` | Medium |
| **Lint/Format** | `.eslintrc*`, `.prettierrc*`, `pyproject.toml` (black/ruff), `rustfmt.toml` | High |
| **Monorepo** | `packages/`, `pnpm-workspace.yaml`, `lerna.json`, `nx.json` | High |
| **Git** | `.git/`, `.github/workflows/`, `.gitignore` patterns | High |

**Fingerprint Schema (Zod-validated):**

```typescript
const FingerprintSchema = z.object({
  version: z.literal("1.0"),
  detected_at: z.string().datetime(),
  project: z.object({
    name: z.string(),
    root: z.string(),
    type: z.enum(["monorepo", "polyrepo", "library", "application", "service"]),
  }),
  languages: z.array(z.object({
    name: z.enum(["typescript", "javascript", "python", "go", "rust", "java", "ruby", "dart", "cpp", "csharp"]),
    confidence: z.number().min(0).max(1),
    primary: z.boolean(),
  })),
  frameworks: z.array(z.string()),
  entry_points: z.array(z.object({
    path: z.string(),
    type: z.enum(["cli", "server", "library", "ui"]),
    language: z.string(),
  })),
  tooling: z.object({
    package_manager: z.string().optional(),
    test_runner: z.string().optional(),
    test_command: z.string().optional(),
    build_tool: z.string().optional(),
    linter: z.string().optional(),
    formatter: z.string().optional(),
  }),
  directory_topology: z.object({
    src_dirs: z.array(z.string()),
    test_dirs: z.array(z.string()),
    config_dirs: z.array(z.string()),
    package_dirs: z.array(z.string()), // for monorepos
  }),
  existing_conventions: z.object({
    has_eslint: z.boolean(),
    has_prettier: z.boolean(),
    has_typescript: z.boolean(),
    has_docker: z.boolean(),
    has_ci: z.boolean(),
    git_workflow: z.enum(["github-flow", "trunk-based", "gitflow", "unknown"]),
  }),
  raw_signals: z.record(z.any()), // raw data for debugging
});
```

**Design Decision:** The Detector uses **only static file analysis** — no `npm list`, no `go version`, no network calls. This ensures it runs in milliseconds and works in CI environments without build dependencies.

#### 3.3.2 Engine 2: Templater (The Writer)

**Purpose:** Map fingerprints to template packs and render backend-native configuration files.

**Template Engine:**
- **Choice:** Handlebars (lightweight, well-known, zero runtime dependencies after compilation)
- **Philosophy:** Templates are markdown files with embedded expressions. No logic-heavy templates.
- **Block Markers:** Generated sections are wrapped in markers to enable idempotent updates:
  ```markdown
  <!-- bp-generated:begin position -->
  # Position: {{project_name}}
  - Language: {{primary_language}}
  <!-- bp-generated:end position -->

  <!-- bp:preserve -->
  # Custom team notes (never overwritten by bp)
  Our team uses specific naming conventions...
  <!-- bp:end-preserve -->
  ```

**Template Pack Structure:**

```
templates/
├── _base/                          # Shared partials (tool-agnostic)
│   ├── partials/
│   │   ├── security-rules.md.hbs
│   │   ├── style-rules.md.hbs
│   │   └── test-patterns.md.hbs
│   └── helpers.js                  # Custom Handlebars helpers
├── claude/
│   ├── manifest.json               # Backend metadata
│   ├── CLAUDE.md.hbs
│   ├── agents/
│   │   ├── planner.md.hbs
│   │   ├── implementer.md.hbs
│   │   └── reviewer.md.hbs
│   ├── rules/
│   │   ├── 01-position.md.hbs
│   │   ├── 02-security.md.hbs
│   │   ├── 03-style.md.hbs
│   │   └── 04-meta.md.hbs
│   └── skills/
│       ├── add-test.md.hbs
│       └── refactor-async.md.hbs
├── cursor/
│   ├── manifest.json
│   └── ... (cursor-native syntax)
├── opendev/
│   ├── manifest.json
│   └── ...
└── generic/
    └── ... (backend-agnostic markdown)
```

**Manifest Schema (`manifest.json`):**

```json
{
  "backend": "claude",
  "version": "2026.1",
  "supported_features": ["rules", "skills", "agents", "hooks"],
  "file_patterns": {
    "anchor": ["CLAUDE.md", ".claude/CLAUDE.md"],
    "rules": ".claude/rules/*.md",
    "skills": ".claude/skills/*.md",
    "agents": ".claude/agents/*.md",
    "hooks": ".claude/hooks/*"
  },
  "max_file_sizes": {
    "rules": 10000,
    "skills": 15000,
    "anchor": 5000
  },
  "frontmatter_schema": "claude-v1"
}
```

**Template Selection Logic:**

```
fingerprint → language → framework → template_pack
     │              │           │
     ▼              ▼           ▼
  [node, ts]   [nextjs]    →  templates/claude/nextjs/
  [node, ts]   [express]   →  templates/claude/express/
  [python]     [fastapi]   →  templates/claude/fastapi/
  [python]     [django]    →  templates/claude/django/
  [go]         [std]        →  templates/claude/go/
  [rust]       [axum]      →  templates/claude/rust/
```

If no framework-specific template exists, falls back to language base, then to generic.

#### 3.3.3 Engine 3: Validator (Integrity Verification)

**Purpose:** Ensure the blueprint is structurally sound, semantically valid, logically consistent, and synchronized with the repository.

**Validation Pipeline:**

```
Input: Blueprint directory + Fingerprint
  │
  ├──► Structural Engine
  │    ├── File existence checks
  │    ├── Frontmatter YAML validity
  │    ├── Markdown well-formedness
  │    ├── File size limits (per backend manifest)
  │    └── Required field presence
  │
  ├──► Semantic Engine
  │    ├── Scope pattern resolution (do globs match actual paths?)
  │    ├── Tool reference validation (do skills reference valid tools?)
  │    ├── Agent tool-allowlist validation
  │    ├── Cross-reference integrity (skills referenced by rules?)
  │    └── Backend schema conformance
  │
  ├──► Logical Engine
  │    ├── Rule scope intersection analysis
  │    ├── Severity conflict detection (hard vs hard, hard vs soft)
  │    ├── Circular skill dependency detection
  │    └── Contradiction detection via semantic analysis
  │
  └──► Drift Engine
       ├── Fingerprint comparison with stored fingerprint
       ├── Entry point drift (files moved/deleted)
       ├── Test command drift (package.json scripts changed)
       ├── Directory topology drift (new dirs uncovered)
       └── Tool version drift (backend manifest outdated)
```

**Rule Conflict Detection Algorithm:**

The most critical validation. Rules define scopes via glob patterns. Two rules conflict if:
1. Their scope patterns intersect (match at least one common file)
2. Their actions are contradictory (e.g., "must use async" vs "must not use async")

**Implementation:**
- Convert glob patterns to sets of matched files using `fast-glob`
- Compute set intersection
- If intersection is non-empty and severities are both `hard` → ERROR
- If intersection is non-empty and one is `hard`, one `soft` → WARNING
- If actions are semantically opposite (detected via keyword antonym matching) → ERROR

**Example Conflict Report:**

```
[CRITICAL] Rule Conflict Detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Rule A: .claude/rules/02-api.md
  Scope: src/services/**
  Action: All network calls must use internal httpClient
  Severity: hard

Rule B: .claude/rules/03-legacy.md
  Scope: src/services/legacy/**
  Action: Use raw fetch() for legacy bridge compatibility
  Severity: hard

Intersection: src/services/legacy/api.ts (and 4 other files)
Resolution:
  1. Narrow Rule A: scope: src/services/** !src/services/legacy/**
  2. Downgrade Rule B: severity: soft
  3. Merge rules with conditional logic
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

#### 3.3.4 Engine 4: Translator (Backend Portability)

**Purpose:** Convert a blueprint from one agentic tool format to another without losing semantic meaning.

**Translation Strategy:**
1. **Parse** source backend files into an intermediate representation (IR)
2. **Validate** IR for semantic completeness
3. **Render** IR through target backend templates
4. **Verify** output against target backend manifest schema

**Intermediate Representation:**

```typescript
interface BlueprintIR {
  version: "1.0";
  spatial_anchor: {
    project_name: string;
    surface: string;
    temporal_anchor: string;
    conventions: string[];
  };
  personas: Array<{
    name: string;
    role: string;
    reasoning_style: string;
    constraints: string[];
    allowed_tools?: string[];
  }>;
  rules: Array<{
    id: string;
    scope: string;
    severity: "hard" | "soft";
    action: string;
    rationale?: string;
  }>;
  skills: Array<{
    name: string;
    description: string;
    when_to_use: string;
    tools_required: string[];
    procedure: string;
  }>;
  meta: {
    rule_precedence: string[];
    conflict_resolution: string;
  };
}
```

**Translation Example:**

```bash
# Convert Claude Code blueprint to Cursor format
bp convert --from claude --to cursor --input ./ --output ./cursor-blueprint/

# Result:
# - .claude/rules/ → .cursor/rules/ (syntax adapted)
# - .claude/agents/ → .cursor/agents/ (format adapted)
# - CLAUDE.md → .cursor/context.md (structure adapted)
```

---

## 4. CLI Specification

### 4.1 Command Surface

```
bp [command] [options]

Commands:
  init [tool]           Scaffold blueprint for current repository
    --tool <backend>    Target agentic tool: claude | cursor | opendev | generic
    --template <name>   Use specific template pack (default: auto-detect)
    --force             Overwrite existing blueprint (preserves user blocks)
    --dry-run           Show what would be generated without writing

  verify                Validate blueprint integrity
    --level <level>     Validation depth: structural | semantic | logical | drift | all (default: all)
    --json              Output machine-readable JSON
    --fix               Auto-correct unambiguous issues
    --watch             Watch mode for development (runs on file change)

  sync                  Detect and resolve repository drift
    --auto-apply        Apply all safe fixes without prompting
    --report            Generate drift report only, no changes

  convert               Translate blueprint between backends
    --from <backend>    Source backend
    --to <backend>      Target backend
    --input <path>      Source blueprint directory
    --output <path>     Output directory

  template              Manage template packs
    list                List available templates
    add <path>          Add custom template pack
    publish <path>      Publish template pack to registry

  doctor                Diagnostic mode for troubleshooting
    --tool <backend>    Check why tool might ignore config
    --verbose           Full diagnostic trace

  rule                  Rule management
    test <file>         Dry-run a rule against mock scenarios
    lint <file>         Check rule syntax and scope validity

Options:
  -v, --verbose         Verbose output
  -q, --quiet           Suppress non-error output
  --version             Show version
  --help                Show help
```

### 4.2 Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | General error |
| 2 | Validation failed (structural) |
| 3 | Validation failed (semantic) |
| 4 | Validation failed (logical — rule conflicts) |
| 5 | Drift detected |
| 6 | Unsupported backend |
| 7 | Template not found |

---

## 5. Implementation Roadmap

### 5.1 Phase 1: Core Foundation (Weeks 1–3)
**Goal:** Working `init` and `verify` commands for Claude Code backend.

**Deliverables:**
- [ ] Project bootstrap: TypeScript + Bun runtime, Zod schemas, CLI framework (Commander.js or Cliffy)
- [ ] Detector Engine v1: Support Node.js, Python, Go, Rust repositories
  - File existence heuristics
  - Lockfile parsing (package-lock.json, go.mod, Cargo.toml, requirements.txt)
  - Directory topology scanning
- [ ] Templater Engine v1: Handlebars integration
  - Base template pack for generic projects
  - Claude Code template pack (CLAUDE.md, rules, skills, agents)
  - Block-level merging for idempotency
- [ ] Writer: File system output with `.blueprintignore` support
- [ ] Validator Engine v1: Structural validation
  - Frontmatter YAML parsing
  - Markdown well-formedness
  - File size limit checks
  - Required field presence
- [ ] CLI: `bp init --tool claude` and `bp verify`
- [ ] Test suite: Unit tests for Detector, Templater, Validator

**Milestone:** `bp init --tool claude` generates a working blueprint for a Node.js project. `bp verify` catches malformed frontmatter.

### 5.2 Phase 2: Integrity Engine (Weeks 4–6)
**Goal:** Full semantic, logical, and drift validation.

**Deliverables:**
- [ ] Detector Engine v2: Framework detection (React, Next.js, FastAPI, Django, etc.)
- [ ] Semantic Validator:
  - Scope pattern resolution against actual filesystem
  - Tool reference validation (skill → valid tool mapping)
  - Agent tool-allowlist validation
  - Cross-reference integrity
- [ ] Logical Validator:
  - Rule scope intersection algorithm
  - Conflict detection (hard vs hard, semantic contradictions)
  - Circular dependency detection for skills
  - Rule precedence validation
- [ ] Drift Engine:
  - Fingerprint storage (`.bp-fingerprint.json` — optional, gitignored by default)
  - Entry point drift detection
  - Test command drift detection
  - Directory topology drift detection
- [ ] `bp sync` command with interactive fix prompts
- [ ] `bp verify --fix` for auto-correction
- [ ] `bp verify --watch` for development mode
- [ ] Test suite: Integration tests with fixture repositories

**Milestone:** `bp verify` detects a rule conflict between two `.claude/rules/*.md` files. `bp sync` detects that `package.json` changed from Jest to Vitest.

### 5.3 Phase 3: Ecosystem & Distribution (Weeks 7–9)
**Goal:** Multi-backend support, template registry, and distribution.

**Deliverables:**
- [ ] Translator Engine:
  - Intermediate Representation (IR) schema
  - Claude Code → Cursor adapter
  - Cursor → Claude Code adapter
  - Generic backend adapter
  - `bp convert` command
- [ ] Template Registry:
  - `bp template list` — list built-in templates
  - `bp template add <path>` — add custom local templates
  - `bp template publish <path>` — publish to remote registry (npm-like)
  - Template pack versioning
- [ ] Additional Backends:
  - Cursor template pack
  - OpenDev template pack
  - Generic (tool-agnostic) template pack
- [ ] Distribution:
  - npm package: `@agentic/bp`
  - Homebrew formula: `agentic-blueprint`
  - Standalone binary via `bun build --compile`
  - GitHub Releases with prebuilt binaries
- [ ] Documentation:
  - README with quickstart
  - Template authoring guide
  - Backend adapter authoring guide
  - CI integration examples

**Milestone:** User can run `bp init --tool cursor` and get a Cursor-native blueprint. User can run `bp convert --from claude --to cursor`.

### 5.4 Phase 4: Production Hardening (Weeks 10–12)
**Goal:** Enterprise-ready reliability, performance, and observability.

**Deliverables:**
- [ ] Performance:
  - Detector optimization: parallel file scanning, caching
  - Validator optimization: incremental validation (only check changed files)
  - Large repository support (10,000+ files)
- [ ] CI/CD Integration:
  - GitHub Action: `agentic-blueprint/verify@v1`
  - GitLab CI template
  - Azure DevOps extension
  - Pre-commit hook support
- [ ] Enterprise Features:
  - Shared template registry (private npm registry or S3)
  - Organization-wide base templates
  - Blueprint inheritance (repo blueprint extends org base)
  - Audit logging
- [ ] Observability:
  - `bp doctor` diagnostic command
  - Verbose mode with timing breakdowns
  - Validation report artifacts for CI
- [ ] Security:
  - Template sandboxing (no arbitrary code execution in templates)
  - Hook validation (ensure hooks are safe to execute)
  - No secrets in generated files (scan for API keys, tokens)
- [ ] Stability:
  - 95% test coverage
  - Fuzz testing with random repository structures
  - Backward compatibility guarantees for blueprint schemas

**Milestone:** `bp` runs in GitHub Actions on a 500-repo organization, validating blueprints on every PR.

---

## 6. Technical Specifications

### 6.1 Technology Stack

| Component | Choice | Rationale |
|---|---|---|
| **Runtime** | Bun / Node.js 20+ | Bun for fast compilation to single binary; Node for compatibility |
| **Language** | TypeScript | Type safety, ecosystem, team familiarity |
| **CLI Framework** | Commander.js | Mature, well-documented, plugin architecture |
| **Template Engine** | Handlebars | Lightweight, logic-less, well-known, fast |
| **Schema Validation** | Zod | TypeScript-native, composable, excellent error messages |
| **Glob Matching** | `fast-glob` + `picomatch` | Industry standard, fast, supports negation |
| **Markdown Parsing** | `gray-matter` + `remark` | Frontmatter extraction + AST for validation |
| **Testing** | Vitest | Fast, native TS support, excellent watch mode |
| **Linting** | Biome | Fast, unified formatter + linter, minimal config |
| **Build** | `bun build --compile` | Single binary distribution, zero dependencies |

### 6.2 Data Flow Architecture

```
User Input
    │
    ▼
┌─────────────┐
│   CLI Parser │───▶ Command routing
└─────────────┘
    │
    ▼
┌─────────────┐     ┌─────────────┐
│   Detector   │────▶│ Fingerprint │
│   (async)    │     │   (JSON)    │
└─────────────┘     └─────────────┘
    │
    ▼
┌─────────────┐     ┌─────────────┐
│  Templater   │────▶│  Rendered   │
│   (async)    │     │   Files     │
└─────────────┘     └─────────────┘
    │
    ▼
┌─────────────┐
│   Writer     │───▶ File system I/O (with conflict resolution)
└─────────────┘
    │
    ▼
┌─────────────┐     ┌─────────────┐
│  Validator   │────▶│   Report    │
│   (async)    │     │  (human/JSON)│
└─────────────┘     └─────────────┘
```

### 6.3 File I/O Strategy

**Idempotent Writes:**
- Read existing file if present
- Parse into generated blocks and preserved blocks
- Render new generated blocks from template
- Merge: preserved blocks stay, generated blocks are replaced
- Write back

**Conflict Resolution:**
- If file exists and has no `bp-generated` markers → prompt user (or `--force`)
- If file exists with markers → merge automatically
- If `--dry-run` → show diff, no writes

### 6.4 Configuration

**User Config (`~/.config/bp/config.json`):**
```json
{
  "default_backend": "claude",
  "template_registry": "https://registry.agentic.dev",
  "custom_templates": ["~/.bp/templates/"],
  "verify_on_init": true,
  "auto_fix_level": "structural",
  "ci_mode": false
}
```

**Project Config (`.bp.json` — optional, for advanced users):**
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

---

## 7. Production Considerations

### 7.1 CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Blueprint Integrity
on: [push, pull_request]

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: agentic-blueprint/verify@v1
        with:
          backend: claude
          level: all
          fail-on: logical
```

**Pre-commit Hook:**

```yaml
# .pre-commit-hooks.yaml (in bp repo)
- id: blueprint-verify
  name: Verify Agentic Blueprint
  entry: bp verify --level semantic
  language: system
  pass_filenames: false
  always_run: true
```

### 7.2 Distribution Strategy

| Channel | Format | Target User |
|---|---|---|
| **npm** | `@agentic/bp` | JavaScript/TypeScript developers |
| **Homebrew** | `brew install agentic-blueprint` | macOS/Linux developers |
| **GitHub Releases** | Prebuilt binaries (Linux, macOS, Windows) | CI/CD, non-JS developers |
| **Cargo** | `cargo install bp` | Rust developers (future) |
| **Docker** | `ghcr.io/agentic/bp` | CI environments |

### 7.3 Testing Strategy

**Test Pyramid:**

| Layer | Type | Count | Examples |
|---|---|---|---|
| Unit | Fast, isolated | 200+ | Detector heuristics, template rendering, validation rules |
| Integration | Fixture repos | 50+ | Full `init` → `verify` flow on real repo structures |
| E2E | CLI commands | 20+ | `bp init --tool claude` on temp directory, verify exit codes |
| Fuzz | Random repos | 1000+ | Generate random file trees, ensure no crashes |
| Performance | Large repos | 10+ | 10,000+ file repos, measure init and verify time |

**Fixture Repository Library:**
```
tests/fixtures/
├── node-express/
├── node-nextjs/
├── node-monorepo/
├── python-fastapi/
├── python-django/
├── go-std/
├── go-microservices/
├── rust-axum/
├── java-spring/
├── ruby-rails/
└── mixed-language/
```

### 7.4 Security Model

**Threats and Mitigations:**

| Threat | Mitigation |
|---|---|
| Malicious template executes arbitrary code | Templates are Handlebars (logic-less). No `eval`, no `require`. Custom helpers are allowlisted. |
| Hook files contain malicious code | `bp` generates hook **stubs** only. It never executes hooks. Execution is the agentic tool's responsibility. |
| Secrets leaked into generated files | Post-generation scan for common secret patterns (API keys, tokens, private keys). Warn if detected. |
| Template registry serves malicious packs | Registry packages are signed. `bp` verifies signatures before extraction. |
| Path traversal in template output | All output paths are resolved relative to project root and validated against `..` patterns. |

### 7.5 Performance Targets

| Metric | Target | Notes |
|---|---|---|
| `bp init` time | < 2 seconds | For repos up to 1,000 files |
| `bp verify` time | < 1 second | Incremental validation |
| `bp verify --level all` | < 5 seconds | Full validation including drift |
| Memory footprint | < 100 MB | Peak during detection of large repos |
| Binary size | < 50 MB | Single compiled binary |

---

## 8. Success Metrics

### 8.1 Technical Metrics

| Metric | Target | Measurement |
|---|---|---|
| Test Coverage | > 90% | Codecov integration |
| Zero false positives in validation | > 99% | Fixture test suite |
| Detection accuracy | > 95% | Manual verification on 50 real repos |
| Template render correctness | 100% | Snapshot testing |
| Conversion fidelity | > 98% | Round-trip test: claude → cursor → claude |

### 8.2 Adoption Metrics

| Metric | Target (6 months) | Target (12 months) |
|---|---|---|
| npm weekly downloads | 1,000 | 10,000 |
| GitHub stars | 500 | 2,500 |
| Active template packs | 10 | 50 |
| Organization adopters | 5 | 50 |
| CI integrations (GitHub Actions) | 100 repos | 1,000 repos |

### 8.3 Quality Metrics

| Metric | Target |
|---|---|
| Blueprints with zero validation errors | > 80% of repos using `bp` |
| Rule conflict detection before commit | 100% of conflicts caught in CI |
| Drift detection latency | < 24 hours (via CI or local dev) |
| User-reported false positives | < 5 per month |

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| **Agentic tool changes schema** | High | High | Versioned backend manifests; adapter pattern; rapid release cycle |
| **Context window sizes increase dramatically** | Medium | Medium | Templates are parameterized; adjust size limits in manifests |
| **Competing tool releases native equivalent** | Medium | High | Focus on multi-backend portability and CI integration (harder to replicate) |
| **Large repo performance issues** | Medium | Medium | Parallel scanning, caching, incremental validation |
| **Template maintenance burden** | Medium | Medium | Community-driven template registry; org-specific packs reduce core burden |
| **User confusion about zero-overhead claim** | Low | Medium | Clear documentation; `bp doctor` command; explicit uninstall instructions |
| **Security vulnerability in template system** | Low | High | Logic-less templates, signature verification, sandboxed rendering |

---

## 10. Open Questions & Future Directions

1. **AI-Assisted Template Generation:** Can we use an LLM to generate custom templates from a repo's existing conventions (README, CONTRIBUTING, eslint config)?
2. **Dynamic Rule Generation:** Should `bp` analyze code review comments to suggest new rules?
3. **Cross-Repository Governance:** How do we enforce organization-wide rules across hundreds of repos with local overrides?
4. **Hook Language Agnosticism:** Should `bp` generate hooks in the repo's native language (JS for Node, Python for Python) rather than a single language?
5. **IDE Integration:** Should we build a VS Code extension that highlights blueprint errors in real-time as you edit `.claude/rules/*.md`?
6. **Semantic Rule NLP:** Can we use embeddings to detect semantic contradictions beyond keyword matching (e.g., "use functional style" vs "prefer OOP patterns")?

---

## 11. Appendix A: Glossary

| Term | Definition |
|---|---|
| **Blueprint** | The complete set of agentic configuration files for a repository (anchors, rules, skills, agents, hooks) |
| **Backend** | The target agentic tool (Claude Code, Cursor, OpenDev, etc.) |
| **Fingerprint** | A JSON representation of a repository's structure, languages, frameworks, and tooling |
| **Hook** | A lifecycle callback executed by the agentic tool (not `bp`) at tool-use boundaries |
| **Idempotency** | Running `bp init` multiple times produces the same result, preserving user edits |
| **Scaffolding** | The pre-execution phase where configuration is assembled |
| **Skill** | A reusable, single-responsibility capability definition for an agentic tool |
| **Spatial Anchor** | A declaration of where the agent is in the project lifecycle and codebase |
| **Template Pack** | A collection of templates for a specific backend + language + framework combination |
| **Zero-Overhead** | No runtime tokens, latency, or context pollution added to the agentic loop |

---

## 12. Appendix B: File Structure Reference

### After `bp init --tool claude`

```
project-root/
├── CLAUDE.md                          # Layer 1: Global Spatial Anchor
├── .claude/                           # Generated: Full 5-layer blueprint
│   ├── CLAUDE.md                      # Layer 1: Subdirectory Anchor (optional)
│   ├── agents/
│   │   ├── planner.md                 # Layer 2: Planner Persona
│   │   ├── implementer.md             # Layer 2: Default Execution Persona
│   │   └── reviewer.md                # Layer 2: Reviewer Persona
│   ├── rules/
│   │   ├── 01-position.md             # Layer 1: Phase definitions
│   │   ├── 02-security.md             # Layer 3: Hard constraints
│   │   ├── 03-style.md                # Layer 3: Soft constraints
│   │   └── 04-meta.md                 # Layer 3: Rule precedence
│   ├── skills/
│   │   ├── add-test.md                # Layer 4: Capability unit
│   │   └── refactor-async.md          # Layer 4: Capability unit
│   └── hooks/                         # Layer 5: Verification hooks (optional)
│       └── pre_tool_use.js
├── .blueprintignore                   # Dirs bp should ignore
├── .bp.json                           # Optional: Project-level bp config
└── .github/
    └── workflows/
        └── blueprint-verify.yml       # CI integration (optional)
```

### After `bp init --tool cursor`

```
project-root/
├── .cursor/
│   ├── context.md                     # Spatial Anchor
│   ├── rules/
│   │   ├── 01-position.md
│   │   ├── 02-security.md
│   │   └── 03-style.md
│   ├── agents/
│   │   ├── planner.md
│   │   └── reviewer.md
│   └── skills/
│       └── add-test.md
├── .blueprintignore
└── .bp.json
```

---

## 13. Appendix C: Backend Manifest Reference

### Claude Code Manifest (`templates/claude/manifest.json`)

```json
{
  "backend": "claude",
  "version": "2026.1",
  "supported_features": {
    "anchors": true,
    "rules": true,
    "skills": true,
    "agents": true,
    "hooks": true
  },
  "file_patterns": {
    "anchor": ["CLAUDE.md", ".claude/CLAUDE.md"],
    "rules": ".claude/rules/*.md",
    "skills": ".claude/skills/*.md",
    "agents": ".claude/agents/*.md",
    "hooks": ".claude/hooks/*"
  },
  "max_file_sizes": {
    "anchor": 5000,
    "rules": 10000,
    "skills": 15000,
    "agents": 8000
  },
  "frontmatter_schema": {
    "rules": {
      "required": ["scope", "severity"],
      "optional": ["action", "rationale", "tags"],
      "severity_values": ["hard", "soft", "info"]
    },
    "skills": {
      "required": ["name", "description"],
      "optional": ["tools_required", "when_to_use", "disable_model_invocation"],
      "tools_required_must_exist": true
    },
    "agents": {
      "required": ["name"],
      "optional": ["role", "reasoning_style", "allowed_tools", "model"]
    }
  },
  "special_files": {
    "CLAUDE.md": {
      "location_priority": ["project_root", ".claude/"],
      "hierarchy": true
    }
  }
}
```

---

*End of Document*
