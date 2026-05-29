# Open Blueprint Documentation Restructure Plan
## Adopting OpenSpec-Style Documentation Architecture

---

## 1. Executive Summary

**Current State:** Open Blueprint (`bp`) documentation is a single, dense README.md (~400+ lines) containing philosophy, architecture, CLI reference, recipes, configuration, plugin API, and developer guide.

**Target State:** A multi-page, progressive-disclosure documentation system inspired by [OpenSpec](https://github.com/Fission-AI/OpenSpec) that separates concepts, workflows, commands, and guides into focused, navigable documents.

**Goal:** Improve developer onboarding, reduce cognitive load, and create a documentation system that scales with feature growth while maintaining `bp`'s technical depth.

---

## 2. Current State Analysis

### Strengths
- Comprehensive single-source reference
- Strong visual hierarchy (emojis, diagrams, tables)
- Clear architecture diagrams (Mermaid/graph)
- Detailed CLI exit codes and recipes
- Plugin API example is concrete

### Pain Points (OpenSpec-Solved)
| Pain Point | Impact | OpenSpec Solution |
|---|---|---|
| **Monolithic README** | New users face a wall of text; hard to find specific topics | Split into `docs/` with focused pages |
| **No progressive disclosure** | Beginners see advanced topics (plugin API, drift detection) before basics | `getting-started.md` → `workflows.md` → `concepts.md` → `advanced.md` |
| **Missing philosophy narrative** | Technical docs lack the "why" story that builds trust | Dedicated `philosophy.md` with principles |
| **No workflow guidance** | Users don't know *when* to use which command | `workflows.md` with patterns and decision trees |
| **No glossary** | Terms like "Fingerprint", "IR", "Block-Level Merging" are assumed known | `concepts.md` with structured glossary |
| **No troubleshooting** | Users hit errors without guidance | `troubleshooting.md` with symptom→solution mapping |
| **Missing onboarding path** | No guided first experience | `getting-started.md` with step-by-step first run |

---

## 3. Target Documentation Architecture

### 3.1 File Structure

```
docs/
├── README.md                 # Landing page: what is bp, quick install, nav links
├── getting-started.md        # First 5 minutes: install, init, verify
├── philosophy.md             # Why bp exists: 5 principles, brownfield-first story
├── concepts.md               # Core ideas: 5 Layers, 4 Engines, Fingerprint, IR, Deltas
├── workflows.md              # When to use what: bootstrap, CI, convert, enterprise
├── commands.md               # Full CLI reference (expanded from current)
├── configuration.md          # .bp.json schema, global config, inheritance
├── recipes.md                # Practical use cases (extracted from current README)
├── plugin-api.md             # TypeScript plugin development guide
├── troubleshooting.md        # Common errors, exit code decoder, diagnostic steps
├── contributing.md           # Dev setup, build, test, PR guidelines
└── glossary.md               # Terms: Fingerprint, BlueprintIR, Block Merge, etc.
```

### 3.2 Content Mapping (Current → Target)

| Current README Section | Target File | Notes |
|---|---|---|
| Core Philosophy | `philosophy.md` | Expand with "brownfield-first" narrative and comparison to alternatives |
| 5 Blueprint Layers | `concepts.md` (Layers section) | Add visual diagram per layer, add "when to customize" guidance |
| 4 Engines | `concepts.md` (Engines section) | Keep architecture diagram, add engine interaction flow |
| CLI Command Reference | `commands.md` | Expand each command with examples, add command decision tree |
| CLI Exit Codes | `troubleshooting.md` + `commands.md` | Cross-reference: exit codes in CLI ref, deep-diagnostics in troubleshooting |
| Practical Recipes | `recipes.md` | Add "recipe selector" (if X, do Y) at top |
| Configuration System | `configuration.md` | Add JSON schema documentation, validation rules |
| Plugin / Extension API | `plugin-api.md` | Add more examples (3+ plugins), add lifecycle hooks diagram |
| Developer Guide | `contributing.md` | Add architecture decision records (ADRs) section |
| License | `README.md` footer | Keep minimal |

---

## 4. Style & Format Improvements (Adopted from OpenSpec)

### 4.1 Permalink Headers
Every H2/H3 gets a permalink for deep linking:
```markdown
## 🎯 Core Philosophy
Permalink: Core Philosophy
```

### 4.2 Philosophy Block
Replace current bullet list with a visual philosophy block:
```
scaffolding-only not invasive    — generates native configs, then bp can be uninstalled
idempotent not destructive       — block-level merging preserves manual edits
fail-loud not silent             — line-precise errors with actionable resolutions
backend-agnostic not locked      — IR enables Claude ↔ Cursor ↔ OpenDev translation
brownfield-first not greenfield  — detects existing repos, never assumes blank slate
```

### 4.3 Two-Mode Documentation
Like OpenSpec's "core vs expanded" profiles, document `bp` for two personas:

**Quick Path (Individual Developer):**
```
bp init claude → bp verify → [code with agent] → bp sync
```

**Expanded Path (Team/Enterprise):**
```
bp config set template_registry → bp init → bp verify --level all → bp convert → CI pipeline
```

### 4.4 Artifact Flow Diagram
For `concepts.md`, adopt OpenSpec's artifact flow style for the 5 Layers:
```
Repository ──► Detector ──► Fingerprint ──► Templater ──► Blueprint Files ──► Validator ──► Translator
   │              │              │               │                  │                │
   └──────────────┴──────────────┴───────────────┴──────────────────┴────────────────┘
                        bp:preserve blocks retain developer edits
```

### 4.5 Workflow Pattern Tables
In `workflows.md`, adopt OpenSpec's pattern tables:

| Pattern | Commands | Best For |
|---|---|---|
| Quick Bootstrap | `bp init` → `bp verify` | New repo, solo dev, fast setup |
| CI Governance | `bp verify --level all --fail-on logical` | Team enforcement, PR gates |
| Cross-Team Sync | `bp convert --from claude --to cursor` | Mixed IDE environments |
| Enterprise Inherit | `bp config set template_registry` → `bp init` | Org-wide policy compliance |
| Drift Remediation | `bp sync --auto-apply` | Long-lived repos, dependency updates |

### 4.6 Verification Dimensions
For `bp verify`, adopt OpenSpec's three-dimension verification style:

```
You: bp verify --level all

bp:  Verifying blueprint integrity...

     STRUCTURAL
     ✓ All YAML frontmatter valid
     ✓ Markdown syntax correct
     ✓ UTF-8 encoding confirmed

     SEMANTIC
     ✓ All skill references resolve
     ✓ Tool references exist in backend allowlist
     ✓ Scope globs match at least one file

     LOGICAL
     ✓ No circular skill dependencies (Tarjan SCC)
     ✓ No conflicting hard-rule overlaps
     ✓ Precedence declarations complete

     DRIFT
     ✓ Fingerprint matches current repo topology
     ✓ Entry points unchanged
     ✓ Test commands consistent

     SUMMARY
     ─────────────────────────────
     Critical issues: 0
     Warnings: 1 (legacy/ dir uncovered by rules)
     Exit code: 0 (with warnings)
```

---

## 5. New Content to Create

### 5.1 `getting-started.md` — The Missing Onboarding

**Structure:**
1. **Prerequisites** (Node 20+, Bun 1.1+ for compile)
2. **Install** (`npm install -g @agentic/bp` or `npx`)
3. **Your First Blueprint** (walkthrough with expected output)
4. **Verify Your Setup** (what `bp verify` should show)
5. **Make It Yours** (edit a `bp:preserve` block, re-run `bp init`)
6. **Next Steps** (links to workflows, concepts, recipes)

**Include a "See it in action" block like OpenSpec:**
```
You: bp init claude
bp:  Detecting repository...
     ✓ TypeScript (Express) detected (confidence: 1.0)
     ✓ Scaffolding CLAUDE.md
     ✓ Scaffolding .claude/agents/
     ✓ Scaffolding .claude/rules/
     ✓ Scaffolding .claude/skills/
     ✓ Writing .bp-fingerprint.json
     Ready for agent governance!

You: bp verify
bp:  Validating blueprint...
     ✓ Structural: 12 files passed
     ✓ Semantic: All scopes resolve
     ✓ Logical: No circular dependencies
     ✓ Drift: Repository matches fingerprint
     All checks passed!
```

### 5.2 `troubleshooting.md` — Exit Code Decoder

Map every exit code (0-10) to:
- **Symptom** (what the user sees)
- **Likely Cause**
- **Resolution Steps**
- **Prevention**

Add a "Doctor Diagnostic" section:
```
You: bp doctor --tool claude --verbose
bp:  Running diagnostics...
     ✓ CLAUDE.md found at repo root
     ✓ .claude/ directory readable
     ✓ Backend "claude" supported
     ⚠ Hook script .claude/hooks/pre_tool_use.js contains fetch() call
     ⚠ Rule 03-style.md has zero-match scope: "src/styles/**/*.css"

     Recommendations:
     1. Remove fetch() from hook or whitelist in .bp.json
     2. Update scope to "src/styles/**/*.ts" or delete rule if migrated
```

### 5.3 `glossary.md` — Terms & Concepts

| Term | Definition | Where Used |
|---|---|---|
| **Fingerprint** | Zod-validated static analysis snapshot of repo topology, languages, frameworks, tooling | Detector Engine, Drift Detection |
| **BlueprintIR** | Backend-agnostic Intermediate Representation of all governance files | Translator Engine |
| **Block-Level Merge** | Idempotent file update strategy using `bp-generated` and `bp:preserve` markers | Templater Engine |
| **5 Layers** | Spatial Anchor, Personas, Rules, Skills, Hooks | Architecture |
| **4 Engines** | Detector, Templater, Validator, Translator | System Architecture |
| **Drift** | Deviation between stored Fingerprint and current repo state | `bp sync`, `bp verify --level drift` |
| **Template Pack** | Cryptographically signed Handlebars template collection | `bp template install` |

---

## 6. README.md Restructure

The README should become a **landing page**, not a reference manual.

### Proposed README Structure

```markdown
# open-blueprint (`bp`)

[Banner/Diagram]

> Zero-runtime-overhead governance for agentic AI tools. Scaffolds, validates, and translates configuration across Claude, Cursor, OpenDev, and Goose.

[Badges: npm version, CI, license]

## What is bp?

2-paragraph elevator pitch + architecture diagram.

## Quick Start

```bash
npx @agentic/bp init claude
npx @agentic/bp verify
```

## Documentation

- [Getting Started](docs/getting-started.md) — Install and first blueprint
- [Philosophy](docs/philosophy.md) — Why bp exists and how it thinks
- [Concepts](docs/concepts.md) — 5 Layers, 4 Engines, Fingerprint, IR
- [Workflows](docs/workflows.md) — Patterns for solo, team, CI, and enterprise
- [Commands](docs/commands.md) — Full CLI reference
- [Recipes](docs/recipes.md) — Practical examples and copy-paste snippets
- [Configuration](docs/configuration.md) — .bp.json and global settings
- [Plugin API](docs/plugin-api.md) — Build custom validators
- [Troubleshooting](docs/troubleshooting.md) — Exit codes and diagnostics
- [Contributing](docs/contributing.md) — Dev setup and build instructions

## Supported Backends

[Table: Backend | File Pattern | Status]

## License

MIT
```

---

## 7. Migration Checklist

### Phase 1: Scaffold Structure
- [ ] Create `docs/` directory
- [ ] Create all `.md` files with frontmatter headers
- [ ] Add `docs/README.md` as docs landing page

### Phase 2: Content Migration
- [ ] Extract **Core Philosophy** → `docs/philosophy.md` (expand with narrative)
- [ ] Extract **5 Layers + 4 Engines** → `docs/concepts.md`
- [ ] Extract **CLI Reference** → `docs/commands.md` (expand with more examples)
- [ ] Extract **Recipes** → `docs/recipes.md`
- [ ] Extract **Configuration** → `docs/configuration.md`
- [ ] Extract **Plugin API** → `docs/plugin-api.md`
- [ ] Extract **Developer Guide** → `docs/contributing.md`

### Phase 3: New Content
- [ ] Write `docs/getting-started.md` from scratch (onboarding walkthrough)
- [ ] Write `docs/workflows.md` with decision trees and patterns
- [ ] Write `docs/troubleshooting.md` with exit code decoder
- [ ] Write `docs/glossary.md`

### Phase 4: README Surgery
- [ ] Reduce `README.md` to landing page (see §6)
- [ ] Add docs navigation links
- [ ] Move deep technical content to appropriate `docs/` files

### Phase 5: Polish
- [ ] Add permalinks to all H2/H3 headers
- [ ] Add "See it in action" blocks to getting-started and workflows
- [ ] Add verification dimension examples to commands.md
- [ ] Add workflow pattern tables to workflows.md
- [ ] Run `bp verify` on docs themselves (dogfooding)

---

## 8. Visual & Tone Recommendations

### Adopt from OpenSpec
1. **Permalink headers** for every section
2. **Philosophy blocks** instead of bullet lists
3. **Two-mode framing** (quick vs expanded) for all workflows
4. **Artifact flow diagrams** showing data transformation
5. **Verification dimension reports** (Structural → Semantic → Logical → Drift)
6. **Command quick reference tables** at top of commands.md
7. **Glossary** with cross-references

### Preserve from Current bp
1. **Emoji headers** (🎯, 🏗️, 💻) — adds visual scanning
2. **Mermaid diagrams** — keep architecture and flow charts
3. **JSON/YAML code blocks** — concrete configuration examples
4. **Exit code table** — excellent for CI integration
5. **Plugin API example** — concrete TypeScript snippet

### Tone Adjustments
- Shift from **reference manual** tone to **guide** tone
- Add "When to use this" and "Best for" callouts
- Use second person ("You run...", "Your repo...")
- Add "Tips" callout boxes (like OpenSpec's `> **Tip:**`)

---

## 9. Example: Before vs After

### Before (Current README — CLI Section)
```markdown
### `bp init [tool]`
Scaffolds a blueprint for the current repository.
- Arguments: `tool`: target agent backend
- Options: `--tool`, `--template`, `--force`, `--dry-run`, `--no-verify`
- Example: `bp init claude --dry-run`
```

### After (docs/commands.md — CLI Section)
```markdown
## `bp init`
Permalink: bp init

Scaffolds a blueprint for the current repository.

**Best for:** First-time setup, new repos, switching backends

**Syntax:**
```bash
bp init [tool] [options]
```

**Arguments:**
| Argument | Required | Description |
|---|---|---|
| `tool` | No | Target agent backend (`claude`, `cursor`, `opendev`, `generic`) |

**Options:**
| Option | Description | When to Use |
|---|---|---|
| `--tool <backend>` | Override positional tool argument | Scripting, CI pipelines |
| `--template <name>` | Force specific template pack | Non-standard project layouts |
| `--force` | Overwrite existing files | Re-scaffolding after major changes |
| `--dry-run` | Preview changes without writing | Review before applying |
| `--no-verify` | Skip post-init validation | Custom validation workflows |

**Example — First Time Setup:**
```bash
bp init claude
```

**Example — Preview Changes:**
```bash
bp init claude --dry-run
```

**Example — Force Re-Scaffold:**
```bash
bp init claude --force
```

**Tip:** After init, always run `bp verify` to catch any template mismatches with your repo topology.
```

---

## 10. Success Metrics

After restructuring, the documentation should enable:

1. **5-minute onboarding**: New user can install, init, and verify without reading past `getting-started.md`
2. **Self-service troubleshooting**: User can diagnose exit codes without opening an issue
3. **Workflow selection**: User can identify their scenario in `workflows.md` and follow the pattern
4. **Plugin development**: User can write a custom validator from `plugin-api.md` alone
5. **CI integration**: DevOps can copy-paste from `recipes.md` into GitHub Actions

---

*Plan generated by analyzing OpenSpec's documentation architecture and applying its patterns to Open Blueprint's domain.*
