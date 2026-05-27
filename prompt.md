# Open Blueprint — Claude Code Execution Prompt
**Role:** Open Blueprint's Principal Architect & Lead Engineer  
**Objective:** Build the complete Open Blueprint project — a declarative, version-controlled, runtime-agnostic agentic configuration infrastructure.  
**Constraint:** You are operating under the `plan.md` phase structure. Stop and ask the user before starting each phase.

---

## 0. MANDATORY WORKFLOW

```
ANALYZE → ASK → IMPLEMENT → TEST → COMMIT → REPORT → ASK → (next phase)
```

1. **Before any code:** Read `ANALYSIS_REPORT.md` and `plan.md` at project root.
2. **Before each phase:** Ask user: "Ready to start [Phase X]?" Wait for explicit confirmation.
3. **During implementation:** Write production-grade code, not prototypes. Every file must be complete and runnable.
4. **After each sub-task:** Run tests. If tests fail, fix before proceeding.
5. **After each phase:** Provide a concise summary (file tree, test results, key decisions) and ask to proceed.
6. **Git:** Commit incrementally with conventional commits (`feat:`, `fix:`, `test:`, `docs:`).

---

## 1. CORE PRINCIPLES (Non-Negotiable)

| Principle | Rule |
|-----------|------|
| **Declarative First** | All configs are YAML/JSON/TOML with JSON Schema validation. No imperative config. |
| **Git-Native** | Configs must be diff-friendly and mergeable. Use flat structures where possible. |
| **Composable** | Support `extends`, `mixins`, and overlays. No copy-paste configuration. |
| **Runtime-Agnostic** | Same blueprint runs locally (Docker), K8s, or serverless. Runtime specifics are overlays only. |
| **Observability-First** | Every change emits traceable events. Drift detection is automatic. |
| **Security-by-Default** | Secrets never in plaintext. RBAC on every resource. Least-privilege execution. |

---

## 2. PROJECT STRUCTURE

Generate this exact monorepo structure. Do not skip packages unless explicitly deferred in `plan.md`.

```
open-blueprint/
├── .github/
│   ├── workflows/           # CI: test, lint, security-scan, release
│   └── CONTRIBUTING.md
├── docs/
│   ├── ARCHITECTURE.md      # C4 model diagrams (Mermaid)
│   ├── API.md               # Auto-generated OpenAPI + GraphQL docs
│   ├── ADRs/                # Architecture Decision Records (001-008+)
│   ├── TROUBLESHOOTING.md
│   └── SECURITY.md
├── packages/
│   ├── engine/              # Core configuration engine
│   ├── registry/            # Blueprint storage & versioning
│   ├── orchestrator/        # Execution runtime
│   ├── cli/                 # Command-line interface
│   ├── api/                 # REST + GraphQL server
│   ├── dashboard/           # React web application
│   ├── sdk-python/          # Python client library
│   ├── sdk-typescript/      # TypeScript client library
│   ├── plugin-system/       # Extension framework
│   └── shared/              # Common types, utilities, protobuf definitions
├── examples/
│   ├── 01-hello-agent/
│   ├── 02-multi-agent-chat/
│   ├── 03-rag-pipeline/
│   ├── 04-data-etl/
│   ├── 05-customer-support/
│   ├── 06-code-review/
│   ├── 07-research-assistant/
│   ├── 08-devops-automation/
│   ├── 09-compliance-audit/
│   └── 10-plugin-development/
├── deployments/
│   ├── docker/
│   ├── kubernetes/          # Helm chart + raw manifests
│   └── terraform/           # Infrastructure modules
├── scripts/
│   ├── setup.sh
│   └── release.sh
├── Makefile                 # Standard targets: install, test, lint, build, docker-build
├── docker-compose.yml       # One-command local development stack
├── README.md                # Hero section, quickstart, badges, architecture diagram
├── LICENSE                  # Apache 2.0
├── package.json             # Root workspace config (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json               # Build pipeline orchestration
├── ANALYSIS_REPORT.md       # Pre-generated analysis
├── plan.md                  # This phase plan
└── prompt.md                # This execution prompt
```

---

## 3. TECHNICAL STACK

| Layer | Technology | Justification |
|-------|-----------|---------------|
| Monorepo | pnpm + Turbo + Changesets | Fast, deterministic, versioned releases |
| Core | TypeScript 5.x (Node 20 LTS) | Strict mode, single toolchain for 80% of code |
| Engine Parser | `yaml`, `json5`, `smol-toml` | Precise line:column errors, streaming |
| Engine Validator | `ajv` (JSON Schema 2020-12) | Fast, spec-compliant, custom keywords |
| API | Fastify + @fastify/swagger + Mercurius | Performance, built-in OpenAPI, GraphQL |
| Dashboard | React 18 + Vite + Tailwind + Radix | Modern, accessible, bundle size control |
| Dashboard State | Zustand | Lightweight, no boilerplate |
| CLI | Commander + Ora + Chalk | Reliable, fast to implement, bash/zsh completion |
| Python SDK | asyncio + httpx + pydantic | Async-first, type-safe |
| TS SDK | openapi-typescript + fetch | Isomorphic, tree-shakeable |
| Plugins | WASM (wasmtime) | Sandboxed, portable |
| Testing | Jest (TS) / pytest (Python) / Playwright | 90%+ coverage target |
| Logging | Pino (TS) / structlog (Python) | Structured JSON, OpenTelemetry compatible |
| Metrics | prom-client | Prometheus exposition format |

---

## 4. IMPLEMENTATION PHASES

### Phase 1: Foundation
**User confirmation required before starting.**

1. Initialize monorepo tooling (pnpm, Turbo, changesets, Husky).
2. Implement `packages/shared` — core types, errors, utilities.
3. Implement `packages/engine` MVP:
   - Parser: YAML/JSON/TOML with line:column errors
   - Validator: JSON Schema + custom rules
   - Resolver: `${env.VAR}`, `${blueprint.outputs}`
   - Merger: Hierarchical override with conflict detection
4. Tests: >90% coverage, 100% on critical paths.

**Deliverable:** `make test` passes for `shared` and `engine`.

### Phase 2: Core Runtime
**User confirmation required before starting.**

1. `packages/registry` — Local filesystem backend, SemVer, SHA-256, dependency resolution.
2. `packages/orchestrator` — DAG builder (topological sort + cycle detection), sequential executor, state machine, in-memory event bus.
3. `packages/cli` — `init`, `validate`, `plan`, `apply` commands with colored output and progress indicators.
4. Integration tests: CLI → Engine → Registry → Orchestrator.

**Deliverable:** `open-blueprint validate` and `open-blueprint apply` work end-to-end.

### Phase 3: API & Dashboard
**User confirmation required before starting.**

1. `packages/api` — Fastify REST (OpenAPI 3.1) + Mercurius GraphQL. JWT auth stub. Token bucket rate limiting. Pino logging. Request ID propagation.
2. `packages/dashboard` — React 18 + Vite. Blueprint list, Monaco editor, execution monitor (WebSocket). Dark mode default. WCAG 2.1 AA.
3. E2E tests with Playwright.

**Deliverable:** Dashboard loads, can create/edit blueprints, API serves OpenAPI spec.

### Phase 4: SDKs & Plugins
**User confirmation required before starting.**

1. `packages/sdk-typescript` — Isomorphic, ESM, generated from OpenAPI.
2. `packages/sdk-python` — Async-first, type hints, generated from OpenAPI.
3. `packages/plugin-system` — WASM loader, lifecycle management, example plugin (custom validator).

**Deliverable:** Both SDKs installable and testable. Plugin loads and executes.

### Phase 5: Hardening & DevOps
**User confirmation required before starting.**

1. Registry backends: S3, Git, PostgreSQL.
2. Secrets: Vault, AWS SM, SOPS.
3. Orchestrator: Parallel execution, exponential backoff, circuit breaker, Redis event bus.
4. All 10 examples runnable.
5. Deployments: Docker, K8s Helm, Terraform stubs.
6. CI/CD: GitHub Actions for test, lint, security-scan, release.
7. Security audit: zero critical vulnerabilities.
8. Performance benchmark: validation <100ms for standard blueprints.

**Deliverable:** `make test-e2e` passes. `docker-compose up` spins up full stack.

### Phase 6: GitHub Push
**User confirmation required before starting.**

1. Final `README.md` with quickstart.
2. `LICENSE` (Apache 2.0).
3. Conventional commit: `feat: initial implementation of Open Blueprint`.
4. Push to user-provided GitHub repository.

---

## 5. CODE QUALITY MANDATES

- **TypeScript:** `strict: true`, no `any` without ADR comment.
- **Python:** `mypy --strict`, no untyped defs.
- **Tests:** Write tests WITH the code, not after. Every public function has a test.
- **Linting:** ESLint (strict), Prettier, Black, golangci-lint (if Go).
- **Error Messages:** Every error must include: file path, line:column, severity, explanation, suggested fix.
- **Documentation:** Every package has a `README.md`. Every ADR is in `docs/ADRs/`.

---

## 6. SECURITY MANDATES

- Secrets resolved at runtime only. Never persist resolved values.
- RBAC roles: `viewer`, `editor`, `admin`, `executor`.
- Input sanitization: schema validation before any processing.
- Lockfiles committed. Dependency scanning in CI.
- No proprietary dependencies in core.

---

## 7. PERFORMANCE TARGETS

| Metric | Target | Verification |
|--------|--------|------------|
| Validation (standard blueprint) | <100ms | Benchmark script in `packages/engine/bench/` |
| CLI cold start | <500ms | `time open-blueprint --help` |
| API container start | <5s | Docker healthcheck |
| Dashboard bundle | <500KB gzipped | `vite-bundle-analyzer` |
| CLI RSS | <100MB | `ps` measurement |

---

## 8. RISK MITIGATION (From Analysis)

1. **Missing build plan docs:** Inferred scope in `ANALYSIS_REPORT.md`. Validate with user at each gate.
2. **Context window limits:** Commit frequently. Summarize phase state in `IMPLEMENTATION_SUMMARY.md`.
3. **Visual editor complexity:** Use React Flow (xyflow). Lazy load. Monitor bundle size.
4. **Large blueprint OOM:** Streaming parser. Do not load entire 10MB+ file into memory at once.
5. **Secret backend testing:** Use LocalStack + Vault dev mode + mocks. No live cloud accounts required for tests.

---

## 9. OUTPUT FORMAT

- **Files:** Complete files, not snippets, with accurate paths (`packages/engine/src/parser.ts`).
- **Runnable:** After `make install && make test`, everything passes.
- **Documentation:** Markdown with Mermaid diagrams. Cross-references between docs.
- **Git:** Incremental conventional commits. Clear commit messages.

---

## 10. FINAL CHECKLIST

Before declaring the project complete, verify:

- [ ] Every feature in Section 6 (Feature Completeness Checklist) of the master prompt is implemented OR explicitly deferred with ADR.
- [ ] `npm audit`, `pip audit` report zero critical/high vulnerabilities.
- [ ] `make test` exits 0 with >90% coverage.
- [ ] `make test-e2e` passes all scenarios.
- [ ] A new engineer can `git clone`, follow `README.md`, and contribute within 60 minutes.
- [ ] All 10 examples execute with `open-blueprint apply` without manual configuration.
- [ ] Validation benchmark <100ms for standard blueprints.
- [ ] `open-blueprint destroy` cleanly removes all resources created by `apply`.
- [ ] `git diff` on blueprint files is human-readable and mergeable.

---

**Begin by reading `ANALYSIS_REPORT.md` and confirming Phase 1 with the user.**
