# Open Blueprint — Complete Implementation Prompt
## Optimized for Claude Sonnet 4.6 | Agentic Configuration Infrastructure

---

## 1. ROLE DEFINITION

You are **Open Blueprint's Principal Architect & Lead Engineer**. Your sole objective is to build the complete Open Blueprint project — a declarative, version-controlled, runtime-agnostic agentic configuration infrastructure that serves as the **primary backbone** for AI agent orchestration.

You have full autonomy to make architectural decisions, but every decision must be defensible, documented, and aligned with the requirements below. You write production-grade code, not prototypes.

---

## 2. INPUT DOCUMENTS & KNOWLEDGE BASE

You MUST analyze and internalize the following documents before any implementation:

1. **`@bp_initial__build_plan.md`** — Foundational architecture, MVP scope, core abstractions, initial data models
2. **`@bp_complete_build_plan.md`** — Full feature matrix, advanced capabilities, long-term vision, integration targets
3. **PDF Reference Materials** (if provided) — Domain-specific constraints, compliance requirements, technical deep-dives

### Analysis Protocol (Execute First)
Before writing code, produce **`ANALYSIS_REPORT.md`** with:
- **Feature Matrix**: Every feature from both plans mapped to implementation status (Pending | In-Progress | Complete)
- **Architecture Delta**: Discrepancies between initial and complete plans with resolution strategy
- **Technical Decisions**: 5+ ADRs (Architecture Decision Records) for critical choices (language, storage, protocol, schema format)
- **Risk Register**: Top 10 risks with mitigation strategies
- **Dependency Graph**: Which components must be built before others

> **Sonnet 4.6 Tip**: Use your extended reasoning window to hold the entire mental model of both documents simultaneously. Cross-reference claims in the complete plan against the initial plan to detect scope creep or architectural pivots.

---

## 3. CORE ARCHITECTURAL PRINCIPLES

Every line of code must uphold these principles:

| Principle | Implementation Mandate |
|-----------|------------------------|
| **Declarative First** | All agent definitions are YAML/JSON/TOML with strict JSON Schema validation. No imperative configuration. |
| **Git-Native** | Configuration format must be diff-friendly, merge-conflict-aware, and produce readable `git blame` output. |
| **Composable** | Support blueprints that inherit from, mixin, or overlay other blueprints. No copy-paste configuration. |
| **Runtime-Agnostic** | Same blueprint runs locally (Docker), on K8s, or serverless without modification. Runtime-specifics are overlays. |
| **Observability-First** | Every configuration change emits traceable events. Drift detection is automatic, not opt-in. |
| **Security-by-Default** | Secrets never appear in plaintext configs. RBAC on every resource. Least-privilege execution. |

---

## 4. SYSTEM COMPONENTS — BUILD ALL

Implement the following components. Do not skip any unless explicitly marked [Optional] in the source documents.

### 4.1 Configuration Engine (`/packages/engine`)
- **Parser**: Multi-format parser (YAML 1.2, JSON, TOML v1.0) with precise error locations (line:column)
- **Validator**: JSON Schema Draft 2020-12 + custom rule engine for cross-reference integrity
- **Resolver**: Variable interpolation (`${env.VAR}`, `${secrets.vault.path}`, `${blueprint.outputs}`), environment-aware resolution
- **Merger**: Hierarchical override logic (default → environment → local → CLI args) with conflict detection
- **Compiler**: Transforms resolved blueprints into runtime-specific artifacts (Docker Compose, K8s manifests, Terraform)

**Language**: TypeScript (Node.js 20 LTS) for parser/validator; Rust for performance-critical resolver paths if specified in docs.

### 4.2 Blueprint Registry (`/packages/registry`)
- Storage backends: Local filesystem, S3-compatible, Git repository, PostgreSQL
- Semantic versioning (SemVer 2.0) with dependency resolution
- Content-addressable storage (SHA-256) for immutability
- Search & indexing (full-text on metadata, tags, descriptions)
- Access control: RBAC with namespace isolation

### 4.3 Agent Orchestrator (`/packages/orchestrator`)
- DAG construction from blueprint dependency graphs
- Execution engine: Parallel where safe, sequential where dependencies exist
- Retry logic: Exponential backoff, jitter, circuit breaker pattern
- Resource governance: CPU/memory limits, concurrency caps, queue backpressure
- State machine: PENDING → RUNNING → SUCCESS | FAILED | CANCELLED
- Event bus: Async notifications for state transitions (WebSocket + SSE + Webhooks)

### 4.4 CLI Interface (`/packages/cli`)
- **Framework**: Ink (React for CLI) or similar for rich terminal UI
- Commands:
  - `open-blueprint init` — Interactive project scaffolding
  - `open-blueprint validate [path]` — Static analysis with colored, actionable errors
  - `open-blueprint plan [path]` — Dry-run showing what would change
  - `open-blueprint apply [path]` — Deploy/execute blueprint
  - `open-blueprint destroy [path]` — Teardown managed resources
  - `open-blueprint registry push/pull/search` — Registry operations
  - `open-blueprint logs [execution-id]` — Stream execution logs
- **DX Features**: Progress bars, spinners, auto-completion scripts (bash/zsh/fish), man pages

### 4.5 API Layer (`/packages/api`)
- **REST**: OpenAPI 3.1 spec, HATEOAS where practical, standard HTTP verbs
- **GraphQL**: Apollo Server or similar, with query complexity limits and persisted queries
- **Authentication**: OAuth 2.0 + OIDC, API key management with rotation
- **Rate Limiting**: Token bucket per tenant, configurable limits
- **Middleware**: Request ID propagation, structured logging, panic recovery

### 4.6 Web Dashboard (`/packages/dashboard`)
- **Stack**: React 18 + TypeScript + Vite, state management with Zustand or Redux Toolkit
- **Features**:
  - Visual blueprint editor (drag-and-drop node graph for dependencies)
  - Real-time execution monitoring (WebSocket-backed)
  - Configuration diff viewer (side-by-side, syntax highlighted)
  - Team collaboration: Comments on blueprints, approval workflows
  - Audit log viewer with filtering
- **Design System**: Tailwind CSS + Radix UI primitives, dark mode default, accessible (WCAG 2.1 AA)

### 4.7 SDK / Client Libraries (`/packages/sdk-*`)
- **Python SDK**: `open-blueprint` PyPI package, async-first (asyncio), type hints throughout
- **TypeScript SDK**: Isomorphic (Node + Browser), tree-shakeable ESM builds
- **Go SDK**: If enterprise/performance focus in docs, idiomatic Go with context.Context

### 4.8 Plugin System (`/packages/plugin-system`)
- **Extension Points**: Custom validators, custom executors, custom exporters, custom secrets backends
- **Contract**: WASM-based plugins for sandboxing OR gRPC-based for performance (decide in ADR)
- **Lifecycle**: Load → Validate → Execute → Unload with resource cleanup
- **Registry**: Plugin marketplace integration (publish/install/discover)

---

## 5. TECHNICAL REQUIREMENTS & BEST PRACTICES

### 5.1 Code Quality
- **Test Coverage**: Minimum 90% line coverage; 100% for critical paths (engine, security)
  - Unit tests: Jest (TS) / pytest (Python) / Go test
  - Integration tests: Testcontainers for DB/external deps
  - E2E tests: Playwright for dashboard, custom CLI test harness
  - Property-based: fast-check / Hypothesis for invariant testing
- **Linting**: ESLint (strict), Prettier, Black (Python), golangci-lint
- **Type Safety**: Strict TypeScript (`strict: true`), mypy (Python `strict`), no `any` without ADR

### 5.2 Security
- **Secrets Management**:
  - Native integration: HashiCorp Vault, AWS Secrets Manager, Azure Key Vault, GCP Secret Manager
  - File-based: Mozilla SOPS for git-encrypted secrets
  - Runtime: Secrets injected as env vars or mounted files, never logged
- **RBAC Model**: Resource-based access control (RBAC) with roles: `viewer`, `editor`, `admin`, `executor`
- **Input Sanitization**: All user inputs validated against schemas before processing; no SQL injection vectors
- **Supply Chain**: Lockfiles committed, dependency scanning in CI (Snyk, npm audit, pip audit)

### 5.3 Observability
- **Tracing**: OpenTelemetry throughout; trace IDs propagated across all services
- **Logging**: Structured JSON logs (pino for TS, structlog for Python, zap for Go)
- **Metrics**: Prometheus exposition format; key metrics:
  - `blueprint_validation_duration_seconds`
  - `blueprint_execution_total` (with status label)
  - `registry_pulls_total`
  - `active_agent_count`
- **Alerting**: SLO-based alerts (e.g., 99.9% validation success rate)

### 5.4 Performance
- **Validation**: Sub-100ms for blueprints <10MB; streaming validation for larger files
- **Concurrency**: Handle 10,000+ agent definitions in a single blueprint without OOM
- **Startup**: CLI cold start <500ms; API container start <5s
- **Memory**: Dashboard bundle <500KB gzipped; CLI <100MB RSS

---

## 6. FEATURE COMPLETENESS CHECKLIST

Verify every item from `@bp_complete_build_plan.md` is implemented:

#### Configuration & Modeling
- [ ] Hierarchical configuration overrides (global → org → project → environment → local)
- [ ] Environment-specific profiles (`dev`, `staging`, `prod`) with inheritance
- [ ] Secret references with multiple backend support
- [ ] Template engine (Jinja2-style or Go templates) with sandboxing
- [ ] Conditional logic (`if`, `switch`, `for` loops) in blueprints
- [ ] Import/export of configuration modules

#### Validation & Integrity
- [ ] JSON Schema validation with custom error messages
- [ ] Cross-blueprint reference validation (no dangling refs)
- [ ] Semantic validation (e.g., port conflicts, circular dependencies)
- [ ] Custom validation rules via plugins
- [ ] Pre-commit hooks for git integration

#### Orchestration & Execution
- [ ] DAG-based execution with topological sorting
- [ ] Parallel execution with configurable worker pools
- [ ] Retry policies (fixed, exponential, custom)
- [ ] Circuit breakers and bulkhead isolation
- [ ] Health checks and self-healing restarts
- [ ] Graceful shutdown with in-flight job completion

#### Integrations
- [ ] **Container**: Docker, Docker Compose, Kubernetes, Helm
- [ ] **Cloud**: AWS (ECS, EKS, Lambda), GCP (Cloud Run, GKE), Azure (Container Instances, AKS)
- [ ] **LLM Providers**: OpenAI, Anthropic, Google Gemini, local (Ollama, vLLM, LM Studio)
- [ ] **Agent Frameworks**: LangChain, CrewAI, AutoGen, LlamaIndex adapters
- [ ] **CI/CD**: GitHub Actions, GitLab CI, CircleCI, Jenkins plugins
- [ ] **Observability**: Datadog, New Relic, Grafana, Jaeger

#### Collaboration & Governance
- [ ] Multi-tenant workspaces with isolation
- [ ] Role-based access control (RBAC)
- [ ] Approval workflows for production deployments
- [ ] Configuration sharing and marketplace
- [ ] Audit logging (who changed what, when, with before/after)
- [ ] Compliance reporting (SOC2, GDPR relevant features)

#### Migration & Interoperability
- [ ] Import from LangChain configurations
- [ ] Import from CrewAI crew definitions
- [ ] Import from AutoGen agent configs
- [ ] Import from existing YAML/JSON configs (generic)
- [ ] Export to Terraform, Pulumi, CloudFormation
- [ ] Export to Docker Compose, Kubernetes YAML, Helm charts

---

## 7. USER VALUE & DEVELOPER EXPERIENCE (DX)

Open Blueprint is the **main** infrastructure for your users. Every interaction must feel premium:

| Experience | Requirement |
|------------|-------------|
| **First 30 Seconds** | `open-blueprint init` creates a runnable project with a working example agent |
| **IDE Integration** | LSP server providing: autocomplete, hover docs, go-to-definition, real-time validation, quick-fixes |
| **Error Messages** | Every error includes: file path, line:column, severity, explanation, suggested fix, documentation link |
| **Debugging** | `open-blueprint validate --explain` outputs a human-readable dependency graph and conflict analysis |
| **Migration** | `open-blueprint import [tool]` with fidelity report showing what imported cleanly vs. manually needed |
| **Learning** | Built-in `open-blueprint tutorial` interactive CLI walkthrough |
| **Community** | `/examples` directory with 10+ real-world scenarios; built-in gallery command |

---

## 8. PROJECT STRUCTURE

Generate the following monorepo structure:

```
open-blueprint/
├── .github/
│   ├── workflows/           # CI: test, lint, security-scan, release
│   └── CONTRIBUTING.md
├── docs/
│   ├── ARCHITECTURE.md      # C4 model diagrams (Mermaid)
│   ├── API.md               # Auto-generated OpenAPI + GraphQL docs
│   ├── ADRs/                # Architecture Decision Records (numbered)
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
│   ├── sdk-go/              # Go client library [if required]
│   ├── plugin-system/       # Extension framework
│   └── shared/              # Common types, utilities, protobuf definitions
├── examples/
│   ├── 01-hello-agent/      # Minimal single-agent blueprint
│   ├── 02-multi-agent-chat/ # Multi-agent conversation orchestration
│   ├── 03-rag-pipeline/     # Retrieval-augmented generation workflow
│   ├── 04-data-etl/         # Data processing agent swarm
│   ├── 05-customer-support/ # Production-grade support agent
│   ├── 06-code-review/      # Automated PR review agent
│   ├── 07-research-assistant/ # Deep research multi-step agent
│   ├── 08-devops-automation/ # Infrastructure management agent
│   ├── 09-compliance-audit/ # Regulatory checking agent
│   └── 10-plugin-development/ # Custom plugin example
├── deployments/
│   ├── docker/
│   ├── kubernetes/          # Helm chart + raw manifests
│   └── terraform/             # Infrastructure modules
├── scripts/
│   ├── setup.sh
│   └── release.sh
├── Makefile                 # Standard targets: install, test, lint, build, docker-build
├── docker-compose.yml       # One-command local development stack
├── README.md                # Hero section, quickstart, badges, architecture diagram
├── LICENSE                  # Apache 2.0 or MIT (per project docs)
├── package.json             # Root workspace config (pnpm workspaces)
├── pnpm-workspace.yaml
├── turbo.json               # Build pipeline orchestration
└── ANALYSIS_REPORT.md       # Your initial analysis output
```

---

## 9. IMPLEMENTATION PHASES

Execute in this order. Do not skip phases.

### Phase 1: Foundation (Days 1-3)
1. Parse and analyze all input documents → `ANALYSIS_REPORT.md`
2. Set up monorepo tooling (pnpm, Turbo, changesets, Husky)
3. Implement `packages/shared` — core types, errors, utilities
4. Implement `packages/engine` — parser, validator, resolver (MVP subset)
5. Write comprehensive tests for engine

### Phase 2: Core Runtime (Days 4-6)
1. Implement `packages/registry` — local filesystem backend first
2. Implement `packages/orchestrator` — DAG builder + sequential executor
3. Implement `packages/cli` — init, validate, plan, apply commands
4. Integration tests: CLI → Engine → Registry → Orchestrator

### Phase 3: API & Dashboard (Days 7-9)
1. Implement `packages/api` — REST + GraphQL with registry integration
2. Implement `packages/dashboard` — blueprint list, editor, execution viewer
3. End-to-end tests: Dashboard → API → Backend

### Phase 4: SDKs & Plugins (Days 10-12)
1. Implement `packages/sdk-python` and `packages/sdk-typescript`
2. Implement `packages/plugin-system` with one example plugin
3. Write SDK integration tests

### Phase 5: Hardening & DevOps (Days 13-15)
1. Add remaining backends (S3, PostgreSQL, Vault)
2. Implement all 10 examples in `/examples`
3. Kubernetes deployment manifests
4. CI/CD pipelines
5. Security audit and performance benchmarking
6. Final documentation pass

> **Sonnet 4.6 Execution Strategy**: You may parallelize within phases (e.g., build API and Dashboard simultaneously) but respect the phase dependencies. If you encounter a blocking issue, write an ADR and pivot rather than stalling.

---

## 10. SUCCESS CRITERIA

The implementation is complete ONLY when:

- [ ] **Feature Parity**: Every feature in `@bp_complete_build_plan.md` has a corresponding implementation with test coverage
- [ ] **Zero Critical Issues**: `npm audit`, `pip audit`, `snyk test`, and `trivy` scans report zero critical/high vulnerabilities
- [ ] **Test Pass**: `make test` exits 0 with >90% coverage; `make test-e2e` passes all scenarios
- [ ] **Documentation Complete**: A new engineer can `git clone`, follow `README.md`, and make a meaningful contribution within 60 minutes
- [ ] **Examples Runnable**: All 10 examples execute with `open-blueprint apply` without manual configuration
- [ ] **Performance Met**: Validation <100ms for standard blueprints; 1000 concurrent configs <5% CPU overhead
- [ ] **Hot Reload**: Configuration changes propagate to running agents within 10 seconds (where runtime supports it)
- [ ] **Rollback Working**: `open-blueprint destroy` cleanly removes all resources created by `apply`
- [ ] **Git Integration**: `git diff` on blueprint files is human-readable and mergeable

---

## 11. CONSTRAINTS & NON-NEGOTIABLES

1. **Language Defaults**: TypeScript/Node.js for tooling and API; Python for ML/agent runtime; Go only if performance is explicitly required in docs
2. **Dependency Policy**: Prefer mature, LTS dependencies. No 0.x experimental libraries in production paths
3. **Backwards Compatibility**: Schema changes must include migration paths. Never break existing blueprints without deprecation cycle
4. **Open Source Alignment**: License must be permissive (Apache 2.0 or MIT). No proprietary dependencies in core
5. **Documentation as Code**: All docs live in repo, versioned with code. No external wiki dependencies
6. **Accessibility**: Dashboard meets WCAG 2.1 AA. CLI supports screen readers where possible

---

## 12. PROMPT FOR SONNET 4.6 — EXECUTION INSTRUCTIONS

When you begin, follow this exact sequence:

1. **Read** `@bp_initial__build_plan.md` and `@bp_complete_build_plan.md` completely. If PDFs are attached, extract their text and incorporate.
2. **Write** `ANALYSIS_REPORT.md` with the analysis protocol from Section 2.
3. **Ask** (if needed): If the documents contain ambiguities, present 3 options with trade-offs and await user choice before proceeding.
4. **Initialize** the monorepo structure from Section 8.
5. **Implement** Phase 1 completely before announcing completion.
6. **Continue** through phases sequentially, presenting progress summaries at each phase boundary.
7. **Deliver** final artifacts: codebase, documentation, deployment assets, and a `IMPLEMENTATION_SUMMARY.md` highlighting key decisions and known limitations.

---

## 13. OUTPUT FORMAT

All code must be delivered as:
- **File blocks** with accurate paths (`packages/engine/src/parser.ts`)
- **Complete files**, not snippets, unless explicitly refactoring
- **Runnable**: I should be able to copy the output into a directory and run `make install && make test`

All documentation must be:
- **Markdown** with Mermaid diagrams where architecture is described
- **Linked**: Cross-references between docs (e.g., "See Architecture Decision Record 003")

---

**Begin with the Analysis Phase. Do not write implementation code until the analysis is complete and approved.**
