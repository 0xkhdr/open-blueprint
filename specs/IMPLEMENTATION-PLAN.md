# open-blueprint Agent Implementation Plan
**Version:** 1.0 · **Date:** 2026-05-28 · **Model:** Claude Sonnet 4.6
**Purpose:** Sequential agent execution guide — work through all 11 domains in order

---

## How to Use This Plan

You are a Claude agent implementing `open-blueprint` v2.0. Work through each domain
**in the numbered order below**. Each domain has a dependency on prior ones — do not
skip ahead. For every domain:

1. Read the full spec file listed under **Spec File**
2. Check current state by reading the listed **Key Files to Inspect**
3. Implement exactly what is listed under **Your Tasks** — no more, no less
4. Run the listed **Verification Commands** — all must pass before proceeding
5. Mark the domain complete and move to the next

**Hard rules (never violate):**
- Never modify `src/translator/ir.ts` schemas unless the task explicitly says to add a field
- Always use `BlueprintAdapter` interface — `render(ir, projectRoot): Promise<string[]>`
- Every new CLI command must support `--json` and `--dry-run`
- Every write operation must use `safeOutputPath()` from `src/security/path-traversal.ts` (once created)
- Tests alongside implementation — never defer
- `biome check --apply src/` and `npm run typecheck` must exit 0 before each commit
- Conventional commit format: `feat(domain): description`

**Tooling:**
```
bun test                        # run tests
bun test --coverage             # with coverage
npm run typecheck               # or: tsc --noEmit
biome check --apply src/        # lint + format
bun build --compile src/cli/index.ts --outfile bp  # build binary
```

---

## Domain Execution Sequence

```
01 (IR Verify)     → no deps
02 (Backends)      → depends on 01
03 (Detector)      → depends on 01
04 (Validator)     → depends on 01, 03
05 (Templater)     → depends on 01, 03
06 (Enterprise)    → depends on 01, 03, 04, 05
07 (MultiAgent)    → depends on 01, 03, 04
08 (Observability) → depends on 01, 06, 07
09 (Hardening)     → depends on 01-08
10 (DX)            → depends on 09
11 (Ecosystem)     → depends on 01-10
```

---

## Domain 01 — IR Schema Foundation

**Spec File:** `specs/01-IR-SCHEMA-FOUNDATION.md`
**Status:** ✅ COMPLETE — all tasks implemented and verified
**Effort:** ~2h
**Commit:** `feat(ir): verify and export all v2.0 types`

### What Is Already Done
`src/translator/ir.ts` has full IR v2.0 — all 8 layers plus enterprise, multi-agent,
observability schemas. Do NOT rewrite.

### Key Files to Inspect
- `src/translator/ir.ts` — main schema file
- `src/translator/index.ts` — adapter registry + `BlueprintAdapter` interface
- `src/translator/adapters/agents-md.ts` — AGENTS.md generator

### Your Tasks

**1.1 — Export audit**
Grep `src/translator/ir.ts` for every `Schema`. For each one, check there is a
corresponding `export type X = z.infer<typeof XSchema>`. Missing types to check:
`Settings`, `Command`, `MCPServer`, `ToolRegistryEntry`, `Identity`, `Audit`,
`Compliance`, `Risk`, `CrossAgentCommunication`, `AgentRegistryEntry`,
`AgentRegistry`, `Registry`, `Orchestration`, `Telemetry`, `Cost`, `Metrics`,
`Alerting`, `SemanticDrift`. Add any missing type exports.

**1.2 — Schema version field**
Check `MetaSchema`. If `schema_version` field is missing, add:
```typescript
schema_version: z.enum(["1.0", "2.0"]).default("2.0").optional()
```

**1.3 — Skill schema field**
Check `SkillSchema`. If `disable_model_invocation` is missing, add:
```typescript
disable_model_invocation: z.boolean().optional()
```

**1.4 — Backward compat type guards**
If `isV1()` / `isV2()` type guards do not exist in `src/translator/ir.ts`, add:
```typescript
export function isV2(ir: BlueprintIR): boolean {
  return ir.meta?.schema_version === "2.0" || ir.settings !== undefined || ir.mcp_servers !== undefined;
}
export function isV1(ir: BlueprintIR): boolean {
  return !isV2(ir);
}
```

**1.5 — Tests**
Create `tests/unit/ir/exports.test.ts`:
- Import every exported type and assert it is not undefined
- Validate a minimal v1.0 IR object passes `BlueprintIRSchema`
- Validate a full v2.0 IR object passes `BlueprintIRSchema`
- Assert `isV2()` returns true for v2.0 fixture, false for v1.0

### Verification Commands
```
npm run typecheck      # must exit 0
bun test               # no regressions
```

### Done Criteria
- [x] All 18 types explicitly exported
- [x] `schema_version` and `disable_model_invocation` present (or confirmed present)
- [x] `isV1()` / `isV2()` exported from `src/translator/ir.ts`
- [x] Tests pass, no typecheck errors

---

## Domain 02 — Backend Expansion

**Spec File:** `specs/02-BACKEND-EXPANSION.md`
**Status:** ✅ COMPLETE — all 10 adapters verified, opendev created, copilot path fixed, round-trip tests added
**Effort:** ~4h
**Commit:** `feat(backends): add opendev adapter, fix copilot path, round-trip tests, parity matrix`

### Key Files to Inspect
- `src/translator/adapters/` — all 10 adapter files
- `templates/` — each backend's template directory
- `src/translator/adapters/agents-md.ts`

### Your Tasks

**2.1 — Adapter interface audit**
For each adapter (claude, cursor, codex, pi, kiro, antigravity, copilot, gemini,
opendev, generic): verify `parse()` returns `Promise<BlueprintIR>` and `render()`
signature is `render(ir: BlueprintIR, projectRoot: string): Promise<string[]>`.
Fix any that have wrong signature.

**2.2 — AGENTS.md generation**
For adapters marked ⚠️ in the spec (pi, kiro, antigravity, copilot, gemini, opendev,
generic): verify `generateAgentsMD(ir)` is called inside `render()` and the output
is written as `AGENTS.md` in the project root. Add the call if missing.

**2.3 — Cursor hooks field**
Confirm cursor adapter returns `hooks: []` (cursor doesn't support hooks). Fix if
not set.

**2.4 — Copilot path**
Confirm copilot adapter writes to `.github/copilot/instructions.md`. Fix if wrong.

**2.5 — Round-trip tests**
Create `tests/integration/backends/round-trip.test.ts`:
- `claude → cursor → claude`: assert rules.length and skills.length match (fidelity ≥ 95%)
- `claude → codex → claude`: same assertion
- `cursor → generic → cursor`: same assertion
- Use fixture from `tests/fixtures/node-express/` (create minimal fixture if missing)

**2.6 — Feature parity matrix**
Create `docs/backend-parity.md` with the table from spec section 2.5. Fill all `?`
by reading each adapter's render() and checking what layers it outputs.

### Verification Commands
```
npm run typecheck
bun test tests/integration/backends/
```

### Done Criteria
- [x] All 10 adapters pass typecheck with correct interface
- [x] All 10 adapters call `generateAgentsMD()` in render()
- [x] Round-trip tests pass for 3 backend pairs
- [x] `docs/backend-parity.md` published with no `?` cells

---

## Domain 03 — Detector Enhancement

**Spec File:** `specs/03-DETECTOR-ENHANCEMENT.md`
**Status:** ✅ COMPLETE — enterprise signals, 4 new risk signals, 33 new tests
**Effort:** ~3h
**Commit:** `feat(detector): add enterprise signal detection`

### Key Files to Inspect
- `src/detector/index.ts` — `EnhancedFingerprint`, `enrichFingerprint()`
- `src/detector/fingerprint.ts` — `FingerprintSchema` (if exists)

### Your Tasks

**3.1 — Create enterprise signals module**
Create `src/detector/enterprise-signals.ts` with exact implementation from spec
Task 3.1: `EnterpriseSignals` interface + `detectEnterpriseSignals()` function with
`detectRBAC()`, `detectComplianceDocs()`, `detectAuditLogging()`, `detectDLPScanner()`
helpers. Use `globSync` from fast-glob (already in deps).

**3.2 — Wire into EnhancedFingerprint**
In `src/detector/index.ts`:
- Add `enterprise_signals: EnterpriseSignals` to `EnhancedFingerprint` interface
- Call `detectEnterpriseSignals(root)` inside `enrichFingerprint()`
- Assign result to `enterprise_signals` on returned object

**3.3 — Additional risk signals**
In `detectRiskTier()` (or wherever risk scoring lives), add 4 missing signals:
- `has_data_sensitive` — check for `crypto`, `bcrypt`, `hash` in deps
- `has_financial_data` — check for `stripe`, `paypal` in deps
- `has_pii` — check for GDPR/HIPAA file references or email regex patterns in src
- `has_encryption` — check for `tls`, `ssl`, `cipher` keywords

**3.4 — Tests**
Create `tests/unit/detector/enterprise-signals.test.ts`:
- Mock a repo with auth0.config → `has_rbac_config: true`
- Mock a repo with GDPR.md → `has_compliance_docs: true`
- Mock a repo with pino in package.json → `has_audit_logging: true`
- Mock .pre-commit-config.yaml with gitleaks → `has_dlp_scanner: true`
- Test all 4 new risk signals with controlled inputs
- Test approval mode inference for all 4 risk tiers

### Verification Commands
```
npm run typecheck
bun test tests/unit/detector/
```

### Done Criteria
- [x] `EnterpriseSignals` exported from `src/detector/enterprise-signals.ts`
- [x] `EnhancedFingerprint.enterprise_signals` populated in `enrichFingerprint()`
- [x] 4 additional risk signals in scoring
- [x] 33 new tests passing (129 total in detector suite)

---

## Domain 04 — Validator Enhancement

**Spec File:** `specs/04-VALIDATOR-ENHANCEMENT.md`
**Status:** ✅ COMPLETE — cross-layer refs, layer 6-8 deep validation, perf audit, 63 new tests
**Effort:** ~6h
**Commit:** `feat(validator): add cross-layer refs, layer 6-8 deep validation, perf audit`

### Key Files to Inspect
- `src/validator/index.ts` — main validator pipeline
- `src/validator/` — existing layer files

### Your Tasks

**4.1 — Cross-layer reference validator**
Create `src/validator/cross-layer.ts` with exact implementation from spec Task 4.1:
- `validateCrossLayerReferences(ir, blueprintFile): ValidationError[]`
- Validates: rule→skill refs, agent→tool refs, skill→command refs
- Use regex extractors `extractSkillRefs()` and `extractCommandRefs()` from spec

**4.2 — Layer 6-8 deep validators**
Create `src/validator/layers-deep.ts` with exact implementation from spec Task 4.2:
- `validateSettingsDeep(ir, file): ValidationError[]` — approval_mode vs risk_tier, budget > 0
- `validateCommandsDeep(ir, file): ValidationError[]` — duplicate command names
- `validateMCPServersDeep(ir, file): ValidationError[]` — risk mismatch, missing auth

**4.3 — Performance auditor**
Create `src/validator/performance.ts` with exact implementation from spec Task 4.3:
- `auditPerformance(ir, file): PerformanceAuditResult`
- Warns on >1000 total glob patterns, >100 rules, >50 agents in registry
- Returns `metrics` with `total_glob_patterns`, `total_rules`, `estimated_validation_time_ms`

**4.4 — Wire into main validator**
In `src/validator/index.ts`:
- Import and call `validateCrossLayerReferences()` in the governance/semantic layer
- Import and call `validateSettingsDeep()`, `validateCommandsDeep()`, `validateMCPServersDeep()`
- Import and call `auditPerformance()` and include warnings in result
- Add new error type codes to `exitCodeForResult()` map (or equivalent)
- Ensure new errors are collected (not short-circuit) — use array push pattern

**4.5 — Tests**
- `tests/unit/validator/cross-layer.test.ts` — 20+ tests covering each ref type
- `tests/unit/validator/layers-deep.test.ts` — 15+ tests for settings/commands/MCP
- `tests/unit/validator/performance.test.ts` — 10+ tests with over/under thresholds

### Verification Commands
```
npm run typecheck
bun test tests/unit/validator/
```

### Done Criteria
- [x] `validateCrossLayerReferences` in pipeline, catches broken rule→skill refs
- [x] Settings approval_mode vs risk_tier mismatch flagged as warning
- [x] Duplicate command names flagged as error
- [x] MCP auth missing for high-risk tools flagged as warning
- [x] Performance audit warns at thresholds
- [x] 63 new tests passing, no regressions in existing tests (689 total)

---

## Domain 05 — Templater Enhancement

**Spec File:** `specs/05-TEMPLATER-ENHANCEMENT.md`
**Status:** ✅ COMPLETE — metadata system, conditional rendering, risk-aware packs, 59 new tests
**Effort:** ~5h
**Commit:** `feat(templater): conditional rendering, risk-aware packs, template metadata`

### Key Files to Inspect
- `src/templater/index.ts` — main templater
- `src/templater/selector.ts` — template selection logic
- `templates/` — existing template directories

### Your Tasks

**5.1 — Template metadata system**
Create `src/templater/metadata.ts` with exact implementation from spec Task 5.1:
- `TemplateMetadata` interface with `render_if`, `inherit_from`, `layers`, `priority`
- `parseTemplateMetadata(templatePath): TemplateMetadata` — reads YAML frontmatter
- `stripMetadata(content): string` — removes frontmatter before rendering
- Use the `yaml` package for parsing (add to deps if missing: `bun add yaml`)

**5.2 — Conditional rendering engine**
Create `src/templater/conditional.ts` with exact implementation from spec Task 5.2:
- `RenderContext` interface
- `shouldRenderTemplate(meta, context): { render: boolean; reason?: string }`
- Checks: risk_tier, backend_features, languages, frameworks, project_types, min_bp_version

**5.3 — Risk-aware template directories**
Create empty placeholder files (the render engine will populate them dynamically):
```
templates/_base/risk-low/rules-minimal.md.hbs
templates/_base/risk-medium/rules-standard.md.hbs
templates/_base/risk-high/rules-strict.md.hbs
templates/_base/risk-high/escalation.md.hbs
templates/_base/risk-critical/rules-maximum.md.hbs
templates/_base/risk-critical/escalation.md.hbs
templates/_base/risk-critical/compliance-checklist.md.hbs
```
Each file should have a frontmatter declaring its `render_if.risk_tier` constraint
and minimal Handlebars content appropriate to the risk level.

**5.4 — Risk selector**
Create `src/templater/risk-selector.ts` with exact implementation from spec Task 5.3:
- `resolveRiskTemplatePack(basePackDir, riskTier): string | undefined`
- `mergeRiskTemplates(baseFiles, riskFiles): string[]`

**5.5 — Wire into main templater**
Update `src/templater/index.ts`:
- Before rendering each `.hbs` file: call `parseTemplateMetadata()` and
  `shouldRenderTemplate()`. Skip (log if --verbose) if `render: false`.
- Build `RenderContext` from fingerprint's risk_tier, primary_language, etc.
- After resolving base templates, call `mergeRiskTemplates()` to overlay risk pack
- Add `--verbose` logging for skipped templates when flag is set

**5.6 — Update one example template**
Update `templates/claude/rules/02-security.md.hbs` (or create if missing) to include
YAML frontmatter with `render_if.risk_tier: ["medium", "high", "critical"]` as shown
in spec Task 5.6.

**5.7 — Tests**
- `tests/unit/templater/metadata.test.ts` — parse frontmatter, strip metadata (10+ tests)
- `tests/unit/templater/conditional.test.ts` — shouldRenderTemplate all conditions (15+ tests)
- `tests/unit/templater/risk-selector.test.ts` — pack selection + merging (10+ tests)
- `tests/integration/templater/risk-aware.test.ts` — render critical project, confirm
  stricter rules appear; render low project, confirm minimal rules (5+ tests)

### Verification Commands
```
npm run typecheck
bun test tests/unit/templater/ tests/integration/templater/
```

### Done Criteria
- [x] Templates with `render_if` conditions are correctly skipped
- [x] Risk-aware templates produce different output for low vs critical
- [x] Template inheritance chain resolves (base → override)
- [x] `--verbose` logs skipped templates
- [x] 59 new tests passing (94 total in templater suite)

---

## Domain 06 — Enterprise Governance

**Spec File:** `specs/06-ENTERPRISE-GOVERNANCE.md`
**Status:** ✅ COMPLETE — secrets scan, compliance gap report, escalation runbooks, enhanced bp doctor, 84 tests
**Effort:** ~7h
**Commit:** `feat(enterprise): secret scanning, compliance gap report, escalation runbooks`

### Key Files to Inspect
- `src/validator/index.ts` — existing `validateGovernance()`
- `src/cli/commands/doctor.ts` — may exist, may need creation

### Your Tasks

**6.1 — Secret scanning engine**
Create `src/enterprise/secrets.ts` with exact implementation from spec Task 6.1:
- `SECRET_PATTERNS` array with 8 patterns (AWS key, secret, GitHub PAT, JWT, private
  key, Slack token, generic API key, DB connection string)
- `SecretFinding` interface
- `scanForSecrets(projectRoot): SecretFinding[]`
- `collectTextFiles(root): string[]` — skips node_modules, .git, dist; text extensions only

**6.2 — .env.template generator**
Create `src/enterprise/env-template.ts` with exact implementation from spec Task 6.2:
- `generateEnvTemplate(projectRoot): string`
- `detectEnvVariables(root): EnvVariable[]` — scans for `process.env.X` references
- `inferDescription(key): string` — maps common keys to descriptions

**6.3 — Compliance gap report**
Create `src/enterprise/compliance-report.ts` with exact implementation from spec Task 6.3:
- `GapReport` interface with `framework`, `coverage_percent`, `gaps`, `summary`
- `generateGapReport(ir, framework): GapReport`
- `getFrameworkControls(framework)` — returns controls for gdpr, soc2, hipaa

**6.4 — Escalation runbook generator**
Create `src/enterprise/runbooks.ts` with exact implementation from spec Task 6.5:
- `generateEscalationRunbook(ir): string`
- Risk-tier-specific escalation matrix (critical/high/medium tiers)

**6.5 — Enhanced `bp doctor`**
Read `src/cli/commands/doctor.ts`. If it doesn't exist, create it. Add or update:
- `--secret-scan` flag → calls `scanForSecrets()`, prints findings
- `--compliance-report [framework]` flag → calls `generateGapReport()`, prints report
- `--risk-audit` flag → prints risk tier + calls `generateEscalationRunbook()`
- `--env-template` flag → calls `generateEnvTemplate()`, writes `.env.template`
- Register all new flags in `src/cli/index.ts` if not already registered

**6.6 — Tests**
- `tests/unit/enterprise/secrets.test.ts` — 20+ tests (each pattern, false positive rate)
- `tests/unit/enterprise/compliance-report.test.ts` — GDPR/SOC2/HIPAA coverage (15+ tests)
- `tests/unit/enterprise/env-template.test.ts` — env var detection (10+ tests)
- `tests/unit/enterprise/runbooks.test.ts` — runbook generation per tier (5+ tests)

### Verification Commands
```
npm run typecheck
bun test tests/unit/enterprise/
```

### Done Criteria
- [x] `scanForSecrets()` detects all 8 pattern types
- [x] `generateGapReport()` produces correct coverage % for GDPR, SOC2, HIPAA
- [x] `bp doctor --secret-scan` outputs findings
- [x] `bp doctor --compliance-report gdpr` outputs gap report
- [x] Escalation runbook varies by risk tier
- [x] 84 tests passing (exceeds 50+ target)

---

## Domain 07 — Multi-Agent Orchestration & MCP

**Spec File:** `specs/07-MULTIAGENT-MCP.md`
**Status:** ✅ MOSTLY COMPLETE — verify CLI commands exist and work; add missing ones
**Effort:** ~4h
**Commit:** `feat(multiagent): wire CLI commands, add chain DAG validation, memory governance`

### Key Files to Inspect
- `src/cli/commands/` — check for agent.ts, mcp.ts, team.ts, chain.ts, memory.ts
- `src/multiagent/` — check for mcp-governance.ts, chains.ts, memory.ts

### Your Tasks

**7.1 — CLI command audit**
Check each of these files: `src/cli/commands/agent.ts`, `mcp.ts`, `team.ts`,
`chain.ts`, `memory.ts`. For any that are missing, create them with the commands
listed in spec Task 7.1. Each command must support `--json` output.

**7.2 — MCP risk scoring**
Check `src/multiagent/mcp-governance.ts` (or equivalent). If `scoreMCPServer()`
does not exist, create it with exact implementation from spec Task 7.2.

**7.3 — Chain DAG validation**
Check `src/multiagent/chains.ts` (or equivalent). If `validateChainDAG()` does not
exist, create it with exact implementation from spec Task 7.4 (DFS cycle detection).

**7.4 — Memory governance**
Check `src/multiagent/memory.ts` (or equivalent). If `enforceMemoryGovernance()`
does not exist, create it with exact implementation from spec Task 7.5.

**7.5 — Tests**
- `tests/unit/multiagent/mcp-governance.test.ts` — 15+ tests for risk scoring
- `tests/unit/multiagent/chain-dag.test.ts` — 15+ tests including cycle detection
- `tests/unit/multiagent/memory-governance.test.ts` — 10+ tests for size/retention

### Verification Commands
```
npm run typecheck
bun test tests/unit/multiagent/
```

### Done Criteria
- [ ] `bp agent list`, `bp mcp validate`, `bp team validate`, `bp chain validate`,
  `bp memory audit` all functional
- [ ] `scoreMCPServer()` returns correct tier
- [ ] `validateChainDAG()` catches circular dependencies
- [ ] `enforceMemoryGovernance()` reports size + retention violations
- [ ] 50+ tests passing

---

## Domain 08 — Observability & Cost Governance

**Spec File:** `specs/08-OBSERVABILITY-COST.md`
**Status:** ⚠️ SCHEMAS ONLY — algorithms + dashboard + CLI missing
**Effort:** ~8h
**Commit:** `feat(observability): drift detection, anomaly detection, cost dashboard, alert engine`

### Key Files to Inspect
- `src/validator/index.ts` — existing `validateCostConfig()`, `validateAlertingConfig()`
- `src/cli/commands/` — check for telemetry.ts, cost.ts, drift.ts, metrics.ts, alert.ts

### Your Tasks

**8.1 — Semantic drift detection algorithm**
Create `src/observability/semantic-drift.ts` with exact implementation from spec Task 8.1:
- `BehaviorBaseline` and `DriftReport` interfaces
- `establishBaseline(metrics, windowDays): BehaviorBaseline`
- `detectSemanticDrift(baseline, current, threshold): DriftReport`
- Detects: rule_effectiveness, token_inflation, skill_degradation

**8.2 — Anomaly detection algorithm**
Create `src/observability/anomaly.ts` with exact implementation from spec Task 8.2:
- `Anomaly` and `PerformanceBaseline` interfaces
- `establishPerformanceBaseline(metrics, windowDays): PerformanceBaseline`
- `detectAnomalies(current, baseline, zThreshold): Anomaly[]`
- Z-score based detection; severity "critical" when zScore > threshold * 1.5

**8.3 — Cost dashboard generator**
Create `src/observability/dashboard.ts` with exact implementation from spec Task 8.3:
- `generateCostDashboard(ir): string` — outputs markdown with progress bar, per-agent
  table, per-rule table, budget alerts

**8.4 — Telemetry auto-detection**
Create `src/observability/telemetry-detect.ts` with exact implementation from spec Task 8.4:
- `detectTelemetryPlatform(projectRoot): TelemetryPlatform | undefined`
- Checks package.json deps, config files, env vars

**8.5 — Alert rule engine**
Create `src/observability/alerts.ts` with exact implementation from spec Task 8.5:
- `AlertEvent` interface
- `evaluateAlertRules(alerting, metrics): AlertEvent[]`
- `formatAlertForChannel(event, channel): string` — slack, pagerduty, email

**8.6 — CLI commands**
Create any missing files in `src/cli/commands/`:
- `telemetry.ts` — `bp telemetry init`, `bp telemetry detect`
- `cost.ts` — `bp cost report`, `bp cost budget`
- `drift.ts` — `bp drift semantic`, `bp drift baseline`
- Register all new commands in `src/cli/index.ts`

**8.7 — Tests**
- `tests/unit/observability/semantic-drift.test.ts` — 25+ tests (baseline, drift types, thresholds)
- `tests/unit/observability/anomaly.test.ts` — 20+ tests (z-score, severity thresholds)
- `tests/unit/observability/dashboard.test.ts` — 15+ tests (progress bar, budget alert)
- `tests/unit/observability/alerts.test.ts` — 20+ tests (policy violation, budget overrun, formatting)

### Verification Commands
```
npm run typecheck
bun test tests/unit/observability/
```

### Done Criteria
- [ ] `detectSemanticDrift()` identifies rule_effectiveness and token_inflation drifts
- [ ] `detectAnomalies()` catches z-score > 3 deviations
- [ ] `generateCostDashboard()` produces markdown with ASCII progress bar
- [ ] `detectTelemetryPlatform()` identifies opentelemetry/datadog/newrelic
- [ ] Alert engine evaluates conditions and formats for slack/pagerduty/email
- [ ] 80+ tests passing

---

## Domain 09 — Production Hardening

**Spec File:** `specs/09-PRODUCTION-HARDENING.md`
**Status:** ❌ NOT STARTED — largest gap
**Effort:** ~14h
**Commit:** `feat(hardening): LSP server, security modules, fuzz tests, benchmarks, CI action`

### Key Files to Inspect
- `src/lsp/` — likely does not exist
- `src/security/` — may exist, check depth
- `editors/vscode/` — likely does not exist
- `tests/fuzz/` — likely does not exist

### Your Tasks

**9.1 — Security modules (do these first — others depend on them)**

Create `src/security/path-traversal.ts`:
```typescript
import * as path from "node:path";

export function safeOutputPath(requestedPath: string, projectRoot: string): string {
  const resolved = path.resolve(projectRoot, requestedPath);
  const rootResolved = path.resolve(projectRoot);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    throw new Error(
      `Path traversal detected: ${requestedPath} resolves to ${resolved} outside ${rootResolved}`
    );
  }
  return resolved;
}
```

Create `src/security/hook-validator.ts` with exact implementation from spec Task 9.5:
- `FORBIDDEN_PATTERNS` array (8 patterns: child_process, fs, fetch, eval, Function, process.env, exec, spawn)
- `validateHookSafety(code): HookSafetyReport`

Create `src/security/sandbox.ts` with `deepFreeze<T>(obj: T): T`.

**9.2 — LSP server**
Create `src/lsp/server.ts` with exact implementation from spec Task 9.1:
- Uses `vscode-languageserver/node` (already in devDeps)
- Provides: diagnostics (on change), completion (trigger chars `:`, `-`, ` `),
  hover (severity docs), code actions (fix MISSING_REQUIRED_FIELD, SEVERITY_CONFLICT)
- Calls `validateBlueprint()` from `src/validator/index.ts`

**9.3 — VS Code extension**
Create `editors/vscode/` directory with:
- `package.json` from spec Task 9.2 (name: blueprint-lsp, activates on .claude/rules/*.md etc.)
- `src/extension.ts` from spec Task 9.2 — LanguageClient wrapping the LSP server
- `tsconfig.json` for the extension
NOTE: Do not attempt to publish to marketplace — just create the files.

**9.4 — Fuzz testing suite**
Create `tests/fuzz/repo-generator.ts` with exact implementation from spec Task 9.3.
Create `tests/fuzz/invariants.test.ts` with 3 property tests:
- `bp init` never panics (1000 runs)
- `bp verify` never hangs (500 runs)
- Output paths always within project root (200 runs)
Use `fast-check` (already in devDeps).

**9.5 — Performance benchmarks**
Create `tests/performance/init.bench.ts` with exact implementation from spec Task 9.4:
- Bench `bp init` on 1K, 5K, 10K file repos
- Assert: 1K < 2s, 10K < 8s

**9.6 — CI/CD action**
Create `.github/actions/verify/action.yml` with exact content from spec Task 9.6.

**9.7 — Tests**
- `tests/unit/security/path-traversal.test.ts` — 10+ tests (within root, escape attempts)
- `tests/unit/security/hook-validator.test.ts` — test all 8 forbidden patterns (10+ tests)

### Verification Commands
```
npm run typecheck
bun test tests/unit/security/
bun test tests/fuzz/ --timeout 120000
```

### Done Criteria
- [ ] `safeOutputPath()` throws on path traversal, passes on valid paths
- [ ] `validateHookSafety()` catches all 8 forbidden patterns
- [ ] `deepFreeze()` makes objects immutable
- [ ] `src/lsp/server.ts` compiles without errors
- [ ] `editors/vscode/` contains package.json and extension.ts
- [ ] Fuzz tests run 1000 iterations without panic
- [ ] Benchmark files exist and can run
- [ ] GitHub Action YAML is valid
- [ ] 100+ tests passing

---

## Domain 10 — Developer Experience

**Spec File:** `specs/10-DEVELOPER-EXPERIENCE.md`
**Status:** ⚠️ PARTIAL — wizard done, migration + dev server + docs + VS Code tree missing
**Effort:** ~8h
**Commit:** `feat(dx): migration assistant, dev server dashboard, docs generator, VS Code tree view`

### Key Files to Inspect
- `src/cli/commands/migrate.ts` — existing `bp migrate`
- `src/cli/commands/dev.ts` — existing `bp dev`
- `src/cli/commands/docs.ts` — existing `bp docs`
- `editors/vscode/src/extension.ts` — from Domain 09

### Your Tasks

**10.1 — VS Code tree view**
Create `editors/vscode/src/tree-view.ts` with exact implementation from spec Task 10.1:
- `BlueprintTreeProvider` implementing `vscode.TreeDataProvider<BlueprintItem>`
- Shows: Rules (files in .claude/rules/), Skills, Agents — each opens on click
- `BlueprintItem` class

Update `editors/vscode/src/extension.ts` to register the tree data provider under
the `blueprintExplorer` view ID, and add `blueprint.refreshExplorer` command.

**10.2 — Migration assistant**
Create `src/dx/migrate.ts` with exact implementation from spec Task 10.2:
- `FEATURE_MATRIX` — 9 backends × 9 features
- `MigrationPlan` and `FeatureParity` interfaces
- `generateMigrationPlan(sourceDir, from, to): Promise<MigrationPlan>`
- `generateMigrationReport(plan): string`
- Path helpers: `getTargetRulesPath()`, `getTargetSkillsPath()`, `getTargetAgentsPath()`

Update `src/cli/commands/migrate.ts` to use `generateMigrationPlan()` and print the
report. Add `--report` flag to write markdown file. Add `--json` flag.

**10.3 — Dev server browser dashboard**
Create `src/dx/dev-server.ts` with exact implementation from spec Task 10.3:
- `DevServerState` interface
- `startDevServer(projectRoot, port): Promise<void>` using Bun's `serve()`
- Routes: `/` (HTML dashboard), `/api/state`, `/api/validate`
- File watcher using chokidar (add if missing: `bun add chokidar`)
- `renderDashboard(state): string` — dark-themed HTML with CSS grid cards

Update `src/cli/commands/dev.ts` to call `startDevServer()` with `--port` option
(default 3456).

**10.4 — Documentation generator**
Create `src/dx/docs.ts` with exact implementation from spec Task 10.4:
- `generateDocs(projectRoot): Promise<string>`
- `generateMarkdownDocs(ir): string` — 9 sections: overview, risk, agents, rules,
  skills, compliance, settings, MCP servers, audit

Update `src/cli/commands/docs.ts` to call `generateDocs()`. Add `--output` flag.

**10.5 — Tests**
- `tests/unit/dx/migrate.test.ts` — feature parity matrix accuracy, report generation (20+ tests)
- `tests/unit/dx/docs.test.ts` — docs generation for full IR, empty IR (10+ tests)
- `tests/unit/dx/dev-server.test.ts` — `revalidate()`, `renderDashboard()` output (10+ tests)

### Verification Commands
```
npm run typecheck
bun test tests/unit/dx/
```

### Done Criteria
- [ ] VS Code tree view shows rules/skills/agents (TreeDataProvider compiles)
- [ ] `generateMigrationPlan()` returns correct feature gaps for all 10 backends
- [ ] `bp migrate --from claude --to cursor` prints readable report with confidence scores
- [ ] `bp dev --port 3456` serves HTML dashboard
- [ ] `bp docs generate` outputs markdown with all 9 sections
- [ ] 60+ tests passing

---

## Domain 11 — Ecosystem & Scale

**Spec File:** `specs/11-ECOSYSTEM-SCALE.md`
**Status:** ⚠️ PARTIAL — basic registry done, marketplace v2 + rule packs + diff/merge missing
**Effort:** ~8h
**Commit:** `feat(ecosystem): marketplace v2, shared rule packs, semantic diff/merge, deep inheritance`

### Key Files to Inspect
- `src/cli/commands/template.ts` — existing `bp template` commands
- `src/ecosystem/` — likely does not exist

### Your Tasks

**11.1 — Marketplace v2**
Create `src/ecosystem/marketplace-v2.ts` with exact implementation from spec Task 11.1:
- `MarketplaceTemplate`, `MarketplaceRating`, `MarketplaceSearchResult` interfaces
- `searchMarketplace(query, filters): Promise<MarketplaceSearchResult>`
- `rateTemplate(name, rating, comment, authToken): Promise<void>`
- `getTemplateRatings(name): Promise<MarketplaceRating[]>`

Add `bp marketplace search [query]` and `bp marketplace rate <name>` CLI commands.

**11.2 — Shared rule library (GDPR, SOC2, HIPAA)**
Create `src/ecosystem/rule-library.ts` with exact implementation from spec Task 11.2:
- `RulePack` interface
- `BUILTIN_RULE_PACKS` with gdpr (5 rules), soc2 (3 rules), hipaa (3 rules)
- `installRulePack(packName, projectRoot): void`
- `generateRuleMarkdown()`, `generateSkillMarkdown()` helpers

Add `bp rules install <framework>` CLI command (registered in cli/index.ts).

**11.3 — Semantic diff engine**
Create `src/ecosystem/diff.ts` with exact implementation from spec Task 11.3:
- `BlueprintDiff` interface
- `diffBlueprints(left, right): BlueprintDiff` — diffs rules, skills, personas by id/name
- `diffRule()`, `diffSkill()`, `diffPersona()` field-level diff helpers
- `formatDiffReport(diff): string`

Update `src/cli/commands/diff.ts` (or create) to parse two blueprint paths, call
`diffBlueprints()`, and print the report. Add `--json` flag.

**11.4 — Three-way merge**
Create `src/ecosystem/merge.ts` with exact implementation from spec Task 11.3 (merge section):
- `MergeConflict` and `MergeResult` interfaces
- `threeWayMerge(base, left, right): MergeResult`
- `formatMergeReport(result): string`
- `applyModification()` helper

Update `src/cli/commands/merge.ts` (or create) to accept three paths (base, left,
right), call `threeWayMerge()`, write merged output, print conflict report.

**11.5 — Enterprise deep merge inheritance**
Create `src/ecosystem/inheritance.ts` with exact implementation from spec Task 11.4:
- `MergeStrategy` type (`"deep" | "shallow" | "override"`)
- `InheritanceConfig` and `OverrideAuditEntry` interfaces
- `mergeBlueprints(base, override, strategy, audit): BlueprintIR`
- `deepMerge()` — merges rules/skills/personas by id/name, overrides settings/risk/etc.
- `writeOverrideAudit(audit, projectRoot): void` — writes `.bp-override-audit.yaml`

**11.6 — Tests**
- `tests/unit/ecosystem/marketplace.test.ts` — mock fetch, filter logic (15+ tests)
- `tests/unit/ecosystem/rule-library.test.ts` — GDPR/SOC2/HIPAA packs installed correctly (15+ tests)
- `tests/unit/ecosystem/diff.test.ts` — added/removed/modified/unchanged for rules/skills/personas (20+ tests)
- `tests/unit/ecosystem/merge.test.ts` — three-way merge, conflict detection, auto-resolve (15+ tests)
- `tests/unit/ecosystem/inheritance.test.ts` — deep/shallow/override strategies, audit trail (10+ tests)

### Verification Commands
```
npm run typecheck
bun test tests/unit/ecosystem/
```

### Done Criteria
- [ ] `searchMarketplace()` returns filtered results
- [ ] `bp rules install gdpr` creates 5 rules + 1 skill in .claude/rules/ + skills/
- [ ] `diffBlueprints()` correctly identifies added/removed/modified with field-level changes
- [ ] `threeWayMerge()` auto-resolves non-conflicting changes
- [ ] `mergeBlueprints()` with deep strategy merges rules by id, overrides settings
- [ ] `.bp-override-audit.yaml` written with timestamp + path
- [ ] 60+ tests passing

---

## Final Validation Checklist

Run this after all 11 domains are complete:

```bash
# 1. Full test suite
bun test --coverage

# 2. Type check
npm run typecheck

# 3. Lint
biome check src/

# 4. Build binary
bun build --compile src/cli/index.ts --outfile bp

# 5. Smoke test on a real fixture
./bp init --tool claude tests/fixtures/node-express/
./bp verify --level all
./bp doctor --secret-scan
./bp docs generate
./bp diff tests/fixtures/node-express/ tests/fixtures/node-nextjs/
```

### Global Success Criteria (from 00-MASTER-ANALYSIS.md)

| Criterion | Target |
|-----------|--------|
| Test coverage | ≥ 95% (300+ tests) |
| `biome check` | exits 0 |
| Binary size | < 50MB |
| All 10 backends | generate valid output + AGENTS.md |
| IR v2.0 round-trip | ≥ 98% fidelity |
| Risk tier accuracy | ≥ 90% |
| Cross-layer ref validation | catches broken refs |
| Template conditional rendering | works |
| Secret scan | detects API keys, JWTs, private keys |
| Semantic drift detection | ≥ 85% accuracy |
| Anomaly detection | z-score catches deviations |
| Cost dashboard | generated as markdown |
| `bp init` performance | < 3s on 1K files, < 8s on 10K files |
| LSP server | diagnostics + hover + go-to-definition |
| Fuzz tests | 1000 runs, zero panics |
| Zero high-severity | Snyk/CodeQL findings |

---

## Quick Reference: New Files Per Domain

| Domain | New Files |
|--------|-----------|
| 01 | `tests/unit/ir/exports.test.ts` |
| 02 | `docs/backend-parity.md`, `tests/integration/backends/round-trip.test.ts` |
| 03 | `src/detector/enterprise-signals.ts`, `tests/unit/detector/enterprise-signals.test.ts` |
| 04 | `src/validator/cross-layer.ts`, `src/validator/layers-deep.ts`, `src/validator/performance.ts`, 3 test files |
| 05 | `src/templater/metadata.ts`, `src/templater/conditional.ts`, `src/templater/risk-selector.ts`, risk template dirs, 4 test files |
| 06 | `src/enterprise/secrets.ts`, `src/enterprise/env-template.ts`, `src/enterprise/compliance-report.ts`, `src/enterprise/runbooks.ts`, 4 test files |
| 07 | Missing CLI commands in `src/cli/commands/`, `src/multiagent/mcp-governance.ts`, `src/multiagent/chains.ts`, `src/multiagent/memory.ts`, 3 test files |
| 08 | `src/observability/semantic-drift.ts`, `src/observability/anomaly.ts`, `src/observability/dashboard.ts`, `src/observability/telemetry-detect.ts`, `src/observability/alerts.ts`, 4 test files |
| 09 | `src/security/path-traversal.ts`, `src/security/hook-validator.ts`, `src/security/sandbox.ts`, `src/lsp/server.ts`, `editors/vscode/`, `tests/fuzz/`, `tests/performance/`, `.github/actions/verify/action.yml` |
| 10 | `editors/vscode/src/tree-view.ts`, `src/dx/migrate.ts`, `src/dx/dev-server.ts`, `src/dx/docs.ts`, 3 test files |
| 11 | `src/ecosystem/marketplace-v2.ts`, `src/ecosystem/rule-library.ts`, `src/ecosystem/diff.ts`, `src/ecosystem/merge.ts`, `src/ecosystem/inheritance.ts`, 5 test files |

---

*Implementation Plan · open-blueprint v2.0 · 2026-05-28*
