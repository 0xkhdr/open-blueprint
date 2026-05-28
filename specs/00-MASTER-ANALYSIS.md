# open-blueprint Master Regression Analysis
**Version:** 2.2 · **Date:** 2026-05-28 · **Target Model:** Claude Sonnet 4.6
**Status:** Production-Ready Implementation Roadmap — Aligned with Actual Repo State

---

## 1. Executive Summary

`open-blueprint` (bp) v1.0.0 has shipped with significant progress beyond the original spec expectations. This analysis reconciles the **actual repository state** (as of 2026-05-28) against both the original v2.0 specification and the post-1.0 regression audit to identify remaining gaps and produce an actionable, agent-distributed implementation plan.

**Key Finding:** The codebase is **far more advanced** than the regression analysis assumed. Many "missing" features are already partially or fully implemented. The spec must be updated to reflect reality and focus on **genuine gaps**.

---

## 2. Actual Repository State (Verified)

### 2.1 What's Already Implemented (✅)

| Component | Status | Evidence |
|-----------|--------|----------|
| **IR Schema v2.0** | ✅ Complete | `src/translator/ir.ts` — ALL 8 layers + enterprise + observability schemas |
| **10 Backend Adapters** | ✅ Complete | Claude, Cursor, Codex, PI, Kiro, Antigravity, Copilot, Gemini, OpenDev, Generic |
| **AGENTS.md Generator** | ✅ Complete | `src/translator/adapters/agents-md.ts` — universal output |
| **Risk Scoring** | ✅ Complete | `src/detector/index.ts` — `detectRiskTier()`, `detectApprovalMode()`, `estimateMonthlyTokens()` |
| **Enhanced Fingerprint** | ✅ Complete | `EnhancedFingerprint` interface with risk_tier, approval_mode, tokens |
| **Governance Validation** | ✅ Complete | `src/validator/index.ts` — Layer 5 `validateGovernance()` with all enterprise layers |
| **MCP Server Support** | ✅ Complete | `MCPServerSchema`, `ToolRegistryEntrySchema`, `generateMCPJson()` |
| **Agent Registry** | ✅ Complete | `AgentRegistrySchema`, `AgentRegistryEntrySchema` |
| **Orchestration** | ✅ Complete | `OrchestrationSchema` with teams, chains, persistent_memory, cross_agent_communication |
| **Telemetry** | ✅ Complete | `TelemetrySchema` with OpenTelemetry, Datadog, New Relic, CloudWatch |
| **Cost Tracking** | ✅ Complete | `CostSchema` with per-agent budgets, token tracking |
| **Metrics** | ✅ Complete | `MetricsSchema` with latency baselines, per-skill metrics |
| **Alerting** | ✅ Complete | `AlertingSchema` with policy violations, anomaly detection, notification channels |
| **Semantic Drift** | ✅ Complete | `SemanticDriftSchema` with behavioral analysis, rule effectiveness |
| **15 CLI Commands** | ✅ Complete | init, verify, sync, convert, dev, docs, diff, merge, template, doctor, rule, hook, config, update, migrate |
| **Interactive Wizard** | ✅ Complete | `interactiveWizard()` in `src/cli/commands/init.ts` |
| **Template Inheritance** | ✅ Complete | `runTemplater()` handles `.bp.json` `extends` with recursive resolution |
| **Incremental Validation Cache** | ✅ Complete | `loadCache()` / `saveCache()` in `src/validator/cache.ts` |
| **Audit Logging Hook** | ✅ Complete | `program.hook("preAction")` in `src/cli/index.ts` |
| **Security Signals** | ✅ Complete | `detectSecurity()` — auth, external APIs, secrets manager, docker |

### 2.2 What's Partially Implemented (⚠️)

| Component | Status | Gap |
|-----------|--------|-----|
| **LSP Server** | ⚠️ Dependencies only | `vscode-languageserver` in devDependencies but no `src/lsp/` implementation |
| **VS Code Extension** | ⚠️ Not started | No `editors/vscode/` directory |
| **Fuzz Testing** | ⚠️ Dependency only | `fast-check` in devDependencies but no fuzz test files |
| **Performance Benchmarks** | ⚠️ Not started | No benchmark suite |
| **CI/CD Actions** | ⚠️ Basic only | `.github/workflows/` may exist but no composite action |
| **Template Conditional Generation** | ⚠️ Not started | No `render_if` metadata in `.hbs` files |
| **Cross-Layer Reference Validation** | ⚠️ Partial | `validateOrchestrationSemantic()` exists but rule→skill refs not validated |
| **Hook Safety Validation** | ⚠️ Partial | `bp hook validate` command exists but implementation depth unknown |
| **Secret Scanning** | ⚠️ Not started | No post-generation secret scan |
| **Cost Dashboard** | ⚠️ Not started | Schema exists but no dashboard generator |
| **Semantic Drift Detection Engine** | ⚠️ Schema only | `SemanticDriftSchema` defined but no detection algorithm |
| **Anomaly Detection** | ⚠️ Schema only | `anomaly_detection` in `AlertingSchema` but no algorithm |
| **Migration Assistant** | ⚠️ Command only | `bp migrate` exists but feature parity checker unknown |
| **Dev Server Dashboard** | ⚠️ Command only | `bp dev` exists but dashboard implementation unknown |
| **Docs Generator** | ⚠️ Command only | `bp docs` exists but implementation depth unknown |
| **Diff/Merge** | ⚠️ Commands only | `bp diff`, `bp merge` exist but semantic diff engine unknown |
| **Marketplace v2** | ⚠️ Basic | `bp template list/install/publish` exist but no ratings/verified publishers |
| **Shared Rule Library** | ⚠️ Not started | No pre-built compliance rule packs |
| **SaaS Dashboard** | ⚠️ Not started | No cloud offering |

### 2.3 What's Genuinely Missing (❌)

| Component | Impact | Owner Domain |
|-----------|--------|--------------|
| **LSP Server Implementation** | 🔴 Critical | `09-PRODUCTION-HARDENING.md` |
| **VS Code Extension** | 🔴 Critical | `10-DEVELOPER-EXPERIENCE.md` |
| **Fuzz Testing Suite** | 🟠 High | `09-PRODUCTION-HARDENING.md` |
| **Performance Benchmark Suite** | 🟠 High | `09-PRODUCTION-HARDENING.md` |
| **Template Conditional Rendering** | 🟠 High | `05-TEMPLATER-ENHANCEMENT.md` |
| **Cross-Layer Reference Validator** | 🟠 High | `04-VALIDATOR-ENHANCEMENT.md` |
| **Secret Scanning (post-gen)** | 🟠 High | `06-ENTERPRISE-GOVERNANCE.md` |
| **Semantic Drift Detection Algorithm** | 🟠 High | `08-OBSERVABILITY-COST.md` |
| **Anomaly Detection Algorithm** | 🟠 High | `08-OBSERVABILITY-COST.md` |
| **Cost Dashboard Generator** | 🟡 Medium | `08-OBSERVABILITY-COST.md` |
| **Compliance Gap Report Generator** | 🟡 Medium | `06-ENTERPRISE-GOVERNANCE.md` |
| **Migration Feature Parity Checker** | 🟡 Medium | `10-DEVELOPER-EXPERIENCE.md` |
| **Dev Server Browser Dashboard** | 🟡 Medium | `10-DEVELOPER-EXPERIENCE.md` |
| **Docs Auto-Generator** | 🟡 Medium | `10-DEVELOPER-EXPERIENCE.md` |
| **Semantic Diff Engine** | 🟡 Medium | `11-ECOSYSTEM-SCALE.md` |
| **Marketplace Ratings/Verified Publishers** | 🟡 Medium | `11-ECOSYSTEM-SCALE.md` |
| **Shared Compliance Rule Packs** | 🟡 Medium | `11-ECOSYSTEM-SCALE.md` |
| **Enterprise Template Inheritance (deep merge)** | 🟡 Medium | `11-ECOSYSTEM-SCALE.md` |
| **SaaS Governance Dashboard** | 🟢 Low | `11-ECOSYSTEM-SCALE.md` |

---

## 3. Updated Gap Registry

### Critical Gaps (🔴)
| ID | Gap | File |
|----|-----|------|
| G-01 | LSP Server not implemented | `09-PRODUCTION-HARDENING.md` |
| G-02 | VS Code Extension not started | `10-DEVELOPER-EXPERIENCE.md` |
| G-03 | Fuzz testing suite missing | `09-PRODUCTION-HARDENING.md` |
| G-04 | Performance benchmarks missing | `09-PRODUCTION-HARDENING.md` |

### High Gaps (🟠)
| ID | Gap | File |
|----|-----|------|
| G-05 | Template conditional rendering | `05-TEMPLATER-ENHANCEMENT.md` |
| G-06 | Cross-layer reference validation | `04-VALIDATOR-ENHANCEMENT.md` |
| G-07 | Post-generation secret scanning | `06-ENTERPRISE-GOVERNANCE.md` |
| G-08 | Semantic drift detection algorithm | `08-OBSERVABILITY-COST.md` |
| G-09 | Anomaly detection algorithm | `08-OBSERVABILITY-COST.md` |

### Medium Gaps (🟡)
| ID | Gap | File |
|----|-----|------|
| G-10 | Cost dashboard generator | `08-OBSERVABILITY-COST.md` |
| G-11 | Compliance gap report | `06-ENTERPRISE-GOVERNANCE.md` |
| G-12 | Migration parity checker | `10-DEVELOPER-EXPERIENCE.md` |
| G-13 | Dev server browser dashboard | `10-DEVELOPER-EXPERIENCE.md` |
| G-14 | Docs auto-generator | `10-DEVELOPER-EXPERIENCE.md` |
| G-15 | Semantic diff engine | `11-ECOSYSTEM-SCALE.md` |
| G-16 | Marketplace ratings/verification | `11-ECOSYSTEM-SCALE.md` |
| G-17 | Shared compliance rule packs | `11-ECOSYSTEM-SCALE.md` |
| G-18 | Deep merge inheritance | `11-ECOSYSTEM-SCALE.md` |

---

## 4. Updated Domain Map

| Domain | Priority | Effort | Already Done | Remaining Work |
|--------|----------|--------|--------------|----------------|
| **01 IR Schema** | P0 | 0d | ✅ Complete | None — verify only |
| **02 Backend Expansion** | P0 | 2d | ✅ 10 adapters | Verify + polish |
| **03 Detector Enhancement** | P1 | 1d | ✅ Risk scoring | Verify + enterprise signals |
| **04 Validator Enhancement** | P1 | 4d | ⚠️ Governance layer | Cross-layer refs, performance audit |
| **05 Templater Enhancement** | P1 | 3d | ⚠️ Inheritance | Conditional rendering, risk-aware packs |
| **06 Enterprise Governance** | P1 | 5d | ⚠️ Validation | Secret scan, compliance gap report |
| **07 Multi-Agent & MCP** | P2 | 2d | ✅ Complete | Verify + CLI polish |
| **08 Observability & Cost** | P2 | 6d | ⚠️ Schemas only | Drift algo, anomaly detection, dashboard |
| **09 Production Hardening** | P2 | 10d | ❌ Missing | LSP, fuzz, benchmarks, CI/CD, security |
| **10 Developer Experience** | P3 | 8d | ⚠️ Wizard | VS Code ext, migration, dev server, docs |
| **11 Ecosystem & Scale** | P3 | 6d | ⚠️ Basic | Marketplace v2, rule packs, diff/merge |

---

## 5. Cross-Cutting Concerns (Updated)

### 5.1 IR Schema Status
The IR schema in `src/translator/ir.ts` is **already at v2.0** with all planned layers. Do NOT modify schemas unless adding new fields. Use existing types:
- `BlueprintIR` — full IR type
- `SettingsSchema`, `CommandSchema`, `MCPServerSchema` — Layers 6-8
- `IdentitySchema`, `AuditSchema`, `ComplianceSchema`, `RiskSchema` — Enterprise
- `AgentRegistrySchema`, `OrchestrationSchema` — Multi-agent
- `TelemetrySchema`, `CostSchema`, `MetricsSchema`, `AlertingSchema`, `SemanticDriftSchema` — Observability

### 5.2 Adapter Interface
All adapters implement `BlueprintAdapter` (not `BackendAdapter`):
```typescript
interface BlueprintAdapter {
  parse(projectRoot: string): Promise<BlueprintIR>;
  render(ir: BlueprintIR, projectRoot: string): Promise<string[]>;
}
```
Note: `render()` takes `projectRoot` as second arg (not returning `Record<string, string>`).

### 5.3 Exit Codes (Current)
Codes 0-10 are implemented. New codes 11-13 are reserved but not yet wired.

### 5.4 Testing Mandate
- Coverage target: **≥ 95%** per domain
- Use Vitest (already configured)
- Use `fast-check` for property-based tests
- Snapshot tests for template renders

---

## 6. File Structure

```
spec-v2/
├── 00-MASTER-ANALYSIS.md          ← You are here (updated)
├── 01-IR-SCHEMA-FOUNDATION.md     ← VERIFY ONLY — already implemented
├── 02-BACKEND-EXPANSION.md        ← VERIFY + POLISH — already implemented
├── 03-DETECTOR-ENHANCEMENT.md     ← VERIFY + ENTERPRISE SIGNALS
├── 04-VALIDATOR-ENHANCEMENT.md    ← CROSS-LAYER + PERFORMANCE AUDIT
├── 05-TEMPLATER-ENHANCEMENT.md    ← CONDITIONAL + RISK-AWARE
├── 06-ENTERPRISE-GOVERNANCE.md    ← SECRET SCAN + COMPLIANCE GAP
├── 07-MULTIAGENT-MCP.md           ← VERIFY + CLI POLISH
├── 08-OBSERVABILITY-COST.md       ← DRIFT ALGO + ANOMALY + DASHBOARD
├── 09-PRODUCTION-HARDENING.md     ← LSP + FUZZ + BENCHMARKS + SECURITY
├── 10-DEVELOPER-EXPERIENCE.md     ← VS CODE + MIGRATION + DEV SERVER + DOCS
├── 11-ECOSYSTEM-SCALE.md          ← MARKETPLACE V2 + RULE PACKS + DIFF/MERGE
└── 99-AGENT-INSTRUCTIONS.md       ← UPDATED instructions
```

---

## 7. Implementation Sequence (Updated)

```
Phase 0 (Week 1):     01, 02, 03, 07  (Verify already-implemented domains)
Phase 1 (Weeks 2-3):  04, 05, 06      (Validator, Templater, Enterprise gaps)
Phase 2 (Weeks 4-5):  08              (Observability algorithms + dashboard)
Phase 3 (Weeks 6-8):  09              (LSP, fuzz, benchmarks, security)
Phase 4 (Weeks 9-11): 10              (VS Code, migration, dev server, docs)
Phase 5 (Weeks 12-14): 11             (Marketplace, rule packs, diff/merge)
```

---

## 8. Success Criteria (v2.0 Final — Updated)

- [ ] `bun test --coverage` ≥ 95% (target: 300+ tests)
- [ ] `biome check src/ templates/` exits 0
- [ ] `bun run build` produces binary < 50MB
- [ ] 10 backends generate valid output + AGENTS.md
- [ ] IR v2.0 round-trip fidelity ≥ 98%
- [ ] Risk tier classification ≥ 90% accuracy
- [ ] Cross-layer reference validation catches broken refs
- [ ] Template conditional rendering works
- [ ] Secret scan detects API keys, JWTs, private keys
- [ ] Semantic drift detection ≥ 85% accuracy
- [ ] Anomaly detection (z-score) catches deviations
- [ ] Cost dashboard generated as markdown
- [ ] `bp init` < 3s on 1,000-file repo, < 8s on 10,000-file repo
- [ ] LSP server provides diagnostics, hover, go-to-definition
- [ ] VS Code extension published with live linting
- [ ] Fuzz tests: 1000 runs, zero panics
- [ ] Zero high-severity Snyk/CodeQL findings
- [ ] A new contributor can `git clone` → `bun install` → `bun test` in < 5 min

---

*Master Analysis · open-blueprint v2.0 · Repo-Aligned · 2026-05-28*
