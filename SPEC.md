# blueprint (bp) — Project Specification
**Version:** 2.0 · **License:** MIT · **Status:** Implementation-Ready

---

## 0. Claude Code Execution Protocol

This is the authoritative single source of truth for building `bp`. Follow this sequence exactly:

```
READ SPEC → CONFIRM PHASE → IMPLEMENT → TEST → COMMIT → REPORT → NEXT PHASE
```

**Rules:**
- Stop and ask before starting each phase. Never begin a phase without explicit user confirmation.
- Write complete, production-grade files — no stubs, no TODOs in shipped code.
- Run tests after every sub-task. Fix failures before continuing.
- Commit after each sub-task using conventional commits (`feat:`, `fix:`, `test:`, `docs:`).
- After each phase, output: file tree diff + test results + key decisions. Then ask to proceed.
- If a blocking ambiguity arises, write an ADR and present 3 options with trade-offs.

---

## 1. Product Definition

**blueprint (`bp`)** is a zero-runtime-overhead CLI utility that prepares software repositories for agentic AI tools (Claude Code, Cursor, OpenDev, Goose) by scaffolding governance structures and verifying their integrity.

- Runs at **development-time and CI-time only** — never at runtime
- Generates **static configuration files** that agentic tools already consume natively
- After `bp init` completes, the tool can be uninstalled — generated files continue working
- `bp` is a scaffolding generator and integrity verifier, not middleware

### 1.1 Core Value Proposition

| Pain Point | bp Solution |
|---|---|
| Agentic tools silently ignore malformed config | Structural + semantic validation with actionable, line-precise errors |
| Teams duplicate governance across 50+ repos | Idempotent templated scaffolding from a versioned registry |
| Rules contradict each other across scopes | Scope-intersection analysis detects conflicts before execution |
| Repository drift breaks agentic conventions | Automated fingerprinting and drift detection in CI |
| Vendor lock-in to one agentic tool format | Backend-agnostic IR with format translation between all tools |
| No visibility into config being read correctly | `bp doctor` provides full diagnostic trace and schema conformance |
| Org-wide policy enforcement is manual | Blueprint inheritance: repo extends org base template |

### 1.2 Non-Negotiable Principles

- **Scaffolding-Only**: `bp` runs once at setup or in CI. Never intercepts the agentic loop.
- **Idempotency**: `bp init` twice produces identical output; preserve blocks are never overwritten.
- **Backend-Native Output**: Generated files conform exactly to the target tool's documented schema.
- **Semantic Preservation**: A blueprint's meaning is tool-agnostic; only format changes across backends.
- **Fail-Loud**: Every error includes file, line, problem, and at least one resolution path.
- **Progressive Disclosure**: `bp init` works with zero config; advanced features unlock via flags and `.bp.json`.

---

## 2. The Five Blueprint Layers

Every generated blueprint has five layers, regardless of backend:

| Layer | Name | File Pattern (Claude) | Purpose |
|---|---|---|---|
| 1 | Spatial Anchor | `CLAUDE.md` | Where is the agent in the project lifecycle? |
| 2 | Personas / Agents | `.claude/agents/*.md` | Who is the agent? Planner, Implementer, Reviewer. |
| 3 | Rules | `.claude/rules/*.md` | What must / must not happen? Hard + soft constraints. |
| 4 | Skills | `.claude/skills/*.md` | Reusable capability units: how to perform a task. |
| 5 | Hooks | `.claude/hooks/*` | Lifecycle callbacks at tool-use boundaries. |

---

## 3. System Architecture — Four Engines

```
bp CLI
├── DETECTOR   (Repo MRI — static file analysis only)
├── TEMPLATER  (Handlebars → backend-native files)
├── VALIDATOR  (4-layer pipeline: structural, semantic, logical, drift)
└── TRANSLATOR (IR-based backend-to-backend conversion)
```

### 3.1 Engine 1: Detector

**Contract:** Static analysis only. No shell commands, no network calls, no build-tool invocations. Sub-second in CI.

**Produces:** A Zod-validated `Fingerprint` object.

```typescript
const FingerprintSchema = z.object({
  version: z.literal("1.0"),
  detected_at: z.string().datetime(),
  project: z.object({
    name: z.string(),
    root: z.string(),
    type: z.enum(["monorepo", "polyrepo", "library", "application", "service"]),
    git_workflow: z.enum(["github-flow", "trunk-based", "gitflow", "unknown"]),
  }),
  languages: z.array(z.object({
    name: z.enum(["typescript","javascript","python","go","rust","java","ruby","dart","cpp","csharp","swift"]),
    confidence: z.number().min(0).max(1),
    primary: z.boolean(),
  })),
  frameworks: z.array(z.object({ name: z.string(), confidence: z.number() })),
  entry_points: z.array(z.object({
    path: z.string(),
    type: z.enum(["cli","server","library","ui"]),
  })),
  tooling: z.object({
    package_manager: z.string().optional(),
    test_runner: z.string().optional(),
    test_command: z.string().optional(),
    build_tool: z.string().optional(),
    linter: z.string().optional(),
    formatter: z.string().optional(),
    ci_system: z.string().optional(),
  }),
  directory_topology: z.object({
    src_dirs: z.array(z.string()),
    test_dirs: z.array(z.string()),
    config_dirs: z.array(z.string()),
    package_dirs: z.array(z.string()),
  }),
  security_signals: z.object({
    has_auth: z.boolean(),
    has_external_apis: z.boolean(),
    has_secrets_manager: z.boolean(),
    has_docker: z.boolean(),
  }),
});
```

**Language detection signals:**

| Language | Signal Files | Confidence |
|---|---|---|
| TypeScript/JS | `package.json` + `.ts`/`.tsx` in `src/` | High |
| Python | `requirements.txt`, `setup.py`, `pyproject.toml`, `poetry.lock` | High |
| Go | `go.mod`, `go.sum` | High |
| Rust | `Cargo.toml`, `Cargo.lock` | High |
| Java/Kotlin | `pom.xml`, `build.gradle`, `.java`/`.kt` files | High |
| Ruby | `Gemfile`, `Gemfile.lock`, `.rb` files | High |
| Dart/Flutter | `pubspec.yaml`, `lib/main.dart` | High |
| C/C++ | `CMakeLists.txt`, `Makefile`, `.cpp`/`.c` | Medium |
| C# | `.csproj`, `.sln` | High |
| Swift | `Package.swift`, `.xcodeproj` | High |

**Framework detection signals:**

| Framework | Signal | Confidence |
|---|---|---|
| Next.js | `next` in deps, `next.config.*` | High |
| React | `react` in deps, `.jsx`/`.tsx` files | High |
| Express | `express` in deps, `app.js`/`server.js` | High |
| NestJS | `@nestjs/core` in deps, `src/main.ts` | High |
| FastAPI | `fastapi` in requirements, `FastAPI()` in `main.py` | High |
| Django | `django` in requirements, `settings.py`, `manage.py` | High |
| Spring Boot | `spring-boot-starter` in `pom.xml`/`build.gradle` | High |
| Axum/Actix | `axum`/`actix-web` in `Cargo.toml` | High |
| Rails | `rails` in `Gemfile`, `config/application.rb` | High |
| Vue/Nuxt | `vue`/`nuxt` in deps, `.vue` files | High |
| Svelte/SvelteKit | `svelte`/`@sveltejs/kit` in deps | High |
| Flutter | `flutter` in `pubspec.yaml` | High |

**Tooling signals:**

| Category | Signal Logic |
|---|---|
| Package Manager | `package-lock.json` → npm \| `yarn.lock` → yarn \| `pnpm-lock.yaml` → pnpm \| `bun.lockb` → bun \| `poetry.lock` → poetry |
| Test Runner | `jest.config.*`/`vitest.config.*` → JS; `pytest.ini`/`conftest.py` → Python; `go.mod` → go test; `Cargo.toml` → cargo test |
| Build Tool | `vite.config.*` → Vite; `webpack.config.*` → Webpack; `Makefile` → Make; `Dockerfile` → Docker; `nx.json` → Nx |
| Linter/Formatter | `.eslintrc*`, `biome.json` → JS; `.prettierrc*` → Prettier; `pyproject.toml[tool.ruff]` → Ruff |
| Monorepo | `packages/` + `pnpm-workspace.yaml` \| `lerna.json` \| `nx.json` \| `turbo.json` \| `rush.json` |
| CI System | `.github/workflows/*.yml` → GitHub Actions; `.gitlab-ci.yml` → GitLab; `.circleci/` → CircleCI; `Jenkinsfile` → Jenkins |

---

### 3.2 Engine 2: Templater

**Contract:** Maps fingerprint to template packs. Renders backend-native config files. Idempotent on re-run.

**Template engine:** Handlebars — logic-less, auditable, zero runtime deps after compilation. No `eval`, no `require` inside templates. Custom helpers are allowlisted.

**Idempotency via block markers:**
```markdown
<!-- bp-generated:begin position -->
# Position: {{project_name}}
- Language: {{primary_language}} ({{primary_framework}})
- Entry: {{entry_point_path}}
- Test command: {{test_command}}
<!-- bp-generated:end position -->

<!-- bp:preserve -->
# Custom team notes (NEVER overwritten by bp)
Our team uses specific naming conventions for services...
<!-- bp:end-preserve -->
```

Generated blocks are identified by begin/end markers and replaced on subsequent `bp init`. Preserve blocks are never touched.

**Template pack directory layout:**
```
templates/
  _base/
    partials/
      security-rules.md.hbs
      style-rules.md.hbs
      test-patterns.md.hbs
    helpers.js                    # Allowlisted Handlebars helpers only
  claude/
    manifest.json                 # Backend metadata + schema version
    CLAUDE.md.hbs
    agents/
      planner.md.hbs
      implementer.md.hbs
      reviewer.md.hbs
    rules/
      01-position.md.hbs
      02-security.md.hbs
      03-style.md.hbs
      04-meta.md.hbs
    skills/
      add-test.md.hbs
      refactor-async.md.hbs
  cursor/
    manifest.json
    ...                           # cursor-native syntax
  opendev/
    manifest.json
    ...
  generic/
    ...                           # backend-agnostic markdown
```

**Backend manifest schema (`manifest.json`):**
```json
{
  "backend": "claude",
  "version": "2026.1",
  "supported_features": {
    "anchors": true, "rules": true,
    "skills": true, "agents": true, "hooks": true
  },
  "file_patterns": {
    "anchor": ["CLAUDE.md", ".claude/CLAUDE.md"],
    "rules": ".claude/rules/*.md",
    "skills": ".claude/skills/*.md",
    "agents": ".claude/agents/*.md",
    "hooks": ".claude/hooks/*"
  },
  "max_file_sizes": {
    "anchor": 5000, "rules": 10000,
    "skills": 15000, "agents": 8000
  },
  "frontmatter_schema": {
    "rules": {
      "required": ["scope", "severity"],
      "optional": ["action", "rationale", "tags"],
      "severity_values": ["hard", "soft", "info"]
    },
    "skills": {
      "required": ["name", "description"],
      "optional": ["tools_required", "when_to_use", "disable_model_invocation"]
    },
    "agents": {
      "required": ["name"],
      "optional": ["role", "reasoning_style", "allowed_tools", "model"]
    }
  }
}
```

**Template selection fallback chain:**
```
fingerprint → language → framework → template_pack

[node, ts] + [nextjs]   → templates/claude/nextjs/
[node, ts] + [express]  → templates/claude/express/
[node, ts] + [nestjs]   → templates/claude/nestjs/
[python]   + [fastapi]  → templates/claude/fastapi/
[python]   + [django]   → templates/claude/django/
[go]       + [std]      → templates/claude/go/
[rust]     + [axum]     → templates/claude/rust-axum/
[java]     + [spring]   → templates/claude/java-spring/

Fallback: framework-specific → language-base → generic
```

---

### 3.3 Engine 3: Validator

**Contract:** Four sequential layers. Hard failure in layer N short-circuits layer N+1 for that file (other files continue). All errors collected and emitted with: file path, line number, error type, severity, suggested resolution.

#### Layer 1: Structural Engine

| Check | Description |
|---|---|
| File Existence | Files declared in manifest patterns must be present |
| YAML Frontmatter | Parses `---` blocks; reports parse errors with line number |
| Required Fields | Validates required frontmatter fields per manifest (e.g. `scope`, `severity` for rules) |
| File Size Limits | Enforces per-type limits from manifest (e.g. rules ≤ 10 KB) |
| Markdown Well-formedness | Detects unclosed code fences, broken links, malformed heading hierarchy |
| Encoding | Validates UTF-8; rejects BOM-prefixed files |

#### Layer 2: Semantic Engine

| Check | Description |
|---|---|
| Scope Pattern Resolution | Resolves globs against actual filesystem; warns if scope matches zero files |
| Tool Reference Validation | `tools_required` in skills must reference valid agentic tool names |
| Agent Tool-Allowlist | Tools in `allowed_tools` must exist and be spelled correctly |
| Cross-Reference Integrity | Skills referenced by rules must exist in the skills directory |
| Backend Schema Conformance | Validates enums, optional field types, nested schema conformance |
| Empty Rule Bodies | Warns if rule has frontmatter but no body content (vacuous rule) |

#### Layer 3: Logical Engine

Most critical layer. Detects contradictions that would cause the agentic tool to receive conflicting instructions.

| Check | Description |
|---|---|
| Scope Intersection | Rule glob scopes overlap using `fast-glob` + set intersection |
| Severity Conflict | `hard` vs `hard` intersection = ERROR; `hard` vs `soft` = WARNING |
| Semantic Contradiction | Keyword antonym matching on rule action text |
| Circular Skill Dependencies | Topological sort of skill cross-references; reports cycles |
| Rule Precedence Gaps | `04-meta.md` precedence order omits existing rules |
| Orphaned Skills | Skills never referenced by rule/agent with no `when_to_use` |

**Conflict report output format:**
```
[CRITICAL] Rule Conflict Detected
═══════════════════════════════════════════════════════════════
Rule A: .claude/rules/02-api.md (line 3)
  Scope: src/services/**
  Action: All network calls must use internal httpClient
  Severity: hard

Rule B: .claude/rules/03-legacy.md (line 3)
  Scope: src/services/legacy/**
  Action: Use raw fetch() for legacy bridge compatibility
  Severity: hard

Intersection: src/services/legacy/api.ts (and 4 other files)

Suggested Resolutions:
  [1] Narrow Rule A scope: src/services/** !src/services/legacy/**
  [2] Downgrade Rule B severity to: soft
  [3] Merge into one rule with conditional logic
  [4] Add explicit precedence in 04-meta.md
═══════════════════════════════════════════════════════════════
```

#### Layer 4: Drift Engine

| Check | Description |
|---|---|
| Fingerprint Delta | Current fingerprint vs stored `.bp-fingerprint.json` |
| Entry Point Drift | Files declared in anchor have moved or been deleted |
| Test Command Drift | `test_command` in anchor vs current `package.json` scripts |
| Directory Topology Drift | New `src/`/`test/` dirs with no rule coverage |
| Tool Version Drift | Backend (Claude Code, Cursor) has newer manifest version |
| Dependency Drift | New major deps added with no corresponding skill or rule |

---

### 3.4 Engine 4: Translator

**Contract:** Converts blueprints between backends via a tool-agnostic Intermediate Representation (IR). Round-trip fidelity target: >98% (`claude → cursor → claude` reproduces original).

**Two-phase pipeline:**
1. **Parse**: source backend files → IR (Zod-validated for semantic completeness)
2. **Render**: IR → target backend templates → output files (validated against target manifest)

**IR schema:**
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
    tags?: string[];
  }>;
  skills: Array<{
    name: string;
    description: string;
    when_to_use: string;
    tools_required: string[];
    procedure: string;
  }>;
  hooks: Array<{
    event: "pre_tool_use" | "post_tool_use";
    language: string;
    stub: string;
  }>;
  meta: {
    rule_precedence: string[];
    conflict_resolution: string;
    source_backend: string;
    target_backend: string;
  };
}
```

**Supported translation paths:**

| Path | Phase | Fidelity |
|---|---|---|
| Claude Code → Cursor | Phase 3 | High — both use markdown rules |
| Cursor → Claude Code | Phase 3 | High |
| Claude Code → OpenDev | Phase 3 | Medium — skill format differs |
| Claude Code → Generic | Phase 3 | Full — generic is a superset |
| Generic → Any | Phase 3 | High |
| Claude Code → Goose | Phase 4 | Medium — Goose uses YAML profiles |
| Any → Any (chained) | Phase 4 | Via IR hub; no information loss |

---

## 4. CLI Specification

### 4.1 Command Surface

```
bp [command] [options]

init [tool]              Scaffold blueprint for current repository
  --tool <backend>         claude | cursor | opendev | generic (default: auto-detect)
  --template <name>        Use specific template pack (default: auto-detect)
  --force                  Overwrite existing blueprint (preserves user blocks)
  --dry-run                Show unified diff of what would be generated
  --no-verify              Skip post-init validation run

verify                   Validate blueprint integrity
  --level <level>          structural | semantic | logical | drift | all (default: all)
  --json                   Machine-readable JSON output
  --fix                    Auto-correct unambiguous issues
  --watch                  Re-validate on file change
  --fail-on <level>        Exit non-zero only at this severity (default: logical)

sync                     Detect and resolve repository drift
  --auto-apply             Apply all safe fixes without prompting
  --report                 Generate drift report only; no changes

convert                  Translate blueprint between backends
  --from <backend>         Source backend
  --to <backend>           Target backend
  --input <path>           Source directory (default: .)
  --output <path>          Output directory

template                 Manage template packs
  list                     List available packs (official + installed)
  add <path>               Install custom local pack
  install <pkg>            Install from registry (e.g. @bp-templates/fastapi)
  publish <path>           Publish to registry (requires auth token)
  update                   Update all installed packs to latest

doctor                   Diagnostic mode
  --tool <backend>         Diagnose why a tool might ignore config
  --verbose                Full diagnostic trace with timing

rule                     Rule management utilities
  test <file>              Dry-run a rule against mock file scenarios
  lint <file>              Check rule syntax and scope pattern validity
  graph                    Visualize rule scope coverage as ASCII map

hook                     Hook management
  generate                 Generate hook stubs for current backend
  validate <file>          Validate hook safety (no network, no secrets)

config                   Configuration management
  get <key>                Read a config value
  set <key> <value>        Set a config value
  reset                    Reset to defaults

update                   Update bp itself to latest version
```

### 4.2 Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success — all checks passed |
| 1 | General / unexpected error |
| 2 | Validation failed: structural (malformed files) |
| 3 | Validation failed: semantic (bad references, missing fields) |
| 4 | Validation failed: logical (rule conflicts, circular deps) |
| 5 | Drift detected |
| 6 | Unsupported backend requested |
| 7 | Template pack not found |
| 8 | Permission denied on file system |
| 9 | Registry unreachable (network error) |
| 10 | Signature verification failed on template pack |

### 4.3 UX Design Rules (Non-Negotiable)

- Progress spinners for operations >200ms with elapsed time
- Color-coded output: errors red, warnings amber, success green
- Always show resolution path alongside an error — never just the problem
- `--dry-run` on every write command shows a unified diff
- `--json` on all commands for CI/tool integration
- Interactive prompts via ink (React-for-CLI) with keyboard navigation
- No required environment variables — all config via flags or `.bp.json`
- Auto-update notification on every run if outdated

---

## 5. Configuration System

**Global user config (`~/.bp/config.json`):**
```json
{
  "default_backend": "claude",
  "template_registry": "https://registry.npmjs.org",
  "custom_templates": [],
  "auto_verify_on_init": true,
  "auto_fix_level": "structural",
  "ci_mode": false
}
```

**Project config (`.bp.json`, optional, committed to repo):**
```json
{
  "backend": "claude",
  "extends": "@myorg/blueprint-base",
  "overrides": {
    "rules": { "severity_defaults": "soft" }
  },
  "exclude": ["legacy/", "vendor/", "dist/"],
  "plugins": ["@myorg/bp-validate-rationale"]
}
```

---

## 6. Plugin / Extension API

bp exposes a stable TypeScript API for plugins. Plugins add custom validators, new backend adapters, or custom Handlebars helpers. Installed via template registry, declared in `.bp.json`.

```typescript
import { definePlugin, ValidationContext } from "@agentic/bp/plugin";

export default definePlugin({
  name: "my-org-rules",
  version: "1.0.0",
  validators: [{
    id: "require-rationale",
    level: "semantic",
    check: (ctx: ValidationContext) => {
      for (const rule of ctx.blueprint.rules) {
        if (!rule.frontmatter.rationale && rule.frontmatter.severity === "hard") {
          ctx.error(rule.file, rule.line,
            "Hard rules must include a rationale field",
            "Add: rationale: 'Why this constraint exists'");
        }
      }
    }
  }]
});
```

Custom backend adapters require: a `manifest.json`, a template directory, and optionally an IR parser.

---

## 7. Project Structure

Generate exactly this structure. Do not create files not listed here unless an ADR justifies it.

```
bp/
├── src/
│   ├── cli/                    # Commander.js command definitions
│   │   ├── index.ts
│   │   ├── commands/
│   │   │   ├── init.ts
│   │   │   ├── verify.ts
│   │   │   ├── sync.ts
│   │   │   ├── convert.ts
│   │   │   ├── template.ts
│   │   │   ├── doctor.ts
│   │   │   ├── rule.ts
│   │   │   ├── hook.ts
│   │   │   ├── config.ts
│   │   │   └── update.ts
│   │   └── ui/                 # ink components for interactive prompts
│   ├── detector/
│   │   ├── index.ts
│   │   ├── languages.ts
│   │   ├── frameworks.ts
│   │   ├── tooling.ts
│   │   ├── fingerprint.ts      # Zod schema + builder
│   │   └── security.ts
│   ├── templater/
│   │   ├── index.ts
│   │   ├── engine.ts           # Handlebars setup + helpers
│   │   ├── merger.ts           # Idempotent block merging
│   │   ├── selector.ts         # fingerprint → template pack resolution
│   │   └── writer.ts           # FS output + .blueprintignore + --dry-run diff
│   ├── validator/
│   │   ├── index.ts            # Pipeline orchestrator
│   │   ├── structural.ts
│   │   ├── semantic.ts
│   │   ├── logical.ts          # Tarjan SCC + scope intersection
│   │   └── drift.ts
│   ├── translator/
│   │   ├── index.ts
│   │   ├── ir.ts               # BlueprintIR type + Zod schema
│   │   └── adapters/
│   │       ├── claude.ts
│   │       ├── cursor.ts
│   │       ├── opendev.ts
│   │       └── generic.ts
│   ├── registry/
│   │   ├── index.ts
│   │   ├── client.ts           # npm-compatible registry client
│   │   └── signer.ts           # Signature verification
│   ├── config/
│   │   ├── index.ts
│   │   ├── user.ts             # ~/.bp/config.json
│   │   └── project.ts          # .bp.json
│   └── plugin/
│       ├── index.ts
│       ├── loader.ts
│       └── types.ts            # definePlugin, ValidationContext API
├── templates/
│   ├── _base/
│   │   ├── partials/
│   │   │   ├── security-rules.md.hbs
│   │   │   ├── style-rules.md.hbs
│   │   │   └── test-patterns.md.hbs
│   │   └── helpers.js
│   ├── claude/
│   │   ├── manifest.json
│   │   ├── CLAUDE.md.hbs
│   │   ├── agents/
│   │   │   ├── planner.md.hbs
│   │   │   ├── implementer.md.hbs
│   │   │   └── reviewer.md.hbs
│   │   ├── rules/
│   │   │   ├── 01-position.md.hbs
│   │   │   ├── 02-security.md.hbs
│   │   │   ├── 03-style.md.hbs
│   │   │   └── 04-meta.md.hbs
│   │   └── skills/
│   │       ├── add-test.md.hbs
│   │       └── refactor-async.md.hbs
│   ├── cursor/
│   │   ├── manifest.json
│   │   └── ...
│   ├── opendev/
│   │   ├── manifest.json
│   │   └── ...
│   └── generic/
│       └── ...
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── e2e/
│   ├── fuzz/
│   ├── snapshots/              # Template render golden files
│   └── fixtures/               # Representative repos (see §10)
├── docs/
│   ├── README.md
│   ├── template-authoring.md
│   ├── backend-adapter.md
│   └── ci-integration.md
├── .github/
│   └── workflows/
│       ├── ci.yml              # test, lint, typecheck, security-scan
│       └── release.yml         # Changesets + npm publish + binaries
├── biome.json                  # Unified linter + formatter
├── tsconfig.json               # strict: true, no implicit any
├── vitest.config.ts
├── package.json
├── CHANGELOG.md
└── LICENSE                     # MIT
```

**Output after `bp init --tool claude`:**
```
project-root/
├── CLAUDE.md
├── .claude/
│   ├── agents/
│   │   ├── planner.md
│   │   ├── implementer.md
│   │   └── reviewer.md
│   ├── rules/
│   │   ├── 01-position.md
│   │   ├── 02-security.md
│   │   ├── 03-style.md
│   │   └── 04-meta.md
│   ├── skills/
│   │   ├── add-test.md
│   │   └── refactor-async.md
│   └── hooks/
│       └── pre_tool_use.js     # stub only
├── .blueprintignore
├── .bp.json
└── .github/
    └── workflows/
        └── blueprint-verify.yml
```

---

## 8. Technology Stack

| Component | Technology | Rationale |
|---|---|---|
| Runtime | Bun / Node.js 20+ | Bun for single-binary distribution; Node for CI compatibility |
| Language | TypeScript 5.x | `strict: true`, no implicit `any` |
| CLI Framework | Commander.js | Mature, sub-command architecture, stable API |
| Interactive UI | ink (React-for-CLI) | Component model for prompts, progress, spinners |
| Template Engine | Handlebars | Logic-less, auditable, zero runtime deps post-compile |
| Schema Validation | Zod | TypeScript-native, composable, excellent error messages |
| Glob Matching | fast-glob + picomatch | Industry standard, supports negation patterns |
| Markdown Parsing | gray-matter + remark | Frontmatter extraction + AST for structural validation |
| Testing | Vitest | Fast, native TypeScript, excellent watch mode |
| Linting/Formatting | Biome | Unified formatter + linter, minimal config, fast |
| Build | `bun build --compile` | Single binary, zero runtime dependencies |
| Logging | pino | Structured JSON, CI-friendly |
| Error Formatting | cliui + chalk | Human-readable colored output |

---

## 9. Implementation Phases

### Phase 1: Core Foundation (Weeks 1–3)
**Gate: Ask user before starting.**

**Goal:** Working `bp init --tool claude` and `bp verify --level structural`.

#### 1.1 Project Bootstrap
```bash
mkdir bp && cd bp
bun init                          # or: npm init
bun add -D typescript vitest biome @types/bun
bun add commander ink zod handlebars gray-matter remark fast-glob picomatch chalk ora pino
```

Configure:
- `tsconfig.json`: `strict: true`, `noImplicitAny: true`, `target: "ES2022"`
- `biome.json`: unified lint + format, no tabs, 2-space indent
- `vitest.config.ts`: coverage threshold 95%
- `.github/workflows/ci.yml`: Node 20 + Bun matrix, lint, typecheck, test

#### 1.2 Detector Engine v1
- Language support: TypeScript/JS, Python, Go, Rust, Java/Kotlin, Ruby
- File existence heuristics only (no `fs.readFile` on all files — check for existence, read lockfiles)
- Lockfile parsing: `package-lock.json`, `go.mod`, `Cargo.toml`, `requirements.txt`, `pyproject.toml`
- Directory topology scanning (list top-level dirs only, categorize)
- Output: `Fingerprint` object validated with Zod
- Unit tests: all detection signals covered; >95% coverage

#### 1.3 Templater Engine v1
- Handlebars integration with allowlisted helpers (no arbitrary JS execution)
- Base template pack: `_base/` shared partials
- Claude Code template pack: full 5-layer blueprint for TypeScript/Node.js
- Block-level merging (`merger.ts`): parse existing files into generated blocks + preserve blocks, replace generated, keep preserved
- Writer: filesystem I/O with `.blueprintignore` support and `--dry-run` unified diff output
- File conflict resolution: if existing file has no markers → prompt user (or `--force`); if has markers → auto-merge

#### 1.4 Validator v1 — Structural Layer Only
- Frontmatter YAML parsing with line-precise errors (gray-matter)
- Required field presence checks against `manifest.json` schema
- File size limit enforcement
- Markdown well-formedness: unclosed code fences, heading hierarchy
- UTF-8 + BOM detection

#### 1.5 CLI — Phase 1 Commands
- `bp init --tool claude` — calls Detector → Templater → Writer → Validator (structural)
- `bp verify --level structural` — calls Validator structural layer only
- `bp --version`, `bp --help`

**Milestone:** `bp init --tool claude` generates a working 5-layer blueprint for a Node.js project. `bp verify` catches malformed frontmatter. All Phase 1 tests pass.

**Deliverables before proceeding:**
- [ ] `bun test` exits 0, coverage ≥ 95%
- [ ] `biome check src/` exits 0
- [ ] `bp init --tool claude` on a Node.js fixture repo produces valid output
- [ ] `bp verify` detects a malformed frontmatter file

---

### Phase 2: Integrity Engine (Weeks 4–6)
**Gate: Ask user before starting.**

**Goal:** Full 4-layer validation. `bp verify` catches all error classes. `bp sync` resolves drift.

#### 2.1 Detector Engine v2
- Framework detection: React, Next.js, NestJS, FastAPI, Django, Axum, Rails, Spring Boot
- Security signal detection: auth patterns, external API calls, secrets manager usage, Docker presence
- Full language coverage: add Ruby, Dart/Flutter, C#, Swift, C/C++
- Confidence scoring per dimension

#### 2.2 Validator — Semantic Layer
- `fast-glob` scope pattern resolution against actual filesystem — warn on zero-match patterns
- Tool reference validation: `tools_required` values checked against known agentic tool capabilities
- Agent `allowed_tools` field validation
- Cross-reference integrity: rules referencing skills → verify skill files exist
- Backend schema conformance: all enum values, optional field types

#### 2.3 Validator — Logical Layer
- Rule scope intersection algorithm:
  1. Resolve each rule's glob pattern to a file set using `fast-glob`
  2. Compute pairwise set intersection
  3. Non-empty intersection + both `hard` severity = ERROR
  4. Non-empty intersection + one `hard`, one `soft` = WARNING
  5. Keyword antonym matching on action text = ERROR
- Tarjan's SCC algorithm for circular skill dependency detection (`O(V+E)`)
- Rule precedence gap detection

#### 2.4 Validator — Drift Layer
- Fingerprint storage: `.bp-fingerprint.json` (gitignored by default, opt-in to commit)
- Delta comparison: generate current fingerprint, compare against stored
- Entry point drift: check if files declared in spatial anchor still exist at declared paths
- Test command drift: compare anchor `test_command` against current `package.json` scripts
- Directory topology drift: new `src/`/`test/` dirs → check rule coverage
- Dependency drift: new major deps in lockfile → check for corresponding skill or rule

#### 2.5 New Commands
- `bp sync` — interactive drift resolution with ink UI (show drift report, prompt per issue, apply fixes)
- `bp verify --fix` — auto-correct unambiguous structural issues
- `bp verify --watch` — file watcher, re-validates on change, debounced 300ms
- `bp verify --json` — machine-readable JSON output for CI pipelines

#### 2.6 Integration Tests
- 10 fixture repos: `node-express`, `node-nextjs`, `node-nestjs`, `node-monorepo`, `python-fastapi`, `python-django`, `go-std`, `go-microservices`, `rust-axum`, `mixed-language`
- Each fixture: run `bp init --tool claude`, run `bp verify --level all`, assert exit code 0
- Conflict fixture: repo with two conflicting hard rules → assert exit code 4

**Milestone:** `bp verify` detects a rule conflict between two `.claude/rules/*.md` files. `bp sync` detects Jest → Vitest migration in `package.json`.

**Deliverables before proceeding:**
- [ ] All 4 validation layers implemented and tested
- [ ] `bp verify` exits 4 on the conflict fixture
- [ ] `bp sync` correctly detects and reports drift on the drift fixture
- [ ] Integration tests pass on all 10 fixture repos

---

### Phase 3: Ecosystem & Distribution (Weeks 7–9)
**Gate: Ask user before starting.**

**Goal:** Multi-backend support, template registry, all distribution channels live.

#### 3.1 Translator Engine
- `BlueprintIR` Zod schema (strict validation)
- Claude Code adapter: parse `.claude/` files → IR
- Cursor adapter: render IR → `.cursor/` files
- Generic adapter: IR → backend-agnostic markdown
- `bp convert` command
- Round-trip snapshot tests: `claude → cursor → claude` must be semantically equivalent

#### 3.2 Additional Template Packs
- Cursor: `.cursor/rules/*.md`, `.cursor/agents/`, `context.md`
- OpenDev: `.opendev/` skill registry format
- Generic: backend-agnostic markdown (superset of all)
- Framework-specific packs: `python-fastapi`, `python-django`, `go-std`, `rust-axum`

#### 3.3 Template Registry Client
- npm-compatible registry client (`registry/client.ts`)
- Package signing: verify `@bp-templates/` package signatures before extraction
- `bp template list` — list official + installed packs with version info
- `bp template install @bp-templates/fastapi` — download, verify, extract
- `bp template publish` — pack, sign, upload (requires auth token)
- Pack versioning: semver, respect version ranges in `.bp.json`

#### 3.4 `bp doctor` Command
- Diagnose why a backend tool might ignore a blueprint
- Check: file presence, manifest version, schema conformance, file size limits
- Output: per-check pass/warn/fail with resolution for each failure
- `--verbose` mode: full timing breakdown per check

#### 3.5 `bp rule graph` Command
- ASCII visualization of rule scope coverage across the project
- Highlight: uncovered directories, conflicting scopes, orphaned skills

#### 3.6 Distribution
- npm: `npm publish --access public` → `@agentic/bp`
- Standalone binary: `bun build --compile src/cli/index.ts --outfile bp` → Linux, macOS (arm64, x64), Windows
- GitHub Releases: upload binaries + checksums on every tag
- Docker: `ghcr.io/agentic/bp:latest` → scratch + binary, <20MB
- Homebrew formula: `agentic-blueprint` (submit to homebrew-core or tap)

#### 3.7 Documentation
- `docs/00-README.md`: quickstart (< 5 commands to generate first blueprint), badges, architecture diagram
- `docs/13-template-authoring.md`: how to write a custom template pack
- `docs/14-backend-adapter.md`: how to implement a new backend adapter
- `docs/16-ci-integration.md`: GitHub Actions, GitLab CI, pre-commit hook examples

**Milestone:** `bp init --tool cursor` generates Cursor-native blueprint. `bp convert --from claude --to cursor` produces correct output. npm package installable via `npx @agentic/bp`.

**Deliverables before proceeding:**
- [ ] Translator round-trip tests pass (≥98% fidelity)
- [ ] Cursor + OpenDev + Generic template packs generate valid output
- [ ] `npm publish` dry run succeeds
- [ ] Docker image builds and `docker run ghcr.io/agentic/bp verify` works
- [ ] All snapshot tests pass

---

### Phase 4: Production Hardening (Weeks 10–12)
**Gate: Ask user before starting.**

**Goal:** Enterprise-ready reliability, performance, IDE support, 95%+ test coverage.

#### 4.1 Performance Optimization
- Parallel file scanning in Detector using `Promise.all` with bounded concurrency (worker pool size = CPU count)
- Incremental validation in Validator: track file mtimes, skip unchanged files
- Large repo support: test on 10,000+ file repos, verify `bp init` < 8s
- Handlebars template compilation caching (warm render < 50ms)

#### 4.2 CI/CD Integrations
- GitHub Action `agentic-blueprint/verify@v1`: composite action, inputs `backend`, `level`, `fail-on`, `json-report`
- GitLab CI template (`.gitlab-ci.yml` snippet in docs)
- Azure DevOps extension (YAML task)
- Pre-commit hook: `.pre-commit-hooks.yaml` in the `bp` repo

#### 4.3 Enterprise Features
- Blueprint inheritance: `.bp.json` `extends` field resolves from registry, applies base before local overrides
- Org-wide base templates: private registry support (any npm-compatible registry, configurable via `config set registry`)
- Audit logging: structured JSON log of every bp operation (`~/.bp/audit.log`, rotated daily)
- Batch mode: `bp verify` on multiple directories via glob input

#### 4.4 Security Hardening
- Template sandboxing: Handlebars context is deep-frozen before rendering
- Hook stub safety validation: `bp hook validate` checks generated hooks for: no `require('child_process')`, no `fetch`, no hardcoded secrets
- Post-generation secret scan: detect API key patterns, JWT tokens, private key headers in generated output
- Path traversal prevention: all output paths resolved relative to project root, validated against `../` patterns

#### 4.5 IDE Integration — `blueprint-lsp`
- Language Server Protocol server in `src/lsp/` (Phase 4 new module)
- Real-time linting as user edits `.claude/rules/*.md` files
- Inline diagnostics: red underlines on malformed frontmatter, zero-match scope patterns
- Quick-fix code actions for unambiguous errors
- Blueprint explorer: workspace symbol for all rules, skills, agents
- VS Code extension wrapper (`editors/vscode/`) — thin client over LSP server

#### 4.6 Fuzz Testing
- 1000+ random repository file trees via `fast-check` property-based testing
- Invariants: no panics, no hangs, no data corruption, exit code always in [0,10]
- Coverage: malformed YAML, binary files in blueprint dirs, symlinks, empty dirs, Unicode filenames

#### 4.7 Backward Compatibility
- Blueprint schema version pinned in `.bp-fingerprint.json`
- `bp migrate` command: when installed bp version > fingerprint schema version, offer migration
- Guarantee: blueprints generated by bp v1.x are valid under bp v2.x without manual changes

**Milestone:** `bp` runs in GitHub Actions on a 500-repo organization. 95%+ test coverage enforced. VS Code extension shows inline errors.

**Deliverables before proceeding:**
- [ ] `bun test --coverage` ≥ 95%
- [ ] Fuzz tests: 1000 runs, zero panics
- [ ] Performance: `bp init` < 2s on 1,000-file repo, < 8s on 10,000-file repo
- [ ] GitHub Action works end-to-end in a test repo
- [ ] VS Code extension: live linting on `.claude/rules/*.md`
- [ ] Snyk + CodeQL: zero high-severity findings

---

## 10. Testing Strategy

### Test Pyramid

| Layer | Count | Type | Tooling |
|---|---|---|---|
| Unit | 200+ | Fast, isolated | Vitest |
| Integration | 50+ | Fixture repos | Vitest + fixtures |
| E2E | 20+ | CLI commands on temp dirs | Vitest + execa |
| Snapshot | 100+ | Template render output | Vitest snapshots |
| Round-trip | 50+ | Translation fidelity | Vitest |
| Fuzz | 1000+ | Random repo structures | fast-check |
| Performance | 10+ | Large repos, timing | Vitest + custom bench |
| Security | 30+ | Adversarial inputs | Vitest |

### Fixture Repository Library (`tests/fixtures/`)

| Fixture | Stack |
|---|---|
| `node-express` | Node.js + Express + TypeScript + Jest + ESLint |
| `node-nextjs` | Next.js 14 App Router + TypeScript + Vitest |
| `node-nestjs` | NestJS + TypeScript + Jest + Swagger |
| `node-monorepo` | pnpm workspace + Turborepo |
| `python-fastapi` | FastAPI + Pydantic + pytest + Ruff + Poetry |
| `python-django` | Django 5 + pytest-django + Black |
| `go-std` | Go stdlib + go test + golangci-lint |
| `go-microservices` | Multi-service Go + Makefile + Docker Compose |
| `rust-axum` | Axum + Tokio + cargo test + rustfmt |
| `java-spring` | Spring Boot 3 + Maven + JUnit 5 |
| `ruby-rails` | Rails 7 + RSpec + Rubocop |
| `mixed-language` | Python backend + TypeScript frontend |

### Quality Gates (CI enforcement — PR fails if any fail)

- Coverage ≥ 95% (Vitest coverage reporter → Codecov)
- Zero known false positives: all fixture repos pass `bp verify --level all`
- Detection accuracy ≥ 95%: validated against fixture suite
- Template render correctness 100%: all snapshot tests pass
- Round-trip fidelity ≥ 98%: all translation round-trip tests pass
- No performance regressions: benchmark suite on every merge to main
- Security: Snyk + CodeQL on every PR; zero high-severity findings blocks merge

---

## 11. Performance Targets

| Operation | Target | Condition |
|---|---|---|
| `bp init` | < 2s | Repos up to 1,000 files |
| `bp init` | < 8s | Repos up to 10,000 files (parallel scanning) |
| `bp verify` | < 1s | Incremental (only changed files) |
| `bp verify --level all` | < 5s | Full validation including drift |
| Template render (cold) | < 500ms | First run, cache miss |
| Template render (warm) | < 50ms | Cached template compilation |
| Memory footprint | < 100MB peak | During detection of large repos |
| Binary size | < 50MB | Single compiled binary with all deps |

---

## 12. Security Model

| Threat | Mitigation |
|---|---|
| Malicious template code execution | Handlebars is logic-less; no `eval`/`require`; helpers allowlisted |
| Secrets leaked into generated files | Post-generation scan for API keys, JWT tokens, private key headers |
| Template registry serves malicious packs | All `@bp-templates/` packages signed; bp verifies before extraction |
| Path traversal in template output | All output paths resolved relative to root, validated against `../` |
| Hook files with dangerous code | bp generates stubs only — never executes hooks |
| Prototype pollution in template context | Template context deep-frozen before Handlebars rendering |
| Adversarial repo structure (symlinks, etc.) | All file reads use `O_NOFOLLOW` equivalent; symlinks resolved only within project root |

---

## 13. Distribution Channels

| Channel | Package | Install |
|---|---|---|
| npm | `@agentic/bp` | `npx @agentic/bp init` |
| Homebrew | `agentic-blueprint` | `brew install agentic-blueprint` |
| GitHub Releases | Prebuilt binaries | `curl -fsSL https://get.agentic.dev/bp \| bash` |
| Docker | `ghcr.io/agentic/bp` | `docker run ghcr.io/agentic/bp verify` |
| Winget | `agentic.blueprint` | `winget install agentic.blueprint` |
| Cargo | `bp` (Phase 4+) | `cargo install bp` |

---

## 14. Architecture Decision Records

### ADR-001: Runtime — Bun-first with Node.js fallback
- **Decision:** Bun as primary runtime for `bun build --compile` single-binary distribution. Node.js 20 LTS supported for environments where Bun is not available.
- **Consequence:** Avoid Bun-only APIs in hot paths; use standard Node.js APIs throughout for compatibility.

### ADR-002: Template Engine — Handlebars, not Jinja2 or EJS
- **Decision:** Handlebars. Logic-less by design — impossible to accidentally embed arbitrary code in a template. EJS was rejected because `<% ... %>` allows arbitrary JS.
- **Consequence:** All conditional logic in template selection lives in `selector.ts`, not in template files.

### ADR-003: Validation Architecture — Sequential layers, fail-fast per file
- **Decision:** Structural failures short-circuit semantic/logical/drift for that file, but other files continue. All errors collected before output.
- **Consequence:** Users see all errors in one run, not one at a time.

### ADR-004: Scope Intersection — fast-glob + in-memory set operations
- **Decision:** Materialize each rule's file set via `fast-glob`, then compute pairwise intersection in memory. For large repos, sample the filesystem up to 10,000 files per pattern.
- **Consequence:** Very large monorepos (100,000+ files) may have slower logical validation. Document the 10,000-file sampling limit.

### ADR-005: IR Translation — Two-phase parse/render, not direct transformation
- **Decision:** Always go through `BlueprintIR`. Never translate directly Claude → Cursor without IR as intermediate. Ensures all translation paths maintain semantic equivalence.
- **Consequence:** Adding a new backend requires only an IR parser and a template pack — not N × M translation adapters.

### ADR-006: Plugin Contract — TypeScript API only (Phase 1-3), WASM optional (Phase 4+)
- **Decision:** Plugin API is TypeScript-first. WASM sandbox is a Phase 4 enhancement for untrusted third-party plugins, not required for org-internal plugins.
- **Consequence:** First-party and org plugins load as Node modules. Third-party marketplace plugins run in WASM sandbox.

### ADR-007: Idempotency — Block markers, not full-file regeneration
- **Decision:** Track generated content with `<!-- bp-generated:begin ID -->` / `<!-- bp-generated:end ID -->` markers. Merge at block level, not file level.
- **Consequence:** Users can add content anywhere in a file without losing it on `bp init` re-runs.

---

## 15. Code Quality Mandates

- **TypeScript:** `strict: true`. No `any` without an inline comment explaining why.
- **Testing:** Write tests alongside implementation. Every exported function has at least one test. Every error code has a test that triggers it.
- **Linting:** `biome check` must exit 0. No exceptions via inline comments without a Jira/issue reference.
- **Error Messages:** Every thrown error must include: file path (if applicable), line number (if applicable), error type, human explanation, at least one suggested fix.
- **No silent failures:** Never swallow errors. Log at `warn` level minimum, rethrow or return a typed error result.
- **Dependency policy:** Only mature, stable packages (no 0.x in production paths). Lockfile committed. `npm audit` / `bun audit` zero critical findings.
- **No backwards-compatibility shims** unless supporting an active migration path documented in CHANGELOG.

---

## 16. Success Criteria

The implementation is complete ONLY when ALL of the following pass:

- [ ] `bun test --coverage` exits 0, coverage ≥ 95%
- [ ] `biome check src/ templates/` exits 0
- [ ] `bun run build` produces single binary < 50MB
- [ ] `bp init --tool claude` on all 12 fixture repos exits 0 and produces valid output
- [ ] `bp verify --level all` on all 12 fixture repos exits 0
- [ ] `bp verify` exits 4 on the conflict fixture (two conflicting `hard` rules)
- [ ] `bp convert --from claude --to cursor` round-trip fidelity ≥ 98%
- [ ] `bp init` < 2s on 1,000-file repo, < 8s on 10,000-file repo
- [ ] Snyk + CodeQL: zero high-severity findings
- [ ] npm package installable: `npx @agentic/bp --version` exits 0
- [ ] Docker image: `docker run ghcr.io/agentic/bp verify` exits 0 on a valid blueprint
- [ ] GitHub Action: `agentic-blueprint/verify@v1` runs successfully in a test repo
- [ ] Fuzz tests: 1000 random repos, zero panics
- [ ] VS Code extension: live linting fires on a malformed `.claude/rules/` file
- [ ] A new contributor can `git clone` → `bun install` → `bun test` in < 5 minutes following README

---

## 17. Commit Convention

All commits must follow Conventional Commits:

```
feat(detector): add Swift language detection via Package.swift
fix(validator): correct line number offset in YAML frontmatter errors
test(integration): add rust-axum fixture repo
docs(readme): add quickstart section with 3-command example
perf(templater): cache compiled Handlebars templates in memory
refactor(translator): extract IR validation to separate module
chore(deps): upgrade fast-glob to 3.3.2
```

Commit after every sub-task. Do not batch unrelated changes into one commit.

---

*blueprint (bp) — SPEC v2.0 · Single source of truth · 2026-05-28*
