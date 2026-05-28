# Domain: Multi-Agent Orchestration & MCP Governance
**Priority:** P2 · **Status:** ✅ MOSTLY COMPLETE — Verify + CLI polish · **Dependencies:** `01-IR-SCHEMA-FOUNDATION.md`
**Agent Boundary:** IR schemas and validation exist. Your job is to verify MCP governance depth, ensure CLI commands work end-to-end, and polish the agent registry UX.

---

## 1. Current State (Verified from Repo)

Already implemented in `src/translator/ir.ts`:
- ✅ `AgentRegistryEntrySchema` — name, owner, purpose, risk_tier, eval_status, version, capabilities, dependencies
- ✅ `AgentRegistrySchema` — agents array, registry_version, last_updated
- ✅ `OrchestrationSchema` — agent_teams, agent_chains, persistent_memory, cross_agent_communication
- ✅ `MCPServerSchema` — name, endpoint, auth_scope, tools, risk_level, governance, tool_registry
- ✅ `ToolRegistryEntrySchema` — per-tool auth within MCP
- ✅ `CrossAgentCommunicationSchema` — message_schema, shared_state_schemas, inter_agent_validation, communication_protocol

Already implemented in `src/validator/index.ts`:
- ✅ `validateOrchestrationSemantic()` — validates orchestration layer
- ✅ `validateCostConfig()` — cost validation
- ✅ `validateAlertingConfig()` — alerting validation

**Missing/Unknown:**
- ❓ `bp agent`, `bp mcp`, `bp team`, `bp chain`, `bp memory` CLI commands — may exist but need verification
- ❓ MCP risk scoring algorithm implementation depth
- ❓ Agent team config generation for each backend
- ❓ Chain DAG validation (cycle detection)
- ❓ Memory directory governance enforcement

---

## 2. Verification Tasks

### Task 7.1: CLI Command Verification
Check if these commands exist in `src/cli/commands/`:
- [ ] `agent.ts` — `bp agent list`, `bp agent add`, `bp agent validate`
- [ ] `mcp.ts` — `bp mcp list`, `bp mcp validate`, `bp mcp risk-report`
- [ ] `team.ts` — `bp team list`, `bp team validate`
- [ ] `chain.ts` — `bp chain list`, `bp chain validate`
- [ ] `memory.ts` — `bp memory audit`, `bp memory cleanup`

If missing, implement them.

### Task 7.2: MCP Risk Scoring Algorithm
Verify `src/multiagent/mcp-governance.ts` (or equivalent) implements:

```typescript
export function scoreMCPServer(server: MCPServer): {
  score: number;
  max: number;
  tier: "low" | "medium" | "high" | "critical";
} {
  let score = 0;
  const max = 10;

  // Tool risk levels
  for (const tool of server.tool_registry ?? []) {
    switch (tool.risk_level) {
      case "low": score += 1; break;
      case "medium": score += 2; break;
      case "high": score += 3; break;
      case "critical": score += 5; break;
    }
  }

  // Auth risk
  if (!server.auth_scope?.length) score += 2;
  if (server.governance?.approval_required === false) score += 2;

  // Data sensitivity
  if (server.governance?.data_sensitivity === "high") score += 2;
  if (server.governance?.data_sensitivity === "critical") score += 3;

  const tier = score >= 8 ? "critical" : score >= 5 ? "high" : score >= 3 ? "medium" : "low";
  return { score, max, tier };
}
```

### Task 7.3: Agent Team Config Generation
Verify each backend adapter generates team configs:
- [ ] **PI Agent**: `teams.yaml` with members, coordinator, shared_memory
- [ ] **Claude**: Team section in `CLAUDE.md`
- [ ] **Cursor**: Team section in `.cursorrules` or context file
- [ ] **Codex**: Team metadata in `codex.md`

If missing, add to respective adapters.

### Task 7.4: Chain DAG Validation
Verify `src/multiagent/chains.ts` (or equivalent) implements:

```typescript
export function validateChainDAG(chain: ChainConfig): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  const graph = new Map<string, string[]>();
  const agents = new Set<string>();

  // Build graph
  for (let i = 0; i < chain.steps.length; i++) {
    const step = chain.steps[i];
    agents.add(step.agent);

    if (step.input_from) {
      const prevStep = chain.steps.find(s => s.action === step.input_from);
      if (!prevStep) {
        errors.push(`Step ${i}: unresolved input reference '${step.input_from}'`);
      } else {
        graph.set(step.agent, [...(graph.get(step.agent) || []), prevStep.agent]);
      }
    }
  }

  // Cycle detection (DFS)
  const visited = new Set<string>();
  const recStack = new Set<string>();

  function hasCycle(node: string): boolean {
    visited.add(node);
    recStack.add(node);
    for (const neighbor of graph.get(node) || []) {
      if (!visited.has(neighbor) && hasCycle(neighbor)) return true;
      if (recStack.has(neighbor)) return true;
    }
    recStack.delete(node);
    return false;
  }

  for (const agent of agents) {
    if (!visited.has(agent) && hasCycle(agent)) {
      errors.push(`Circular dependency detected involving agent: ${agent}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

### Task 7.5: Memory Governance Enforcement
Verify `src/multiagent/memory.ts` (or equivalent) implements:

```typescript
export interface MemoryGovernanceConfig {
  retention_policy: "session" | "day" | "week" | "persistent";
  max_size_mb: number;
  encryption_at_rest: boolean;
  access_control: Array<{ agent_id: string; permission: "read" | "write" | "admin" }>;
}

export function enforceMemoryGovernance(
  memoryDir: string,
  config: MemoryGovernanceConfig
): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];

  // Size check
  const size = getDirectorySize(memoryDir);
  if (size > config.max_size_mb * 1024 * 1024) {
    violations.push(
      `Memory directory exceeds max size: ${(size / 1024 / 1024).toFixed(2)}MB > ${config.max_size_mb}MB`
    );
  }

  // Encryption check (for critical projects)
  if (config.encryption_at_rest && !hasEncryption(memoryDir)) {
    violations.push("Memory directory not encrypted at rest");
  }

  // Retention check
  const files = fs.readdirSync(memoryDir, { recursive: true }) as string[];
  const now = Date.now();
  for (const file of files) {
    const stat = fs.statSync(path.join(memoryDir, file));
    const age = now - stat.mtimeMs;
    const maxAge = retentionToMs(config.retention_policy);
    if (age > maxAge) {
      violations.push(`File ${file} exceeds retention policy (${config.retention_policy})`);
    }
  }

  return { compliant: violations.length === 0, violations };
}

function retentionToMs(policy: string): number {
  switch (policy) {
    case "session": return 24 * 60 * 60 * 1000; // 1 day
    case "day": return 7 * 24 * 60 * 60 * 1000; // 7 days
    case "week": return 30 * 24 * 60 * 60 * 1000; // 30 days
    case "persistent": return Infinity;
    default: return 7 * 24 * 60 * 60 * 1000;
  }
}
```

### Task 7.6: Testing
Create/update test files:
- [ ] `tests/unit/multiagent/mcp-governance.test.ts` — 15+ tests
- [ ] `tests/unit/multiagent/chain-dag.test.ts` — 15+ tests
- [ ] `tests/unit/multiagent/memory-governance.test.ts` — 10+ tests
- [ ] `tests/integration/multiagent/cli.test.ts` — 10+ tests

---

## 3. Acceptance Criteria

- [ ] `bp agent list` shows all registered agents
- [ ] `bp mcp validate` checks risk scores and auth scopes
- [ ] `bp team validate` validates team configs
- [ ] `bp chain validate` detects cycles and unresolved references
- [ ] `bp memory audit` enforces size limits and retention policies
- [ ] MCP risk scoring produces correct tier (low/medium/high/critical)
- [ ] Chain DAG validation catches circular dependencies
- [ ] Memory governance catches oversized/unencrypted directories
- [ ] All CLI commands support `--json` output
- [ ] 50+ tests, all passing
- [ ] Coverage for `src/multiagent/` ≥ 95%

---

## 4. Cross-References

| Concern | File | Status |
|---------|------|--------|
| IR schema for orchestration | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Risk tier for agent/tool classification | `03-DETECTOR-ENHANCEMENT.md` | ⚠️ Partial |
| Enterprise RBAC for agent access | `06-ENTERPRISE-GOVERNANCE.md` | ⚠️ Partial |
| Cost tracking per agent | `08-OBSERVABILITY-COST.md` | ⚠️ Partial |
| Backend adapters for team/chain output | `02-BACKEND-EXPANSION.md` | ✅ Complete |

---

*Domain Spec: Multi-Agent & MCP · open-blueprint v2.0*
