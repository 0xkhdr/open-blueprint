# Agent Implementation Instructions
**Version:** 2.1 · **Date:** 2026-05-28 · **Target Model:** Claude Sonnet 4.6
**Status:** Updated to reflect actual repository state

---

## 1. How to Use This Specification

This `spec-v2/` directory contains **12 self-contained domain files** plus this instruction file. Each domain is designed to be implemented by a **single agent** without overlapping with other agents.

**CRITICAL:** Many features assumed "missing" in the original regression analysis are **already implemented** in the repo. Read your assigned domain file carefully — it clearly marks what is ✅ done vs ⚠️ partial vs ❌ missing.

### 1.1 Before You Start
1. Read `00-MASTER-ANALYSIS.md` for the repo-accurate gap analysis.
2. Read **your assigned domain file** thoroughly. Note the "Current State" section.
3. Check the **Cross-References** section at the bottom of your domain file.
4. Read **Section 5** of this file (Repo-Specific Contracts).

### 1.2 What You Own
- Every file path listed in your domain's **Implementation Tasks**
- Every test file listed in your domain's **Testing** section
- The acceptance criteria in your domain's **Acceptance Criteria**

### 1.3 What You Do NOT Own
- Files owned by other domains (check Cross-References)
- The IR schema itself (owned by Domain 01 — VERIFY ONLY)
- Base engines (Detector, Templater, Validator, Translator) — extend them, don't rewrite

---

## 2. Implementation Protocol

Follow this exact sequence for every task:

```
READ SPEC → CONFIRM UNDERSTANDING → IMPLEMENT → WRITE TESTS → RUN TESTS → FIX → COMMIT → REPORT
```

### 2.1 Rules
- **Never** modify files owned by another domain without coordination.
- **Always** write tests alongside implementation (TDD preferred).
- **Always** run `biome check` and `npm run typecheck` before committing.
- **Always** use Conventional Commits: `feat(domain): description`.
- **Never** leave TODOs in shipped code.
- **Always** include file path, line number, and resolution in error messages.
- **Never** assume a feature is missing — check the actual repo first.

### 2.2 Commit Convention
```
feat(validator): add cross-layer reference validation
feat(templater): implement conditional template rendering
feat(enterprise): add secret scanning and compliance gap reports
feat(observability): implement semantic drift detection algorithm
feat(production): add LSP server and fuzz testing suite
feat(dx): implement migration assistant with feature parity
feat(ecosystem): add marketplace v2 and shared rule library
```

---

## 3. Repo-Specific Contracts

### 3.1 Actual IR Schema (Already Complete)
The IR in `src/translator/ir.ts` is far more complete than the original spec assumed. Key differences:

| Original Spec Assumption | Actual Repo State |
|--------------------------|-------------------|
| IR v1.0 only | IR v2.0 complete with ALL layers |
| 3 backends | 10 backends (Claude, Cursor, Codex, PI, Kiro, Antigravity, Copilot, Gemini, OpenDev, Generic) |
| No Settings/Commands/MCP | Full Layers 6-8 implemented |
| No enterprise layers | Identity, Audit, Compliance, Risk all implemented |
| No multi-agent | AgentRegistry, Orchestration, CrossAgentCommunication all implemented |
| No observability | Telemetry, Cost, Metrics, Alerting, SemanticDrift all implemented |

### 3.2 Adapter Interface (Actual)
```typescript
// From src/translator/index.ts
export interface BlueprintAdapter {
  parse(projectRoot: string): Promise<BlueprintIR>;
  render(ir: BlueprintIR, projectRoot: string): Promise<string[]>;
}
```
Note: `render()` takes `projectRoot` as second arg (not returning `Record<string, string>`).

### 3.3 Key Files to Know
| File | Purpose |
|------|---------|
| `src/translator/ir.ts` | All IR schemas — DO NOT MODIFY without coordination |
| `src/translator/index.ts` | Adapter registry, parse/render orchestration |
| `src/detector/index.ts` | Fingerprint + risk scoring + approval mode |
| `src/validator/index.ts` | 4-layer validation + governance validation |
| `src/templater/index.ts` | Handlebars rendering + template selection |
| `src/cli/index.ts` | Commander.js setup, audit logging hook |
| `src/cli/commands/init.ts` | Interactive wizard |

### 3.4 Consuming from Other Domains
When your domain depends on another domain's output:

| If you need... | Import from... | Example |
|----------------|----------------|---------|
| IR types | `src/translator/ir.ts` | `import { BlueprintIR, SettingsSchema } from "../translator/ir.js"` |
| Risk tier | `src/detector/index.ts` | `import { detectRiskTier } from "../detector/index.js"` |
| Base validation | `src/validator/index.ts` | `import { validateBlueprint } from "../validator/index.js"` |
| Adapter registry | `src/translator/index.ts` | `import { getAdapter } from "../translator/index.js"` |

---

## 4. Testing Standards

### 4.1 Test File Naming
```
tests/unit/{domain}/{feature}.test.ts
tests/integration/{domain}/{scenario}.test.ts
tests/e2e/{command}.test.ts
tests/snapshots/{backend}/{template}.snap
tests/fuzz/{strategy}.test.ts
tests/performance/{benchmark}.bench.ts
```

### 4.2 Coverage Requirements
- **Minimum per domain:** 95%
- **Schema code:** 100%
- **Error paths:** Every error code must have a test
- **Edge cases:** Empty arrays, null values, Unicode, large inputs

### 4.3 Snapshot Testing
Use Vitest snapshots for template output:
```typescript
import { test, expect } from "vitest";

test("claude template renders correctly for node-express", () => {
  const output = renderTemplate("claude", fixtureFingerprint);
  expect(output).toMatchSnapshot();
});
```

---

## 5. TypeScript & Code Quality

### 5.1 Strict Mode
```json
// tsconfig.json (already configured)
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true
  }
}
```

### 5.2 Biome Configuration
```json
// biome.json (already configured)
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100
  },
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": { "noConsoleLog": "warn" },
      "style": { "useConst": "error", "useTemplate": "error" }
    }
  }
}
```

### 5.3 Error Message Template
```typescript
throw new BlueprintError({
  code: "VALIDATION_SEMANTIC",
  file: ".claude/rules/02-api.md",
  line: 15,
  message: "Rule scope 'src/services/**' matches zero files",
  suggestion: "Check that the directory exists or broaden the pattern to 'src/**'",
  severity: "error",
});
```

---

## 6. Domain Assignment Quick Reference

| Agent | Domain File | Status | Key Deliverables |
|-------|-------------|--------|------------------|
| **Agent A** | `01-IR-SCHEMA-FOUNDATION.md` | ✅ VERIFY | Ensure all types exported, backward compat |
| **Agent B** | `02-BACKEND-EXPANSION.md` | ✅ VERIFY | Round-trip tests, feature parity matrix |
| **Agent C** | `03-DETECTOR-ENHANCEMENT.md` | ⚠️ PARTIAL | Enterprise signals (RBAC, compliance, audit, DLP) |
| **Agent D** | `04-VALIDATOR-ENHANCEMENT.md` | ⚠️ PARTIAL | Cross-layer refs, Layer 6-8 deep validation, performance audit |
| **Agent E** | `05-TEMPLATER-ENHANCEMENT.md` | ❌ MISSING | Conditional rendering, risk-aware packs, template metadata |
| **Agent F** | `06-ENTERPRISE-GOVERNANCE.md` | ⚠️ PARTIAL | Secret scan, compliance gap report, escalation runbooks |
| **Agent G** | `07-MULTIAGENT-MCP.md` | ✅ VERIFY | CLI commands, MCP risk scoring, chain DAG, memory governance |
| **Agent H** | `08-OBSERVABILITY-COST.md` | ⚠️ PARTIAL | Drift algorithm, anomaly detection, cost dashboard, alert engine |
| **Agent I** | `09-PRODUCTION-HARDENING.md` | ❌ MISSING | LSP server, VS Code ext, fuzz tests, benchmarks, security |
| **Agent J** | `10-DEVELOPER-EXPERIENCE.md` | ⚠️ PARTIAL | VS Code tree view, migration parity, dev server dashboard, docs |
| **Agent K** | `11-ECOSYSTEM-SCALE.md` | ⚠️ PARTIAL | Marketplace v2, rule packs, semantic diff/merge, inheritance |

---

## 7. Communication Between Agents

### 7.1 Dependency Order
```
01 (IR) → 02, 03, 04, 05
03 (Detector) → 06, 07, 08
04 (Validator) → 06, 07
05 (Templater) → 06
06 (Enterprise) → 07, 08
07 (Multi-Agent) → 08
08 (Observability) → 09
09 (Hardening) → 10
10 (DX) → 11
```

### 7.2 Handoff Checklist
When completing your domain, provide:
- [ ] All implementation files committed
- [ ] All tests passing (`bun test` exits 0)
- [ ] Coverage report ≥ 95%
- [ ] `biome check` exits 0
- [ ] `npm run typecheck` exits 0
- [ ] README update for your domain's CLI commands
- [ ] List of exported APIs for downstream agents

---

## 8. Common Pitfalls (Updated)

| Pitfall | Prevention |
|---------|------------|
| Assuming IR schema is v1.0 | It's v2.0 complete — use existing types |
| Assuming only 3 backends | 10 backends exist — test all relevant ones |
| Rewriting existing validation | Extend `validateGovernance()`, don't replace |
| Missing `--json` output | Required for all commands per spec |
| Forgetting `--dry-run` | Every write command must support it |
| Not checking actual repo files | Always verify file existence before assuming missing |
| Breaking idempotency | Always use `bp-generated` block markers |
| Ignoring Windows path handling | Use `path.normalize()` and `path.sep` |

---

## 9. Tooling Reference

| Task | Command |
|------|---------|
| Run tests | `bun test` |
| Run tests with coverage | `bun test --coverage` |
| Type check | `npm run typecheck` or `tsc --noEmit` |
| Lint & format | `biome check --apply src/` |
| Build binary | `bun build --compile src/cli/index.ts --outfile bp` |
| Run on fixture | `bp init --tool claude tests/fixtures/node-express` |
| Verify blueprint | `bp verify --level all` |
| Fuzz test | `bun test tests/fuzz/` |

---

## 10. Questions?

If a blocking ambiguity arises:
1. Check `00-MASTER-ANALYSIS.md` Section 2 (Actual Repository State)
2. Check your domain file's **Current State** section
3. Check your domain file's **Cross-References** section
4. If still unclear, write a mini ADR and proceed with the safest option

---

*Agent Instructions · open-blueprint v2.0 · Repo-Aligned · 2026-05-28*
