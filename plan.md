# Open Blueprint — Implementation Plan
**Claude Code Execution Document**  
**Version:** 1.0.0  
**Generated:** 2026-05-28  
**Based on:** `ANALYSIS_REPORT.md` + Master Prompt Analysis

---

## Workflow Rule
> **STOP AND ASK THE USER BEFORE STARTING EACH PHASE.**  
> Do not write implementation code until the user explicitly says "start Phase X".  
> After completing each phase, present a summary and wait for user approval.

---

## Phase 0: Setup & Validation (ASK FIRST)
**Goal:** Ensure Claude Code has everything needed before writing code.

### Checklist
- [ ] Confirm `ANALYSIS_REPORT.md` is approved by user
- [ ] Verify Node.js 20+ and pnpm are available (`node -v`, `pnpm -v`)
- [ ] Confirm project root directory (e.g., `~/open-blueprint/`)
- [ ] Check if missing build plan docs (`@bp_initial__build_plan.md`, `@bp_complete_build_plan.md`) should be inferred or provided

### Deliverables
- [ ] `plan.md` (this file) — at project root
- [ ] `prompt.md` — execution prompt at project root
- [ ] `ANALYSIS_REPORT.md` — at project root

### Gate
**ASK USER:** "Analysis complete. Approve inferred scope or provide missing build plan documents?"

---

## Phase 1: Foundation (Days 1-3)
**Goal:** Monorepo scaffolding + shared types + configuration engine core.

### 1.1 Monorepo Setup
```
open-blueprint/
├── package.json          # pnpm workspaces + turbo
├── pnpm-workspace.yaml
├── turbo.json
├── .github/workflows/    # CI: test, lint, security-scan (stubs)
├── docs/ARCHITECTURE.md  # C4 diagrams (Mermaid stubs)
├── docs/ADRs/            # 001-008 from ANALYSIS_REPORT.md
└── packages/
    └── shared/           # Core types, errors, utilities
```

**Commands to run:**
```bash
cd ~/open-blueprint
pnpm init
pnpm add -D turbo @changesets/cli husky lint-staged
# Configure workspaces, turbo pipeline, changesets
```

### 1.2 `packages/shared`
- **Language:** TypeScript (strict)
- **Contents:**
  - Core types (`Blueprint`, `Agent`, `Resource`, `ExecutionState`)
  - Error hierarchy (`BlueprintError`, `ValidationError`, `ResolutionError`)
  - Utility functions (deep merge, path utils, type guards)
  - Protobuf definitions (if needed for plugin system)
- **Tests:** Jest, 100% coverage on utilities

### 1.3 `packages/engine` — MVP Subset
- **Parser:** Multi-format (YAML 1.2, JSON, TOML v1.0) using `yaml`, `json5`, `smol-toml`
  - Requirement: Precise error locations (line:column)
  - Streaming support for large files (>10MB)
- **Validator:** JSON Schema Draft 2020-12 via `ajv` + custom rule engine
  - Cross-reference integrity (basic)
- **Resolver:** Variable interpolation
  - `${env.VAR}` — environment variables
  - `${blueprint.outputs.x}` — blueprint references
  - (Deferred to Phase 3: `${secrets.vault.path}`)
- **Merger:** Hierarchical override (default → env → local → CLI)
  - Conflict detection with explicit error messages
- **Compiler:** Stub interface — Docker Compose target only

### 1.4 Testing
- Unit tests: Jest with `strict: true`
- Target: >90% coverage, 100% on critical paths

### Deliverables
- [ ] Runnable monorepo (`pnpm install` works)
- [ ] `packages/shared` with tests passing
- [ ] `packages/engine` parser + validator + resolver + merger with tests passing
- [ ] `docs/ADRs/` populated

### Gate
**ASK USER:** "Phase 1 complete. Engine core is ready. Proceed to Phase 2 (Registry + Orchestrator + CLI)?"

---

## Phase 2: Core Runtime (Days 4-6)
**Goal:** Registry, orchestrator, and CLI — the executable backbone.

### 2.1 `packages/registry`
- **Backend:** Local filesystem first (MVP)
- **Features:**
  - Save/load blueprints with SemVer 2.0
  - SHA-256 content addressing
  - Dependency resolution (A depends on B@^1.2.3)
  - Basic namespace isolation (`user/blueprint`)
- **Storage format:** JSON files in `~/.open-blueprint/registry/`

### 2.2 `packages/orchestrator`
- **DAG Builder:** Topological sort from blueprint dependency graphs
  - Detect circular dependencies (Tarjan's SCC)
- **Execution Engine:**
  - Sequential execution for MVP (parallel deferred to Phase 3)
  - State machine: PENDING → RUNNING → SUCCESS | FAILED | CANCELLED
  - Basic retry: 3 attempts, fixed delay
- **Event Bus:** In-memory for MVP (Redis deferred to Phase 5)

### 2.3 `packages/cli`
- **Framework:** `ink` (React for CLI) or `commander` + `ora` + `chalk`
  - *Decision:* Start with `commander` + `ora` + `chalk` for speed; migrate to `ink` in Phase 5 if time permits.
- **Commands:**
  - `open-blueprint init` — Interactive scaffolding with `inquirer`
  - `open-blueprint validate [path]` — Colored, actionable errors
  - `open-blueprint plan [path]` — Dry-run diff
  - `open-blueprint apply [path]` — Execute via orchestrator
- **Features:** Progress bars, spinners, bash/zsh completion stubs

### 2.4 Integration Tests
- CLI → Engine → Registry → Orchestrator end-to-end
- Testcontainers not needed yet (no external DB)

### Deliverables
- [ ] `registry` with local backend, SemVer, SHA-256
- [ ] `orchestrator` with DAG builder + sequential executor + state machine
- [ ] `cli` with init, validate, plan, apply
- [ ] Integration tests passing

### Gate
**ASK USER:** "Phase 2 complete. Core runtime works end-to-end. Proceed to Phase 3 (API + Dashboard)?"

---

## Phase 3: API & Dashboard (Days 7-9)
**Goal:** REST/GraphQL API and React dashboard.

### 3.1 `packages/api`
- **Stack:** Fastify (faster than Express, built-in JSON schema) or NestJS (more structured)
  - *Decision:* **Fastify** — aligns with performance requirements (<5s container start).
- **REST:** OpenAPI 3.1 spec auto-generated via `fastify-swagger`
  - Resources: `/blueprints`, `/executions`, `/registry`, `/audit`
- **GraphQL:** Apollo Server or Mercurius (Fastify-native)
  - Query complexity limits
  - Persisted queries stub
- **Auth:** JWT-based auth stub (OAuth 2.0 deferred to Phase 5)
- **Rate Limiting:** In-memory token bucket (Redis-backed deferred)
- **Middleware:** Request ID, structured logging (`pino`), panic recovery

### 3.2 `packages/dashboard`
- **Stack:** React 18 + TypeScript + Vite + Tailwind CSS + Radix UI
- **State:** Zustand (lighter than Redux for this scope)
- **Pages:**
  - Blueprint list (table view)
  - Blueprint editor (YAML/JSON text editor with Monaco)
  - Execution monitor (real-time log stream via WebSocket)
  - (Deferred to Phase 4: Visual node graph, diff viewer, approval workflows)
- **Design:** Dark mode default, WCAG 2.1 AA targets

### 3.3 End-to-End Tests
- Playwright for dashboard → API → backend flow

### Deliverables
- [ ] `api` running with REST + GraphQL + OpenAPI spec
- [ ] `dashboard` with blueprint list, editor, execution monitor
- [ ] E2E tests passing

### Gate
**ASK USER:** "Phase 3 complete. API and Dashboard are live. Proceed to Phase 4 (SDKs + Plugins)?"

---

## Phase 4: SDKs & Plugins (Days 10-12)
**Goal:** Client libraries and extension framework.

### 4.1 `packages/sdk-typescript`
- Isomorphic (Node + Browser)
- Tree-shakeable ESM build
- Generated from OpenAPI spec via `openapi-typescript`
- Async-first with `fetch`

### 4.2 `packages/sdk-python`
- Package name: `open-blueprint`
- Async-first (`asyncio`)
- Type hints throughout (`mypy --strict`)
- Generated from OpenAPI spec via `openapi-generator` or hand-written

### 4.3 `packages/plugin-system`
- **Extension points:** Custom validators, custom executors
- **Contract:** WASM-based for MVP (single sandbox model)
  - Use `wasmtime` (Node) and `componentize-py` for Python plugins
- **Lifecycle:** Load → Validate → Execute → Unload
- **Example plugin:** A custom validator that checks AWS resource naming conventions

### Deliverables
- [ ] `sdk-typescript` published locally (or stubbed for npm)
- [ ] `sdk-python` package buildable (`pip install -e .`)
- [ ] `plugin-system` with WASM loader + example plugin
- [ ] SDK integration tests

### Gate
**ASK USER:** "Phase 4 complete. SDKs and plugin system ready. Proceed to Phase 5 (Hardening + Examples + DevOps)?"

---

## Phase 5: Hardening & DevOps (Days 13-15)
**Goal:** Production readiness, examples, deployments, docs.

### 5.1 Remaining Backends
- Registry: S3-compatible (`@aws-sdk/client-s3`), Git (`isomorphic-git`), PostgreSQL (`pg` or `kysely`)
- Secrets: HashiCorp Vault (`node-vault`), AWS Secrets Manager, SOPS (`sops` CLI wrapper)

### 5.2 Advanced Orchestrator
- Parallel execution with worker pools
- Exponential backoff + jitter + circuit breaker (`opossum`)
- Resource governance (CPU/memory limits via Docker/cgroups)
- Redis-backed event bus

### 5.3 Examples (All 10)
```
examples/
├── 01-hello-agent/
├── 02-multi-agent-chat/
├── 03-rag-pipeline/
├── 04-data-etl/
├── 05-customer-support/
├── 06-code-review/
├── 07-research-assistant/
├── 08-devops-automation/
├── 09-compliance-audit/
└── 10-plugin-development/
```
Each must be runnable with `open-blueprint apply` without manual configuration.

### 5.4 Deployments
- `deployments/docker/` — Dockerfile + docker-compose.yml
- `deployments/kubernetes/` — Helm chart + raw manifests
- `deployments/terraform/` — AWS/GCP/Azure modules (stubs)

### 5.5 CI/CD
- `.github/workflows/ci.yml` — test, lint, security-scan
- `.github/workflows/release.yml` — changesets + npm publish
- `Makefile` — standard targets: install, test, lint, build, docker-build

### 5.6 Security & Performance
- `npm audit`, `pip audit` — zero critical/high vulnerabilities
- Benchmark: validation <100ms for standard blueprints
- Dashboard bundle <500KB gzipped

### 5.7 Documentation
- `README.md` — Hero section, quickstart, architecture diagram
- `docs/API.md` — Auto-generated from OpenAPI
- `docs/TROUBLESHOOTING.md`
- `docs/SECURITY.md`

### Deliverables
- [ ] All 10 examples runnable
- [ ] Docker + K8s + Helm deployment assets
- [ ] CI/CD pipelines active
- [ ] Security audit clean
- [ ] Performance benchmarks met
- [ ] Documentation complete

### Gate
**ASK USER:** "Phase 5 complete. Project is production-ready. Proceed to GitHub commit and push?"

---

## Phase 6: GitHub Commit & Push (ASK FIRST)
**Goal:** Publish the completed project.

### Steps
1. Initialize git repo if not already done
2. Write comprehensive `README.md`
3. Add `LICENSE` (Apache 2.0)
4. Stage all files
5. Commit with conventional commit message: `feat: initial implementation of Open Blueprint`
6. Add remote origin (user provides URL)
7. Push to GitHub

### Required from User
- GitHub repository URL (e.g., `git@github.com:user/open-blueprint.git`)
- Git credentials or token

### Gate
**ASK USER:** "Ready to push to GitHub. Please provide the repository URL and confirm."

---

## Success Criteria Checklist

| Criterion | Phase Completed | Verification |
|-----------|----------------|--------------|
| Feature parity with master prompt | 5 | All sections 4–6 implemented |
| Zero critical vulnerabilities | 5 | `npm audit` + `pip audit` clean |
| Tests passing >90% coverage | 1–5 | `make test` exits 0 |
| E2E tests passing | 3 | Playwright all scenarios |
| Documentation complete | 5 | New engineer onboarded in <60 min |
| 10 examples runnable | 5 | `open-blueprint apply` on each |
| Performance met | 5 | Benchmark scripts pass |
| Git integration clean | 1 | `git diff` readable on YAML |

---

## Notes for Claude Code

1. **Context Management:** This is a large project. If context window fills, prioritize:
   - Current phase files
   - `packages/shared` types
   - `ANALYSIS_REPORT.md` and this `plan.md`

2. **Testing Discipline:** Write tests alongside code, not after. Every package must have a `test/` directory.

3. **No Proprietary Dependencies:** Only permissive open source (Apache 2.0 / MIT). No 0.x experimental libraries in production paths.

4. **Incremental Commits:** Commit at the end of each sub-task (e.g., after parser is done, after validator is done).

5. **User Communication:** Keep summaries concise. Show file trees and test output, not full code dumps, when reporting progress.

---
*End of Implementation Plan*
