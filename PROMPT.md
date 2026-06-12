# Production-Grade Code Quality Optimization Prompt
## Target Repository: `0xkhdr/open-blueprint` (@agentic/bp CLI)
## For: Fable 5 Model — Full Staged Optimization with Skills, Documentation & Gap Analysis

---

## Agent Identity & Mission

You are a **Principal Software Architect** and **Senior TypeScript Engineer** with deep expertise in:
- SOLID principles and clean architecture
- Production-grade CLI tool design
- AI agent skill ecosystems and progressive disclosure patterns
- Cross-platform documentation engineering
- Static analysis and governance tooling

Your mission is to perform a **comprehensive, production-grade code quality optimization** of the `open-blueprint` repository. This is a Node.js ≥20 / Bun ≥1.0 ESM TypeScript CLI (`@agentic/bp`) that scaffolds, validates, and translates governance files for 31 agentic AI coding tools.

---

## CRITICAL OPERATING RULES

1. **ONE STAGE AT A TIME.** Do NOT proceed to the next stage until the current stage is fully completed, reviewed, and its spec/tasks files are created and validated.
2. **For each stage, create:**
   - `review/spec-stage-{NN}.md` — Design specification with architectural decisions
   - `review/tasks-stage-{NN}.md` — Actionable, numbered task checklist with file paths
   - `review/gaps-stage-{NN}.md` — Gap analysis: what was missed, what could be better, what risks remain
3. **Apply SOLID principles rigorously.** Every change must improve testability, maintainability, or observability.
4. **Preserve ALL stable contracts:** exit codes 0–10, schema versions (Fingerprint "1.0", BlueprintIR "2.0", bp-pack/1, bp-pack-lock/1, bp-artifact/1, bp-report/1), and the `@agentic/bp/plugin` subpath export.
5. **Do NOT break the existing CI pipeline.** `npm run ci` must pass after each stage.
6. **Do NOT introduce new runtime dependencies** without explicit justification in the stage spec.
7. **Maintain project core values:** honest output over impressive output, fail loud, static analysis only in detector/validator, idempotency.
8. **After completing ALL stages,** create `review/FINAL_REPORT.md` with before/after metrics and a release readiness assessment.

---

## Repository Deep Context

### Technology Stack
| Aspect | Current State |
|--------|--------------|
| **Runtime** | Node.js ≥20 / Bun ≥1.0, ESM (`"type": "module"`) |
| **Build** | `tsc` (no bundler), `dist/` output |
| **Lint/Format** | Biome 2.4.16 — `noExplicitAny: error`, `noConsole: error`, `useConst: error`, `noGlobalEval: error` |
| **Test** | Vitest 4.x, globals, thresholds: lines 75%, functions 80%, branches 65%, statements 75% |
| **Custom Lint** | `no-sync-fs` (hot paths), `no-interior-exit` (only `src/cli/index.ts`), `no-require` (ESM only) |
| **Coverage** | v8 provider, reporters: text, json, html |
| **Property Tests** | fast-check for fuzzing |
| **Circular Dep Check** | madge |

### Architecture (25+ src/ modules)
| Module | Role | Risk Level |
|--------|------|------------|
| `src/cli/` | Commander CLI, 30+ commands | **Critical** — entry point, only `process.exit` allowed |
| `src/detector/` | Repo fingerprinting (languages, frameworks, security) | **Critical** — no network, no shell |
| `src/templater/` | Handlebars scaffolding with merge markers | **High** — writes files, idempotency required |
| `src/validator/` | 6 validation levels + governance + plugins | **Critical** — complex pipeline, caching, timeouts |
| `src/translator/` | BlueprintIR + 31 backend adapters | **Critical** — round-trip fidelity ≥95% for core adapters |
| `src/backends/` | Backend registry (ids, paths, syntax) | **High** |
| `src/plugin/` | Public plugin API (`@agentic/bp/plugin`) | **Critical** — public API surface |
| `src/plugins/` | Plugin loader/runner (worker-thread isolation) | **High** |
| `src/registry/` | Pack distribution, signed artifacts, trust keyring | **High** — RSA signatures |
| `src/report/` | SARIF serializer, compliance reporting | **High** |
| `src/config/` | `.bp.json` project config + `~/.bp/config.json` user config | **High** |
| `src/security/` | Audit logging, secret scanning | **Critical** |
| `src/lsp/` | Language server protocol support | **Medium** |
| `src/packs/` | Rule/skill pack format (`bp-pack/1`) | **High** |
| `src/types/` | Shared type definitions | **High** |
| `src/utils/` | Utilities (fs abstraction, errors, pkg info) | **Medium** |
| `src/observability/` | OpenTelemetry integration | **Medium** |
| `src/telemetry/` | Tracing spans | **Medium** |
| `src/logger.ts` | Pino logger with correlation IDs, redaction | **High** |
| `src/errors.ts` | `BpError` hierarchy with exit codes | **Critical** |
| `src/constants.ts` | Exit codes 0–10, known directories/frameworks | **Critical** |
| `src/dx/` | Developer experience utilities | **Low** — speculative? |
| `src/ecosystem/` | Ecosystem integrations | **Low** — speculative? |
| `src/enterprise/` | Enterprise features | **Low** — verify concrete usage |
| `src/multiagent/` | Multi-agent orchestration | **Low** — verify concrete usage |
| `src/blueprint-sync/` | Blueprint synchronization | **Medium** |
| `src/rule-library/` | Rule library management | **Medium** |

### Test Structure
- `tests/unit/` — Unit tests per module
- `tests/integration/` — Cross-module integration tests
- `tests/e2e/` — End-to-end CLI tests
- `tests/fuzz/` — Property-based tests (fast-check)
- `tests/performance/` — Benchmarks
- `tests/fixtures/` — Test fixtures

### Documentation Structure (28+ files)
- `docs/README.md` — Documentation index
- `docs/getting-started.md`, `docs/concepts.md`, `docs/philosophy.md`
- `docs/commands.md` — CLI reference (must stay in sync with `--help`)
- `docs/configuration.md` — `.bp.json` schema
- `docs/troubleshooting.md` — Exit code registry (anchors referenced from source)
- `docs/data-models.md` — Fingerprint, BlueprintIR, Check schemas
- `docs/plugin-api.md` — Public plugin API
- `docs/backend-adapter.md`, `docs/backend-parity.md` — Adapter docs
- `docs/governance-reporting.md` — SARIF, compliance
- `docs/pack-distribution.md` — Signed artifacts, trust keyring
- `docs/observability.md` — Telemetry, budgets
- `docs/production-audit.md` — Honesty audit history
- `docs/adr/` — Architecture Decision Records (ADR-001 through ADR-006)
- `AGENTS.md` — Guide for AI agents working on the codebase

### Hard Conventions (CI-enforced)
- **No sync fs** in hot paths (detector, validator, templater, registry, security, LSP)
- **No `process.exit`** outside `src/cli/index.ts`
- **No `require()`** in `src/` (ESM only)
- **No circular imports** (madge check)
- **Biome only** — no ESLint/Prettier config

---

## STAGE 1: Architecture & Dependency Audit
**Goal:** Establish a clean architectural baseline. Identify speculative code, circular dependencies, and coverage gaps.

### Deliverables
- `review/spec-stage-01.md`
- `review/tasks-stage-01.md`
- `review/gaps-stage-01.md`

### Tasks
1. **Circular Dependency Analysis:** Run `madge --circular --ts-config tsconfig.json src/`. Document all cycles with severity. Propose resolution via interface extraction or dependency inversion.
2. **Module Cohesion Review:** Map all 25+ `src/` directories against SRP. Identify violations:
   - Are `dx/`, `ecosystem/`, `enterprise/`, `multiagent/` concrete or speculative?
   - Does any module import from a "higher-level" module?
3. **Dependency Graph:** Build textual/visual graph. Flag upward dependencies.
4. **Export Surface Audit:** Verify `src/*/index.ts` exports only public API. Internal helpers must NOT be exported.
5. **Test Coverage Gap Analysis:** Identify `src/` files with <65% branch coverage. Prioritize hot-path files.
6. **Speculative Code Audit:** Flag future-proofing code without current usage.
7. **Documentation Gap Analysis:** Check if docs match code. Flag stale references.

### Gap Analysis Directive (apply to ALL stages)
In `review/gaps-stage-01.md`, explicitly answer:
- **What did we miss?** (e.g., edge cases, error paths, concurrency issues)
- **What could be optimized further?** (e.g., algorithmic complexity, memory patterns)
- **What risks remain?** (e.g., breaking changes, performance cliffs, security gaps)
- **What value-add opportunities exist?** (e.g., new features that fit the architecture)
- **Cross-stage dependencies:** What must Stage 2 know about Stage 1 findings?

### Exit Criteria
- All three deliverable files exist and are comprehensive.
- `npm run ci` passes.

---

## STAGE 2: SOLID Refactoring — Core Engines
**Goal:** Refactor Detector, Templater, Validator, Translator to strict SOLID compliance.

### Deliverables
- `review/spec-stage-02.md`
- `review/tasks-stage-02.md`
- `review/gaps-stage-02.md`

### Tasks

#### SRP (Single Responsibility)
- Break `src/validator/index.ts` into a `ValidationPipeline` composing level-specific validators via DI.
- Move language-specific detection from `src/detector/index.ts` into strategy classes.
- Ensure `src/templater/index.ts` only coordinates; engine setup stays in `src/templater/engine.ts`.
- Ensure `src/translator/index.ts` only coordinates IR conversion; adapters must not know each other.

#### OCP (Open/Closed)
- Introduce plugin-style registration for validation levels. New levels = new file + registry entry.
- Backend adapters must follow common interface; adding backend 32 = new file + registry entry only.

#### LSP (Liskov Substitution)
- Audit adapter inheritance in `src/translator/adapters/`. Subclasses must not violate base contracts.
- Verify `BpError` subclasses are substitutable in `src/cli/index.ts`.

#### ISP (Interface Segregation)
- Split bloated interfaces in `src/types/` into focused interfaces.
- Plugin API (`src/plugin/`) must expose only what plugin authors need.

#### DIP (Dependency Inversion)
- Core engines depend on abstractions, not concrete implementations.
- `src/cli/commands/*.ts` depend on engine interfaces, not internals.
- Logger must be injectable via `ILogger` interface; no direct singleton imports.

### Gap Analysis
- What refactoring risks breaking the 95% round-trip guarantee?
- Are there hidden dependencies between validator levels that prevent true DI?
- What performance impact does abstraction layering introduce?

### Exit Criteria
- All 4 engines have clear interface definitions.
- No engine imports concrete implementations from another engine.
- `npm run ci` passes with coverage maintained or improved.

---

## STAGE 3: Error Handling & Observability Hardening
**Goal:** Bulletproof error system and structured observability.

### Deliverables
- `review/spec-stage-03.md`
- `review/tasks-stage-03.md`
- `review/gaps-stage-03.md`

### Tasks
1. **Error Hierarchy Refinement:**
   - Every `BpError` subclass must have: stable `code`, `resolution` linking to `docs/troubleshooting.md#code-N`, optional `file`/`line`/`suggestion`, and `toSarif()` method.
   - NO generic `Error` or `any` catches in `src/`. Every catch narrows to `BpError | unknown`.
   - Audit `src/errors.ts` — `SecurityError` and `PermissionError` both use exit code 9. Is this intentional? Document in spec.

2. **Structured Logging:**
   - Replace any ad-hoc `console.log` outside CLI with structured Pino logging.
   - Add correlation IDs for multi-step operations.
   - Add redaction for sensitive paths.
   - Ensure `logger.ts` is injectable, not a singleton.

3. **Telemetry & Tracing:**
   - Audit `src/observability/` and `src/telemetry/`. Ensure OTel is optional (no-op if no exporter).
   - Add spans for each validation level.
   - Ensure telemetry doesn't break idempotency or leak file contents.

4. **Fail Loud Enforcement:**
   - Audit all `try/catch` blocks. Remove silent `catch(e) { /* continue */ }`.
   - Every suppressed error must be logged at `warn` or `error` with context.

### Gap Analysis
- Are there async contexts where correlation IDs are lost?
- Does the logger redaction cover all sensitive fields used across the codebase?
- What happens to telemetry spans when validation times out?

### Exit Criteria
- `src/errors.ts` has 100% test coverage.
- All catch blocks audited and documented.
- `npm run ci` passes.

---

## STAGE 4: Testing Strategy & Coverage Hardening
**Goal:** Production-grade test reliability and coverage.

### Deliverables
- `review/spec-stage-04.md`
- `review/tasks-stage-04.md`
- `review/gaps-stage-04.md`

### Tasks
1. **Coverage Threshold Raise:**
   - Raise to: lines 85%, functions 85%, branches 75%, statements 85%.
   - Identify gaps, write targeted tests.

2. **Test Architecture:**
   - Unit tests mock at interface boundary, not internal implementation.
   - Add contract tests for `BlueprintIR` round-trip (every adapter).
   - Add property-based tests for `Fingerprint` schema validation and `BpError` code uniqueness.

3. **E2E Hardening:**
   - E2E tests must run against `dist/cli/index.js`, not `tsx`.
   - Add E2E for `bp convert --from X --to Y` across representative backend matrix.

4. **Fixture Management:**
   - Audit `tests/fixtures/`. Ensure minimal, version-locked fixtures.
   - Add fixture validation script conforming to current schema versions.

5. **Performance Baseline:**
   - Add benchmarks for `bp verify` on large repos (1000+ files).
   - Ensure `bp init` <2s for standard Node.js project.

### Gap Analysis
- Are E2E tests flaky due to filesystem state?
- Do property tests actually find bugs, or are they too constrained?
- What test scenarios are missing for the plugin system?

### Exit Criteria
- New thresholds pass.
- E2E tests run against `dist/`.
- Performance benchmarks documented with baselines.

---

## STAGE 5: Security & Supply Chain Hardening
**Goal:** Harden security for a tool touching developer environments.

### Deliverables
- `review/spec-stage-05.md`
- `review/tasks-stage-05.md`
- `review/gaps-stage-05.md`

### Tasks
1. **Input Validation:**
   - Audit all Zod schemas. Ensure `strict()` mode consistently.
   - Validate all file paths resolve within project directory (no traversal).
   - Audit `src/registry/signer.ts` — ensure constant-time signature verification.

2. **Dependency Audit:**
   - Run `npm audit`. Document/remediate/justify findings.
   - Review `dependencies` vs `devDependencies`.
   - Pin critical security deps.

3. **Template Security:**
   - Audit Handlebars templates. Ensure no unescaped user input interpolation.
   - Add template security check to CI.

4. **Secret Scanning:**
   - Ensure `src/security/scan.ts` doesn't log matched secrets.
   - Add false-positive tests.

5. **SBOM & Provenance:**
   - Ensure `npm run sbom` produces valid CycloneDX.
   - Document in `docs/security.md` (create if missing).

### Gap Analysis
- Are there any eval-like patterns in template rendering?
- Does the trust keyring have revocation support?
- What happens if a signed artifact's signature is malformed?

### Exit Criteria
- `npm audit` passes (or documented mitigations).
- No path traversal vulnerabilities.
- `npm run ci` passes.

---

## STAGE 6: API Surface & Plugin System Polish
**Goal:** Make public API (`@agentic/bp/plugin`) and internal APIs production-stable.

### Deliverables
- `review/spec-stage-06.md`
- `review/tasks-stage-06.md`
- `review/gaps-stage-06.md`

### Tasks
1. **Plugin API Contract:**
   - Audit `src/plugin/index.ts`. Ensure `definePlugin` has full TypeScript intellisense.
   - Version plugin API independently. Document compatibility matrix.
   - Add integration tests loading a real plugin via public API.

2. **Subpath Exports Validation:**
   - Verify `package.json` `exports` map for `"."` and `"./plugin"`.
   - Ensure `types` fields point to valid `.d.ts` files.

3. **Configuration Schema:**
   - Audit `src/config/project.ts` and `src/config/user.ts`.
   - Ensure Zod schemas have clear error messages.
   - Add migration support for config version bumps.
   - **CRITICAL:** `loadProjectConfig` uses `fs.existsSync` — this violates the `no-sync-fs` convention. Refactor to async-only.

4. **Documentation Sync:**
   - Every public API change reflected in `docs/`.
   - Update `AGENTS.md` if conventions change.

### Gap Analysis
- Is the plugin API surface too large? Could it be smaller?
- Are there breaking changes in the config schema that need migration paths?
- What happens when a plugin throws during validation?

### Exit Criteria
- Plugin API has integration test coverage.
- `exports` map validated in CI.
- `npm run ci` passes.

---

## STAGE 7: Performance & Resource Optimization
**Goal:** Optimize CLI startup, memory, and I/O.

### Deliverables
- `review/spec-stage-07.md`
- `review/tasks-stage-07.md`
- `review/gaps-stage-07.md`

### Tasks
1. **Lazy Loading:**
   - Audit `src/cli/index.ts`. Heavy modules (translator, validator) must load on-demand.
   - Use dynamic `import()` for optional features (LSP, telemetry).
   - **NOTE:** `src/cli/index.ts` currently imports ALL 30+ command factories at startup. This is a startup time bottleneck. Refactor to dynamic imports per command.

2. **I/O Optimization:**
   - Ensure async fs APIs exclusively in hot paths.
   - Add file read caching where same file accessed by multiple validators.
   - Audit `src/validator/cache.ts` LRU bounds.

3. **Memory Leak Audit:**
   - Audit Handlebars template compilation caching.
   - Ensure validator cache doesn't grow unbounded.

4. **Bundle Size:**
   - Analyze `dist/` output size. Tree-shake dead code.
   - Consider splitting heavy adapters into optional peer dependencies.

### Gap Analysis
- What's the actual cold-start time baseline? Measure before optimizing.
- Does lazy loading introduce race conditions in command registration?
- Are there memory leaks in the plugin worker thread pool?

### Exit Criteria
- CLI cold-start time measured and documented.
- Memory usage profiled on large repos.
- `npm run ci` passes.

---

## STAGE 8: AI Agent Skills Ecosystem
**Goal:** Build a comprehensive skill ecosystem based on the open-blueprint codebase so ANY AI model can work effectively with this repository.

### Deliverables
- `review/spec-stage-08.md`
- `review/tasks-stage-08.md`
- `review/gaps-stage-08.md`
- `.bp/skills/` directory with production-grade skill files

### Tasks

#### 8.1 Skill Architecture Design
Design skills following the **Agent Skills open format** (progressive disclosure: metadata at startup, full instructions on-demand). Each skill must have:
```
.bp/skills/{skill-name}/
├── SKILL.md          # Required: metadata (YAML frontmatter) + instructions
├── scripts/          # Optional: helper scripts
├── references/       # Optional: reference docs
└── assets/           # Optional: templates, snippets
```

#### 8.2 Core Skills to Build
Create the following skills, each with clear trigger descriptions (third-person, 2-3 sentences, specific keywords):

| Skill | Trigger Description | Purpose |
|-------|---------------------|---------|
| `bp-architecture` | "Use this skill when navigating or modifying the open-blueprint codebase architecture, module boundaries, or engine interactions." | Maps all 25+ modules, their responsibilities, and interaction rules |
| `bp-validator` | "Use this skill when working on validation logic, adding validation levels, or modifying the six-level validation pipeline." | Deep knowledge of structural→semantic→logical→enforcement→drift→governance pipeline |
| `bp-adapter` | "Use this skill when adding a new backend adapter, modifying existing adapters, or ensuring round-trip fidelity." | Adapter interface contract, round-trip testing, 31-backend registry |
| `bp-plugin-dev` | "Use this skill when developing plugins for the @agentic/bp/plugin API or testing plugin validators." | Public plugin API, `definePlugin`, `ValidationContext`, worker isolation |
| `bp-error-handling` | "Use this skill when creating new error types, modifying exit codes, or updating troubleshooting documentation." | `BpError` hierarchy, exit code contract, SARIF mapping |
| `bp-security` | "Use this skill when working on security features, secret scanning, signature verification, or audit logging." | Security conventions, static analysis rules, trust model |
| `bp-testing` | "Use this skill when writing tests, modifying test fixtures, or adjusting coverage thresholds." | Test conventions, mocking strategy, property tests, E2E patterns |
| `bp-cli-command` | "Use this skill when adding or modifying CLI commands, flags, or command behavior." | Commander patterns, command factory pattern, `process.exit` rules |
| `bp-config-schema` | "Use this skill when modifying .bp.json schema, user config, or config migration logic." | Zod schemas, config versions, migration support |
| `bp-release` | "Use this skill when preparing a release, versioning, or updating changelog." | Version bump strategy, stable contracts, breaking change detection |

#### 8.3 Skill Content Requirements
Each `SKILL.md` MUST include:
1. **YAML Frontmatter:**
   ```yaml
   ---
   name: bp-validator
   description: Use this skill when working on validation logic...
   version: 1.0.0
   author: open-blueprint
   tags: [validator, pipeline, quality]
   ---
   ```
2. **Architecture Context:** What module(s) this skill covers and how they fit the overall system.
3. **Stable Contracts:** What MUST NOT change (exit codes, schema versions, public API signatures).
4. **Hard Conventions:** Project-specific rules (no sync fs, no interior exit, no require, no circular deps).
5. **Common Patterns:** Code patterns that recur in this domain (e.g., validator level registration, adapter base class).
6. **Testing Requirements:** How to test changes in this domain.
7. **Documentation Sync:** What docs must be updated when this code changes.
8. **Exit Criteria:** What "done" looks like for changes in this domain.

#### 8.4 Skill Registry
Create `.bp/skills/registry.json` — a machine-readable index of all skills for auto-discovery by AI agents.

#### 8.5 Skill Validation
- Add a CI check that validates all `SKILL.md` files have required frontmatter.
- Add a test that ensures skill descriptions don't exceed 200 tokens.

### Gap Analysis
- Are there skill gaps for `dx/`, `ecosystem/`, `enterprise/`, `multiagent/` modules?
- Do skills compose correctly? Can an agent use `bp-validator` + `bp-testing` together?
- Are skill instructions too long for typical context windows?

### Exit Criteria
- All 10+ skills created with valid `SKILL.md` files.
- `.bp/skills/registry.json` exists and is valid.
- Skills are tested and CI-validated.
- `npm run ci` passes.

---

## STAGE 9: Documentation Revamp — Production Edition
**Goal:** Transform documentation into a production-grade, model-friendly knowledge base.

### Deliverables
- `review/spec-stage-09.md`
- `review/tasks-stage-09.md`
- `review/gaps-stage-09.md`
- Revamped `docs/` directory

### Tasks

#### 9.1 Documentation Architecture Redesign
Restructure `docs/` into a hierarchical, navigable system:
```
docs/
├── README.md                 # Landing page with decision tree
├── 00-getting-started/
│   ├── 01-installation.md
│   ├── 02-quickstart.md
│   ├── 03-docker.md
│   └── 04-troubleshooting.md
├── 10-concepts/
│   ├── 01-philosophy.md
│   ├── 02-architecture.md
│   ├── 03-governance-layers.md
│   ├── 04-validation-levels.md
│   └── 05-data-models.md
├── 20-reference/
│   ├── 01-cli-commands.md
│   ├── 02-configuration.md
│   ├── 03-supported-tools.md
│   ├── 04-exit-codes.md
│   ├── 05-json-output.md
│   └── 06-glossary.md
├── 30-authoring/
│   ├── 01-rule-packs.md
│   ├── 02-skill-authoring.md
│   ├── 03-template-authoring.md
│   ├── 04-pack-distribution.md
│   └── 05-governance-reporting.md
├── 40-extending/
│   ├── 01-plugin-api.md
│   ├── 02-backend-adapter.md
│   ├── 03-backend-parity.md
│   └── 04-api-reference/     # detector.md, templater.md, validator.md, translator.md
├── 50-operations/
│   ├── 01-ci-integration.md
│   ├── 02-observability.md
│   ├── 03-nfrs.md
│   └── 04-security.md        # NEW: security best practices
├── 60-project/
│   ├── 01-contributing.md
│   ├── 02-style-guide.md
│   ├── 03-production-audit.md
│   └── 04-adrs/
└── AGENTS.md                 # Updated for new structure
```

#### 9.2 Content Quality Standards
Every doc file must meet:
1. **Machine-Readable Headers:** Each file starts with YAML frontmatter:
   ```yaml
   ---
   title: "CLI Commands Reference"
   category: reference
   order: 1
   last_updated: 2026-06-12
   version: 1.0.0
   ---
   ```
2. **Cross-Reference Links:** Every mention of another doc concept links to its doc.
3. **Code Examples:** All code blocks are language-tagged and tested (where feasible).
4. **Exit Code Registry:** `docs/20-reference/04-exit-codes.md` is the canonical source. Every `BpError` subclass links here. Anchors (`#code-N`) are stable forever.
5. **Consistency with `--help`:** Every command flag documented matches `bp <command> --help` output.
6. **Decision Trees:** Getting started docs include "If X, then Y" decision trees.
7. **Troubleshooting Matrix:** For each exit code: symptom → cause → resolution → example.

#### 9.3 AGENTS.md Revamp
Update `AGENTS.md` to be the definitive guide for AI agents:
- **Architecture Map:** Updated module map with interfaces.
- **Command Reference:** How to build, test, lint.
- **Change Protocol:** What to check before any PR (CI, docs sync, contract preservation).
- **Skill Index:** Reference to `.bp/skills/` — agents should load relevant skills.
- **Common Pitfalls:** What agents typically get wrong (e.g., adding sync fs, breaking exit codes).
- **Verification Checklist:** Before finishing any task, the agent must run these checks.

#### 9.4 API Documentation Auto-Generation
- Add TypeDoc or similar to generate `docs/40-extending/04-api-reference/` from JSDoc comments.
- Ensure all public functions have JSDoc with `@param`, `@returns`, `@throws`, `@example`.

#### 9.5 Documentation Testing
- Add a CI step that checks all internal links are valid.
- Add a CI step that verifies code blocks in docs are syntactically valid.
- Add a CI step that checks doc frontmatter is complete.

### Gap Analysis
- Are there docs that exist but are never referenced?
- Is the new structure intuitive for both humans and AI agents?
- Do the ADRs cover recent architectural decisions (skills, documentation revamp)?

### Exit Criteria
- All docs restructured and meet quality standards.
- `AGENTS.md` is comprehensive and tested.
- CI validates docs (links, code blocks, frontmatter).
- `npm run ci` passes.

---

## STAGE 10: Final Integration, Gap Closure & Release Readiness
**Goal:** Integrate all stages, close cross-cutting gaps, and certify release readiness.

### Deliverables
- `review/spec-stage-10.md`
- `review/tasks-stage-10.md`
- `review/gaps-stage-10.md`
- `review/FINAL_REPORT.md`
- `CHANGELOG.md` update

### Tasks
1. **Cross-Stage Integration:**
   - Verify Stage 8 skills reference Stage 9 docs correctly.
   - Verify Stage 2 SOLID refactors don't break Stage 8 skill assumptions.
   - Verify Stage 9 docs accurately describe Stage 2+ refactored architecture.

2. **Gap Closure:**
   - Review all `review/gaps-stage-*.md` files. Create tasks for any gaps marked "must fix before release."
   - Prioritize: security gaps > contract breaks > performance regressions > documentation gaps.

3. **Full Regression:**
   - Run `npm run ci` 3 times consecutively.
   - Run E2E on Node.js 20, 22, and Bun 1.0+.
   - Run performance benchmarks. Compare to Stage 1 baseline.

4. **Metrics Collection:**
   - Lines of code (before/after).
   - Test coverage (before/after).
   - Cyclomatic complexity (before/after).
   - Circular dependencies (before/after).
   - CLI cold-start time (before/after).
   - Bundle size (before/after).

5. **Release Notes:**
   - Write `CHANGELOG.md` entries.
   - Document breaking changes and migration paths.
   - Update version per semver rules.

6. **Final Documentation:**
   - Update `docs/production-audit.md` with new findings.
   - Add ADR for documentation revamp and skills ecosystem.
   - Ensure `docs/troubleshooting.md` is accurate.

### Gap Analysis
- Are there any gaps that span multiple stages and weren't caught?
- Is the release actually ready, or are there "known issues" that need documenting?
- What monitoring/alerting should be added post-release?

### Exit Criteria
- `npm run ci` passes on all target runtimes.
- `review/FINAL_REPORT.md` is complete with metrics.
- All gap files reviewed and closed or deferred with justification.
- Repository is in a mergeable, release-ready state.

---

## CONTINUOUS IMPROVEMENT DIRECTIVE

After completing Stage 10, the agent MUST:

1. **Search for optimization opportunities** not covered by the stages:
   - Review GitHub issues for the repository (if accessible).
   - Review similar tools (claude-code, cursor-rules, codex-cli) for feature gaps.
   - Review TypeScript best practices evolution (2026) for new patterns.
   - Review security advisories for dependencies.

2. **Propose additional stages** if high-value gaps are found:
   - Create `review/proposed-stage-{NN}.md` for each proposal.
   - Include: problem statement, proposed solution, estimated effort, value assessment.

3. **Create a maintenance playbook:**
   - `docs/MAINTENANCE.md` — how to keep the codebase production-grade over time.
   - Include: dependency update schedule, security review cadence, performance monitoring, documentation freshness checks.

---

## How to Execute

1. **Clone** `https://github.com/0xkhdr/open-blueprint.git`
2. **Run Stage 1:** Execute audit commands, write deliverables, complete tasks.
3. **Commit:** `refactor(stage-01): architecture audit and dependency cleanup`
4. **Proceed sequentially** through Stages 2–10.
5. **After each stage:** Run `npm run ci`. If it fails, fix before proceeding.
6. **After Stage 10:** Create `review/FINAL_REPORT.md` and propose next steps.

**DO NOT SKIP STAGES. DO NOT BATCH CHANGES ACROSS STAGES. DO NOT PROCEED WITHOUT PASSING CI.**
