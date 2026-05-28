# Domain: Validator Engine Enhancement
**Priority:** P1 · **Status:** ⚠️ PARTIAL — Governance layer done, cross-layer + performance missing · **Dependencies:** `01-IR-SCHEMA-FOUNDATION.md`
**Agent Boundary:** Base 4-layer validation + governance validation exist. Your job is cross-layer reference validation, Layer 6-8 deep validation, and performance auditing.

---

## 1. Current State (Verified from Repo)

`src/validator/index.ts` already implements:
- ✅ 4-layer validation pipeline (structural, semantic, logical, drift)
- ✅ `validateGovernance()` — validates ALL enterprise layers (settings, commands, MCP, identity, audit, compliance, risk, registry, orchestration)
- ✅ `validateOrchestrationSemantic()` — cross-layer orchestration validation
- ✅ `validateCostConfig()` — cost validation
- ✅ `validateAlertingConfig()` — alerting validation
- ✅ Incremental validation cache (`loadCache`/`saveCache`)
- ✅ Exit code mapping for all error types

**Missing:**
- ❌ Cross-layer reference validation (rule→skill, agent→tool, skill→command)
- ❌ Layer 6-8 deep schema validation (settings approval_mode vs risk tier, command uniqueness, MCP auth scope validation)
- ❌ Performance audit (glob pattern explosion, rule count thresholds)

---

## 2. Implementation Tasks

### Task 4.1: Cross-Layer Reference Validator
Create `src/validator/cross-layer.ts`:

```typescript
import type { BlueprintIR } from "../translator/ir.js";
import type { ValidationError } from "./structural.js";

export function validateCrossLayerReferences(ir: BlueprintIR, blueprintFile: string): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Rule → Skill references
  const skillNames = new Set(ir.skills.map(s => s.name));
  for (const rule of ir.rules) {
    const refs = extractSkillRefs(rule.action);
    for (const ref of refs) {
      if (!skillNames.has(ref)) {
        errors.push({
          file: blueprintFile,
          type: "MISSING_SKILL_REFERENCE",
          severity: "error",
          message: `Rule "${rule.id}" references unknown skill: ${ref}`,
          resolution: `Add skill '${ref}' to skills directory or remove reference`,
        });
      }
    }
  }

  // 2. Agent → Tool/Skill references
  const knownTools = new Set(["file_read", "file_edit", "terminal", "test_runner", ...skillNames]);
  for (const agent of ir.personas) {
    for (const tool of agent.allowed_tools ?? []) {
      if (!knownTools.has(tool)) {
        errors.push({
          file: blueprintFile,
          type: "UNKNOWN_TOOL_REFERENCE",
          severity: "warning",
          message: `Agent "${agent.name}" references unknown tool/skill: ${tool}`,
          resolution: `Add to skills or use a known tool name`,
        });
      }
    }
  }

  // 3. Skill → Command references
  const commandNames = new Set((ir.commands ?? []).map(c => c.name));
  for (const skill of ir.skills) {
    const refs = extractCommandRefs(skill.procedure);
    for (const ref of refs) {
      if (!commandNames.has(ref)) {
        errors.push({
          file: blueprintFile,
          type: "UNKNOWN_COMMAND_REFERENCE",
          severity: "warning",
          message: `Skill "${skill.name}" references unknown command: ${ref}`,
          resolution: `Add command '${ref}' or remove reference`,
        });
      }
    }
  }

  // 4. Compliance → Rule references
  if (ir.compliance?.compliance_gaps) {
    for (const gap of ir.compliance.compliance_gaps) {
      // gap.remediation may reference rules
    }
  }

  return errors;
}

function extractSkillRefs(text: string): string[] {
  const matches = text.matchAll(/\[\[skill:([^\]]+)\]\]|@skill:([\w-]+)/g);
  return Array.from(matches).map(m => m[1] || m[2]);
}

function extractCommandRefs(text: string): string[] {
  const matches = text.matchAll(/\[\[command:([^\]]+)\]\]|@command:([\w-]+)/g);
  return Array.from(matches).map(m => m[1] || m[2]);
}
```

### Task 4.2: Layer 6-8 Deep Validation
Create `src/validator/layers-deep.ts`:

```typescript
export function validateSettingsDeep(ir: BlueprintIR, file: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!ir.settings) return errors;

  // Approval mode must match risk tier
  if (ir.risk?.risk_tier) {
    const expected = riskToApprovalMode(ir.risk.risk_tier);
    if (ir.settings.approval_mode && ir.settings.approval_mode !== expected) {
      errors.push({
        file,
        type: "SETTINGS_RISK_MISMATCH",
        severity: "warning",
        message: `Approval mode '${ir.settings.approval_mode}' does not match risk tier '${ir.risk.risk_tier}' (expected: ${expected})`,
        resolution: `Set approval_mode to '${expected}' or adjust risk tier`,
      });
    }
  }

  // Budget must be positive
  if (ir.settings.cost_controls?.monthly_budget_usd !== undefined && 
      ir.settings.cost_controls.monthly_budget_usd <= 0) {
    errors.push({
      file,
      type: "INVALID_BUDGET",
      severity: "error",
      message: "monthly_budget_usd must be positive",
      resolution: "Set a value > 0 or remove the field",
    });
  }

  return errors;
}

export function validateCommandsDeep(ir: BlueprintIR, file: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!ir.commands) return errors;

  // Names must be unique
  const names = new Set<string>();
  for (const cmd of ir.commands) {
    if (names.has(cmd.name)) {
      errors.push({
        file,
        type: "DUPLICATE_COMMAND",
        severity: "error",
        message: `Duplicate command name: ${cmd.name}`,
        resolution: "Rename or merge commands",
      });
    }
    names.add(cmd.name);

    // Timeout must be reasonable
    // (CommandSchema doesn't have timeout yet — may need IR update)
  }

  return errors;
}

export function validateMCPServersDeep(ir: BlueprintIR, file: string): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!ir.mcp_servers) return errors;

  for (const server of ir.mcp_servers) {
    // Must have endpoint or command
    if (!server.endpoint && !server.name) {
      errors.push({
        file,
        type: "MCP_SERVER_INCOMPLETE",
        severity: "error",
        message: `MCP server '${server.name}' missing endpoint`,
        resolution: "Add endpoint or command configuration",
      });
    }

    // Tool risk levels consistent with project risk
    if (ir.risk?.risk_tier === "low" && server.risk_level === "high") {
      errors.push({
        file,
        type: "MCP_RISK_MISMATCH",
        severity: "warning",
        message: `Low-risk project has high-risk MCP server: ${server.name}`,
        resolution: "Downgrade server risk_level or upgrade project risk tier",
      });
    }

    // Auth scope should be present for high-risk tools
    const highRiskTools = server.tool_registry?.filter(t => t.risk_level === "high") ?? [];
    if (highRiskTools.length > 0 && !server.auth_scope?.length) {
      errors.push({
        file,
        type: "MCP_AUTH_MISSING",
        severity: "warning",
        message: `High-risk MCP server '${server.name}' missing auth scopes`,
        resolution: "Add auth_scope to restrict tool access",
      });
    }
  }

  return errors;
}
```

### Task 4.3: Performance Auditor
Create `src/validator/performance.ts`:

```typescript
export interface PerformanceAuditResult {
  warnings: ValidationError[];
  metrics: {
    total_glob_patterns: number;
    total_rules: number;
    estimated_validation_time_ms: number;
  };
}

export function auditPerformance(ir: BlueprintIR, file: string): PerformanceAuditResult {
  const warnings: ValidationError[] = [];

  // 1. Glob pattern explosion
  const totalPatterns = ir.rules.reduce((sum, r) => {
    return sum + r.scope.split(/[,|]/).length;
  }, 0);
  if (totalPatterns > 1000) {
    warnings.push({
      file,
      type: "GLOB_PATTERN_EXPLOSION",
      severity: "warning",
      message: `Total glob patterns: ${totalPatterns} — may impact performance`,
      resolution: "Consolidate rules or use broader scope patterns",
    });
  }

  // 2. Rule count thresholds
  if (ir.rules.length > 100) {
    warnings.push({
      file,
      type: "RULE_COUNT_HIGH",
      severity: "warning",
      message: `Rule count: ${ir.rules.length} — consider splitting into multiple blueprints`,
      resolution: "Use blueprint inheritance or domain-specific blueprints",
    });
  }

  // 3. Agent registry size
  if (ir.agent_registry && ir.agent_registry.agents.length > 50) {
    warnings.push({
      file,
      type: "AGENT_REGISTRY_LARGE",
      severity: "warning",
      message: `Agent registry: ${ir.agent_registry.agents.length} agents — may be unwieldy`,
      resolution: "Split into team-specific registries",
    });
  }

  // 4. Estimated validation time
  const estimatedTime = Math.min(totalPatterns * 2 + ir.rules.length * 5, 5000);

  return {
    warnings,
    metrics: {
      total_glob_patterns: totalPatterns,
      total_rules: ir.rules.length,
      estimated_validation_time_ms: estimatedTime,
    },
  };
}
```

### Task 4.4: Pipeline Integration
Update `src/validator/index.ts`:
- [ ] Import and call `validateCrossLayerReferences()` in governance layer
- [ ] Import and call `validateSettingsDeep()`, `validateCommandsDeep()`, `validateMCPServersDeep()`
- [ ] Import and call `auditPerformance()`
- [ ] Ensure new errors are collected, not short-circuited
- [ ] Add new error types to `exitCodeForResult()`

### Task 4.5: Testing
Create test files:
- [ ] `tests/unit/validator/cross-layer.test.ts` — 20+ tests
- [ ] `tests/unit/validator/layers-deep.test.ts` — 15+ tests
- [ ] `tests/unit/validator/performance.test.ts` — 10+ tests

---

## 3. Acceptance Criteria

- [ ] Cross-layer references validated (rule→skill, agent→tool, skill→command)
- [ ] Settings approval_mode validated against risk tier
- [ ] Command uniqueness enforced
- [ ] MCP server risk levels validated against project risk
- [ ] Performance audit warns on >1000 glob patterns, >100 rules
- [ ] All new validators integrated into `bp verify --level all`
- [ ] New error types mapped to correct exit codes
- [ ] 45+ new tests, all passing
- [ ] No regression in existing validation

---

## 4. Cross-References

| Concern | File | Status |
|---------|------|--------|
| IR schema for layers 6-8 | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Risk tier from detector | `03-DETECTOR-ENHANCEMENT.md` | ⚠️ Partial |
| Enterprise governance | `06-ENTERPRISE-GOVERNANCE.md` | ⚠️ Partial |
| Templater performance | `05-TEMPLATER-ENHANCEMENT.md` | ⚠️ Not started |

---

*Domain Spec: Validator Enhancement · open-blueprint v2.0*
