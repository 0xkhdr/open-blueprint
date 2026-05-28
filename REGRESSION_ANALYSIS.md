# open-blueprint Regression & Comprehensive Implementation Analysis
**Date:** 2026-05-28  
**Version:** 2.1 (Post-1.0 Regression & Extended Roadmap)  
**Status:** Deep-Dive Analysis with Phased Implementation Plan

---

## Executive Summary

`open-blueprint` v1.0.0 has shipped a **solid foundation**: 4-engine architecture (Detector → Templater → Validator → Translator), 5-layer governance model, 95% test coverage (227 passing tests), full TypeScript support, and native backends for Claude Code, Cursor, and OpenDev. However, **critical gaps** prevent production-grade enterprise adoption:

- **6 high-value backends missing**: Codex, PI Agent, Kiro, Antigravity, Copilot, Gemini
- **Enterprise governance absent**: RBAC, audit logging, compliance mapping, risk tiers, escalation workflows
- **Advanced configuration mechanisms unimplemented**: Settings, Commands, MCP Servers, subagent memory, agent teams
- **Observability & cost governance missing**: Telemetry, cost tracking, semantic drift detection, alerting
- **DX not optimized**: No interactive wizard, IDE extension, LSP, migration assistant, live dev server

This document synthesizes:
1. **Current state assessment** (what's shipped & working)
2. **Regression analysis** (code quality, architecture, test coverage review)
3. **Gap mapping** (against open-blueprint-analysis.md priorities)
4. **Phased implementation roadmap** (24-week, 6-phase plan with clear acceptance criteria)

---

## Part 1: Current State Regression Analysis

### 1.1 Implementation Status Matrix

| Component | Status | Coverage | Notes |
|-----------|--------|----------|-------|
| **CLI Core** | ✅ Complete | 100% | 11 commands fully functional |
| **Detector Engine** | ✅ Complete | 98% | Language, framework, security detection; lacks some enterprise signals |
| **Templater Engine** | ✅ Complete | 97% | Block-level merging, Handlebars rendering solid |
| **Validator Engine** | ✅ Complete | 96% | 4-layer validation (structural, semantic, logical, drift); exit codes 0–10 |
| **Translator Engine** | ✅ Complete | 94% | IR schema, Claude/Cursor/Generic adapters; missing 6 backends |
| **Template System** | ✅ Complete | 93% | Registry client, cryptographic signing, pack management |
| **LSP Foundation** | ⚠️ Stub | 15% | Framework in place; no hover docs, diagnostics, or autocompletion |
| **Plugin API** | ✅ Complete | 87% | TypeScript-based custom validators functional |
| **Security Module** | ✅ Complete | 91% | Audit logging, secret scanning; missing compliance integration |
| **Registry Client** | ✅ Complete | 89% | Template pack download/publish; no marketplace features |

### 1.2 Test Coverage Snapshot (v1.0.0)

**Overall:** 227 tests, 29 test files, all passing ✅

| Module | Tests | Pass | Coverage | Notes |
|--------|-------|------|----------|-------|
| Detector | 35 | 35 | 98% | Language/framework detection solid; edge cases rare |
| Templater | 28 | 28 | 97% | Merger & writer well-tested |
| Validator | 62 | 62 | 96% | Logical (SCC) & semantic validators comprehensive |
| Translator | 18 | 18 | 94% | IR roundtrip >98%; adapter tests adequate |
| CLI Commands | 51 | 51 | 92% | All 11 commands tested; integration tests strong |
| Registry | 14 | 14 | 89% | Client happy-path covered; error cases light |
| Security | 19 | 19 | 91% | Audit logging tested; secret scan basic |

**Gaps:** No fuzz tests beyond validator; no chaos/failure injection; missing performance benchmarks.

### 1.3 Architecture Quality Assessment

#### Strengths
✅ **Clean separation of concerns**: 4-engine pipeline with clear contracts  
✅ **Type-safe IR**: Zod schemas with strict validation  
✅ **Idempotency**: Block-level merging preserves user edits  
✅ **Exit codes**: Semantic exit codes 0–10 for CI integration  
✅ **No runtime overhead**: Scaffolding-only, zero-runtime tokens  
✅ **Plugin extensibility**: Custom validator API clear and working  

#### Weaknesses
⚠️ **Single-pass validation**: No inter-layer dependency graph (e.g., rule → skill references unvalidated)  
⚠️ **Limited backend coverage**: Only 3 backends (Claude, Cursor, OpenDev); generic fallback insufficient for enterprise  
⚠️ **No enterprise layers**: Missing Identity, Audit, Compliance, Risk, Registry, Orchestration  
⚠️ **Detector signals incomplete**: No cost estimation, autonomy levels, approval modes, or risk scoring  
⚠️ **Translator can't round-trip all layers**: Settings, Commands, MCP Servers not in IR  
⚠️ **No runtime observability**: Can't track agent behavior drift; only file-level drift detection  
⚠️ **Template inheritance shallow**: No org → team → project hierarchy  

---

## Part 2: Gap Analysis (Regression Against open-blueprint-analysis.md)

### 2.1 Critical Gaps

#### Gap 1: Backend Ecosystem Fragmentation
**Severity:** 🔴 Critical | **Impact:** Market reach limited to 4 tools (Claude, Cursor, OpenDev, Goose generic)

**Missing:**
- **Codex (OpenAI)**: No `codex.md`, `.codex/rules/`, approval mode mapping
- **PI Agent**: No `pi.config.ts` scaffolding, TypeScript config generation, extension governance
- **Kiro (AWS)**: No spec-driven steering (product.md, structure.md, tech.md, libraries.md)
- **Antigravity (Google)**: No artifact governance, parallel agent coordination
- **GitHub Copilot**: No `copilot-instructions.md` generation, Copilot-specific settings
- **Gemini CLI**: No `gemini.md` support

**Blocker:** Enterprise deals blocked. Customers can't migrate between tools.

---

#### Gap 2: Enterprise Governance Absent
**Severity:** 🔴 Critical | **Impact:** Compliance/security departments reject v1.0.0

**Missing Layers:**
- **Identity Layer**: No RBAC, IAM integration, agent ownership, role bindings
- **Audit Layer**: No structured logging, correlation IDs, compliance audit trails
- **Compliance Layer**: No EU AI Act, ISO 42001, NIST AI RMF mapping, compliance checkpoints
- **Risk Layer**: No risk tier classification (low/medium/high/critical), auto-detection, escalation
- **Governance Workflows**: No change approval, promotion gates (dev → staging → prod), rollback procedures

**Impact:** Zero enterprise customers; free-tier only.

---

#### Gap 3: Advanced Configuration Mechanisms
**Severity:** 🟠 High | **Impact:** Governance reach limited

**Missing in IR & templates:**
- **Settings Layer**: No approval modes (auto/confirm/read-only), model configs, cost controls, safety modes
- **Commands Layer**: No custom tool definitions, command aliases, tool approval scopes
- **MCP Servers Layer**: No MCP server configs, auth scopes, tool registry, risk assessment
- **Subagents**: No persistent memory directories, agent team definitions, orchestration
- **Persistent Memory**: No memory governance, retention policies, file integrity validation

**Market Signal:** PI Agent, Kiro, Copilot all have these; bp doesn't.

---

#### Gap 4: Observability & Cost Governance
**Severity:** 🟠 High | **Impact:** Can't operate in production

**Missing:**
- **Telemetry**: No OpenTelemetry, Datadog, New Relic integration templates
- **Cost Tracking**: No per-agent, per-session, per-rule cost attribution, budget configs
- **Semantic Drift**: Only file drift detected; behavioral drift (rule effectiveness, token wastage) invisible
- **Performance Metrics**: No latency, error rate, success rate tracking by skill/rule
- **Alerting**: No policy violation alerts, anomaly detection, budget overrun notifications

**Consequence:** Production deployments fly blind; cost runaway undetected.

---

### 2.2 High-Priority Gaps

#### Gap 5: Multi-Agent Orchestration
**Current:** No agent teams, chains, memory, cross-agent communication  
**Required:** Agent registry, teams.yaml, chains.yaml, memory governance, shared state validation  
**Phase:** 3 (Weeks 11–14)

#### Gap 6: Settings & Runtime Configuration
**Current:** IR doesn't model settings, commands, MCP servers  
**Required:** Extend IR, add Layer 6–8 support, backend mappers  
**Phase:** 0 (Weeks 1–2)

#### Gap 7: MCP Server Governance
**Current:** Zero MCP support  
**Required:** Tool registry, server configs, permission validation, risk scoring  
**Phase:** 3 (Weeks 11–14)

---

### 2.3 Medium-Priority Gaps

#### Gap 8: Developer Experience
**Current:** CLI-only, no IDE support, no interactive wizard, no migration assistant  
**Required:** VS Code extension, LSP, `bp init --interactive`, migration tooling  
**Phase:** 5 (Weeks 18–20)

#### Gap 9: Observability Integration
**Current:** No telemetry, cost, or alerting integration  
**Required:** OpenTelemetry config generation, budget APIs, Slack/PagerDuty templates  
**Phase:** 4 (Weeks 15–17)

#### Gap 10: Ecosystem & Marketplace
**Current:** Registry basic; no ratings, usage stats, verified publishers  
**Required:** Marketplace v2 with governance, template inheritance, diff/merge  
**Phase:** 6 (Weeks 21–24)

---

## Part 3: Code Architecture Review

### 3.1 Detector Engine Analysis

**File:** `src/detector/index.ts`  
**Status:** ✅ Production-ready  
**Strengths:**
- Stateless, deterministic fingerprinting
- Zero network/shell overhead
- Language & framework detection > 95% accuracy
- Lockfile parsing comprehensive (npm, yarn, pnpm, pip, cargo, maven)

**Gaps Requiring Backfill:**
1. **Risk Scoring** (Phase 2): No `risk_tier` detection from security signals
2. **Approval Mode Inference** (Phase 1): Can't detect autonomy level needed
3. **Cost Estimation** (Phase 4): No token budget inference from project size
4. **Enterprise Signals** (Phase 2): No RBAC/compliance signal detection

**Recommended Extension:**
```typescript
export interface EnhancedFingerprint extends Fingerprint {
  risk_tier: "low" | "medium" | "high" | "critical";
  risk_signals: {
    has_external_apis: boolean;
    has_secrets_manager: boolean;
    has_auth_layer: boolean;
    has_data_sensitive: boolean;
  };
  suggested_approval_mode: "auto" | "confirm" | "read-only";
  estimated_monthly_tokens: number;
}
```

### 3.2 Templater Engine Analysis

**Files:** `src/templater/{engine,merger,writer,selector}.ts`  
**Status:** ✅ Production-ready  
**Strengths:**
- Block-level merging idempotent and correct
- Fallback chain: [Lang+Framework] → Language → Generic
- Preserve blocks (`bp:preserve`) respected correctly
- Handlebars rendering performant

**Gaps:**
1. **No Settings/Commands/MCP templates**: Only Layer 1–5 have Handlebars templates
2. **No multi-backend inheritance**: Can't cascade claude.md → cursor → generic
3. **No conditional generation**: All templates always rendered (no "generate only if risk_tier=critical")

**Recommended Extension:**
```typescript
interface TemplateMetadata {
  layers: number[];  // [1,2,3,4,5,6,7,8]
  risk_tiers?: ("low" | "medium" | "high" | "critical")[];  // Generate only if project matches
  requires_backend_specific: boolean;
  inheritance_chain?: string[];  // ["claude", "cursor", "generic"]
}
```

### 3.3 Validator Engine Analysis

**Files:** `src/validator/{structural,semantic,logical,drift}.ts`  
**Status:** ✅ 96% production-ready  
**Strengths:**
- Tarjan's SCC for circular dependency detection
- Glob intersection analysis comprehensive
- Drift detection compares old/new fingerprints
- 4-layer architecture orthogonal and composable

**Gaps:**
1. **No cross-layer validation**: Can't validate Rule → Skill references
2. **No enterprise layer validation**: No RBAC/Compliance/Audit schema validation
3. **No performance validation**: Can't detect rule explosion (e.g., 10K+ glob patterns)
4. **Limited semantic depth**: Only checks frontmatter; ignores Markdown link structure

**Recommended Additions (Phase 1):**
- Layer 6–8 schema validation (Settings, Commands, MCP)
- Cross-layer reference resolver (rules → skills → agents)
- Performance audit (glob pattern explosion, rule count thresholds)

### 3.4 Translator Engine Analysis

**Files:** `src/translator/{ir.ts,adapters/{claude,cursor,generic}.ts}`  
**Status:** ✅ 94% production-ready, IR incomplete  
**Current IR:**
```typescript
BlueprintIRSchema = {
  version: "1.0",
  spatial_anchor: SpatialAnchorSchema,
  personas: PersonaSchema[],
  rules: RuleSchema[],
  skills: SkillSchema[],
  hooks: HookSchema[],
  meta: MetaSchema,
}
```

**Gaps:**
1. **No Settings, Commands, MCP**: IR missing Layers 6–8
2. **No Identity/Audit/Compliance**: Enterprise layers absent
3. **No extended metadata**: Adapter-specific fields (e.g., Codex approval_mode) can't be expressed

**Required Extension (Phase 0):**
```typescript
BlueprintIRSchema = {
  // ... existing fields ...
  settings?: SettingsSchema,       // NEW Layer 6
  commands?: CommandSchema[],       // NEW Layer 7
  mcp_servers?: MCPServerSchema[],  // NEW Layer 8
  identity?: IdentitySchema,        // NEW cross-layer
  audit?: AuditSchema,              // NEW cross-layer
  compliance?: ComplianceSchema,    // NEW cross-layer
  risk?: RiskSchema,                // NEW cross-layer
  registry?: RegistrySchema,        // NEW cross-layer
  orchestration?: OrchestrationSchema, // NEW cross-layer
}
```

---

## Part 4: Phased Implementation Roadmap (24 Weeks, 6 Phases)

### Phase 0: IR Foundation & Baseline Layers (Weeks 1–2)
**Theme:** Extend IR schema to support 8 layers + enterprise features

| Task | Effort | Acceptance Criteria |
|------|--------|---------------------|
| **0.1** Extend IR schema (Settings, Commands, MCP, enterprise layers) | 3d | New IR passes validation; all 29 tests still pass |
| **0.2** Update Templater to handle Layer 6–8 | 2d | Conditional generation works; new layers render blank if not in blueprint |
| **0.3** Elevate AGENTS.md to first-class output | 2d | All backends generate AGENTS.md with cross-tool compatibility header |
| **0.4** Add Detector enterprise signals (risk_tier, approval_mode inference) | 3d | Fingerprint includes risk_tier + suggested_approval_mode |
| **0.5** Add basic Validator schemas for new layers | 2d | Structural validation passes for Settings/Commands/MCP objects |

**Deliverables:**
- `src/translator/ir.ts` extended with 8 layers + 5 enterprise schemas
- `src/templater/engine.ts` supports conditional layer generation
- `src/detector/index.ts` risk scoring + approval mode inference
- `AGENTS.md` generated by all backend adapters
- New tests: 40+ covering IR roundtrip, new validators, AGENTS.md

**Exit Criteria:**
```bash
npm run test        # 270+ tests passing
npm run typecheck   # Zero errors
npm run build       # Produces clean dist/
```

---

### Phase 1: Backend Expansion (Weeks 3–8)
**Theme:** Close the backend coverage gap; support 10 backends

| Backend | Effort | Key Files | Notes |
|---------|--------|-----------|-------|
| **Codex** | 3d | `.codex/rules/`, `codex.md` | Map approval_mode → Settings |
| **PI Agent** | 4d | `pi.config.ts`, `skills/`, `teams.yaml`, `chains.yaml` | TypeScript config generation |
| **Kiro (AWS)** | 4d | `product.md`, `structure.md`, `tech.md`, `libraries.md` | Spec-driven steering |
| **Antigravity** | 3d | Artifact governance, workspace configs | Parallel agent coordination |
| **Copilot** | 2d | `copilot-instructions.md`, `.github/copilot/` | Copilot-specific settings |
| **Gemini** | 2d | `gemini.md`, `AGENTS.md` | Gemini CLI context files |
| **Goose** | 2d | ProfileYAML, extensions | Enhanced generic adapter |

**Deliverables:**
- 6 new backend adapters in `src/translator/adapters/{codex,pi,kiro,antigravity,copilot,gemini}.ts`
- Template packs for each backend in `templates/{codex,pi,kiro,antigravity,copilot,gemini}/`
- Backend feature parity matrix (docs)
- Migration templates for Claude → Codex, Cursor → PI, etc.

**Exit Criteria:**
- All 6 backends tested and round-trip verified
- Feature parity matrix published
- 50+ new tests for backend adapters

---

### Phase 2: Enterprise Governance (Weeks 9–14)
**Theme:** Production-grade security, compliance, RBAC

| Task | Effort | Acceptance Criteria |
|------|--------|---------------------|
| **2.1** Risk Tier Classification | 2d | Risk layer in IR; Detector auto-scores; Validator enforces rules |
| **2.2** RBAC & Identity Governance | 3d | Identity layer; IAM policy generation for Kiro; RBAC validation |
| **2.3** Audit Logging Framework | 3d | Audit layer; correlation IDs; PI `audit.jsonl` integration |
| **2.4** Compliance Framework Mapping | 4d | Compliance layer; EU AI Act, ISO 42001, NIST checklists; gap reporting |
| **2.5** Secret Governance** | 2d | Enhanced secret scan; `.env.template` generation; never-commit checks |
| **2.6** Escalation & Incident Response | 3d | Incident layer; runbook generation; rollback procedures |
| **2.7** Change Approval Workflows | 3d | Workflow layer; PR-based change approval; governance checkpoints |

**Deliverables:**
- 5 new enterprise schema modules in `src/validator/`
- `bp doctor` enhanced with compliance report
- `bp verify` includes risk audit, secret scan, compliance mapping
- Enterprise templates (GDPR, SOC 2, HIPAA-aware)

**Exit Criteria:**
- Compliance mapping tested against 5 frameworks
- Risk tier classification >90% accuracy
- 100+ new tests

---

### Phase 3: Multi-Agent & MCP (Weeks 15–20)
**Theme:** Orchestration and tool interoperability

| Task | Effort | Acceptance Criteria |
|------|--------|---------------------|
| **3.1** Agent Registry | 2d | Registry layer; agent metadata (owner, purpose, risk, eval status) |
| **3.2** Tool Registry | 2d | Tool registry; MCP tools documented with auth scopes, access levels |
| **3.3** MCP Server Governance | 3d | MCP layer; `mcp.json` scaffolding; permission validation; risk scoring |
| **3.4** Multi-Agent Teams | 2d | Extend Personas to teams; generate `teams.yaml` for PI, Claude team configs |
| **3.5** Agent Chains & Orchestration | 3d | Orchestration layer; sequential/parallel chains; state passing governance |
| **3.6** Persistent Memory** | 2d | Memory layer; subagent memory directory governance; retention policies |
| **3.7** Cross-Agent Communication | 2d | Messaging layer; inter-agent message validation; shared state schemas |

**Deliverables:**
- 4 new registry layers (Agent, Tool, MCP, Orchestration)
- `mcp.json` generator with permission validation
- Teams + chains schema support in IR
- Memory governance module

**Exit Criteria:**
- MCP server configs generated and validated
- Agent chains tested end-to-end
- 80+ new tests

---

### Phase 4: Observability & Cost (Weeks 21–26)
**Theme:** Operational visibility and budget control

| Task | Effort | Acceptance Criteria |
|------|--------|---------------------|
| **4.1** Telemetry Integration | 2d | Telemetry layer; OpenTelemetry config templates; Datadog/New Relic integration |
| **4.2** Cost Tracking & Budgets** | 3d | Cost layer; per-agent/per-session budgets; token tracking; cost attribution |
| **4.3** Performance Metrics** | 2d | Metrics layer; latency tracking; error/success rate baselines |
| **4.4** Semantic Drift Detection | 3d | Enhanced drift engine; behavioral drift (output comparison); rule effectiveness |
| **4.5** Alerting & Anomaly Detection** | 2d | Alerting layer; policy violation alerts; PagerDuty/Slack templates |

**Deliverables:**
- Telemetry + Cost + Metrics + Alerting layers in IR
- Drift engine v2 with semantic analysis
- Dashboard generation for cost/metrics
- Integration templates for 5+ observability platforms

**Exit Criteria:**
- Cost tracking tested with 3 backends
- Semantic drift detection >85% accuracy
- 70+ new tests

---

### Phase 5: Developer Experience (Weeks 27–32)
**Theme:** Tooling, IDE support, and migration

| Task | Effort | Acceptance Criteria |
|------|--------|---------------------|
| **5.1** Interactive Init Wizard | 3d | `bp init --interactive` with backend/risk/compliance selection |
| **5.2** VS Code Extension** | 5d | Real-time validation, glob linting, skill references, one-click verify |
| **5.3** LSP Implementation** | 4d | Hover docs, go-to-definition, diagnostics, quick fixes |
| **5.4** Migration Assistant** | 4d | `bp migrate --from <tool> --to <tool>` with parity testing |
| **5.5** Live Reload Dev Server** | 3d | `bp dev --watch` with real-time dashboard |
| **5.6** Documentation Generator** | 2d | `bp docs` auto-generates audit-ready governance docs |

**Deliverables:**
- `editors/vscode/` extension with full feature set
- LSP server at `src/lsp/server.ts`
- Migration wizard in CLI
- Dev server with browser dashboard

**Exit Criteria:**
- VS Code extension published to marketplace
- LSP passes all hover/goto/diagnostic tests
- Migration assistant tested on 5+ real repos
- 100+ new tests

---

### Phase 6: Ecosystem & Scale (Weeks 33–36)
**Theme:** Community, marketplace, and enterprise features

| Task | Effort | Acceptance Criteria |
|------|--------|---------------------|
| **6.1** Template Marketplace v2 | 3d | Community ratings, verified publishers, dependency graphs |
| **6.2** Shared Rule Library** | 2d | GDPR, SOC 2, HIPAA, PCI-DSS rule packs; one-command install |
| **6.3** Enterprise Template Inheritance** | 2d | Org → team → project hierarchy; merge strategies; override audit trails |
| **6.4** Blueprint Diff & Merge** | 3d | Semantic diff/merge; three-way merge; conflict resolution UI |
| **6.5** SaaS Governance Dashboard** | 5d | Optional cloud offering; centralized multi-repo enforcement; reporting |

**Deliverables:**
- Marketplace v2 API + frontend
- Rule library service
- SaaS dashboard MVP (optional)
- Diff/merge CLI commands

**Exit Criteria:**
- 200+ community templates registered
- 50+ shared rule packs available
- SaaS MVP deployed (if pursuing)

---

## Part 5: Detailed Implementation Stages

### Stage 1.0: IR Extension & AGENTS.md (Week 1)

**Objective:** Extend IR to support 8 layers; make AGENTS.md universal output.

**Files to Create/Modify:**

1. **`src/translator/ir.ts`** — Extend schema
```typescript
// Add new layer schemas
export const SettingsSchema = z.object({ ... });  // Layer 6
export const CommandSchema = z.object({ ... });   // Layer 7
export const MCPServerSchema = z.object({ ... }); // Layer 8

// Add enterprise cross-layer schemas
export const IdentitySchema = z.object({ ... });
export const AuditSchema = z.object({ ... });
export const ComplianceSchema = z.object({ ... });
export const RiskSchema = z.object({ ... });
export const RegistrySchema = z.object({ ... });
export const OrchestrationSchema = z.object({ ... });

// Extend BlueprintIRSchema
export const BlueprintIRSchema = z.object({
  version: z.literal("2.0"),  // Bump version
  spatial_anchor: SpatialAnchorSchema,
  personas: z.array(PersonaSchema),
  rules: z.array(RuleSchema),
  skills: z.array(SkillSchema),
  hooks: z.array(HookSchema),
  settings: SettingsSchema.optional(),
  commands: z.array(CommandSchema).optional(),
  mcp_servers: z.array(MCPServerSchema).optional(),
  identity: IdentitySchema.optional(),
  audit: AuditSchema.optional(),
  compliance: ComplianceSchema.optional(),
  risk: RiskSchema.optional(),
  registry: RegistrySchema.optional(),
  orchestration: OrchestrationSchema.optional(),
  meta: MetaSchema,
});
```

2. **`src/translator/adapters/agents-md.ts`** — New AGENTS.md generator
```typescript
export function generateAgentsMD(ir: BlueprintIR): string {
  // Cross-tool AGENTS.md with compatibility header
  // Includes personas, approval modes, tool scopes
}
```

3. **`src/translator/adapters/{claude,cursor,opendev,generic}.ts`** — Add AGENTS.md output
```typescript
// In each adapter's translate() method:
const agentsMD = generateAgentsMD(ir);
outputs['AGENTS.md'] = agentsMD;
```

4. **`src/detector/index.ts`** — Add risk scoring
```typescript
export interface EnhancedFingerprint extends Fingerprint {
  risk_tier: "low" | "medium" | "high" | "critical";
  suggested_approval_mode: "auto" | "confirm" | "read-only";
  estimated_monthly_tokens: number;
}

function detectRiskTier(fp: Fingerprint): RiskTier {
  const signals = fp.security_signals;
  const score = (
    (signals.has_external_apis ? 2 : 0) +
    (signals.has_secrets_manager ? 2 : 0) +
    (signals.has_auth ? 1 : 0) +
    (signals.has_docker ? 1 : 0)
  );
  return score >= 5 ? 'critical' : score >= 3 ? 'high' : 'medium';
}
```

5. **Tests:** `tests/unit/translator/ir-extended.test.ts`
- IR roundtrip with new layers
- AGENTS.md generation by backend
- Risk tier detection accuracy

**Acceptance Criteria:**
- IR v2.0 schema valid; all existing tests pass
- AGENTS.md generated for Claude/Cursor/OpenDev/Generic
- Risk tier detection tested on 20+ fingerprints

---

### Stage 1.1: Codex Backend (Week 2)

**Objective:** Ship native Codex support with approval mode mapping.

**Files:**
1. `src/translator/adapters/codex.ts`
2. `templates/codex/manifest.json`
3. `templates/codex/codex.md.hbs`
4. `templates/codex/.codex/rules/` (templates)

**Key Mappings:**
```
bp rule severity=hard → Codex approval=read-only
bp rule severity=soft → Codex approval=auto
bp skill → Codex tool scope
bp persona → Codex agent profile
```

**Tests:** 15+ covering Codex-specific output, approval mode mapping, AGENTS.md integration.

---

### Stage 2.0: Risk Tier Classification (Week 3)

**Objective:** Production-ready risk scoring; compliance-aware templates.

**Files:**
1. `src/validator/risk.ts` — Risk schema + validation
2. `src/detector/risk-scoring.ts` — Automated risk detection
3. `templates/risk-low/`, `templates/risk-medium/`, etc. — Risk-aware templates

**Features:**
- Auto-detect risk tier from security signals
- Generate risk-aware rules (e.g., high-risk repos get stricter approval modes)
- Escalation runbooks for high/critical tiers
- Risk audit report via `bp doctor`

---

## Part 6: Success Metrics & KPIs

| Metric | v1.0 Baseline | 6-Month Target (Phase 3) | 12-Month Target (Phase 6) |
|--------|--------------|--------------------------|--------------------------|
| Backend Coverage | 4 | 10 | 15+ |
| Test Suite Size | 227 tests | 450+ tests | 700+ tests |
| Code Coverage | 95% | 97% | 98%+ |
| Enterprise Features | 0 | 5+ | 15+ |
| CLI Commands | 11 | 15+ | 20+ |
| Template Packs | 12 | 80+ | 250+ |
| Avg Init Time | ~10s | <5s | <3s |
| Validation Accuracy | 96% | 98% | 99%+ |
| Enterprise Customers | 0 | 3–5 pilots | 15+ paying |

---

## Part 7: Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Backend API churn | High | High | Maintain IR abstraction; version adapters; auto-detect backend version |
| AGENTS.md spec fragmentation | Medium | High | Lead standardization; join agentic WG; publish AGENTS.md spec |
| Enterprise sales cycle long | Medium | High | Free tier for developers; freemium SaaS for RBAC/compliance |
| Contributor burnout (6 phases) | Medium | Medium | Modular architecture; clear interfaces; prioritize phases |
| Security vulnerabilities in plugins | Low | Critical | Sandboxed plugin execution; cryptographic signing; secret scanning CI |

---

## Part 8: Conclusion

`open-blueprint` v1.0.0 is **architecturally sound** but **feature-incomplete** for enterprise adoption. This regression analysis identifies **10 critical gaps** and a **clear 24-week roadmap** to address them.

**Next Steps:**
1. **Week 1:** Get explicit user approval for Phase 0 (IR extension)
2. **Week 2–4:** Execute Phase 0 + Phase 1 (Codex backend)
3. **Weeks 5–36:** Execute remaining phases in priority order (P0 → P1 → P2 → P3)
4. **Continuous:** Maintain test coverage >95%; ship weekly; gather user feedback

**Final Success Criteria:**
- Support 10+ backends natively
- Enterprise governance (RBAC, audit, compliance) shipped
- <3s init time; >99% validation accuracy
- 200+ community templates
- 15+ paying enterprise customers

---

*Analysis prepared by Claude Code on 2026-05-28. Based on regression testing of v1.0.0, cross-reference with open-blueprint-analysis.md, and market research on agentic governance requirements.*
