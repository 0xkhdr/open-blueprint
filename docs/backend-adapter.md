# open-blueprint (`bp`) — Custom Backend Adapters

This developer guide details how to implement and register a custom **backend translation adapter** inside the `bp` translation system.

---

## 1. Adapter Philosophy & Pipeline

`bp` utilizes a decoupled translator model. Instead of writing separate compilers for every platform combination ($N \times M$ complexity), the Translator converts all formats into a common, Zod-validated Intermediate Representation (`BlueprintIR`).

Decoupled translation flow:

1. **Parser Phase**: Target-specific adapters parse platform-native files (e.g. `.cursorrules`, `.claude/rules/*.md`) into the standardized `BlueprintIR` schema.
2. **Intermediate Representation**: The Zod validator ensures the schema perfectly conforms to structural compliance rules.
3. **Renderer Phase**: Target-specific adapters parse the `BlueprintIR` and output fully compliant vendor configuration structures.

---

## 2. Structure of `BlueprintIRSchema` (v1.0)

Every custom adapter maps configurations to/from the `BlueprintIRSchema` defined in `src/translator/ir.ts`. The schema covers core developer and advanced enterprise layers:

```typescript
export const BlueprintIRSchema = z.object({
  version: z.literal("2.0"),
  
  // Layer 1: Spatial Anchor (Where is the agent in the project lifecycle?)
  spatial_anchor: z.object({
    project_name: z.string(),
    surface: z.string(),
    temporal_anchor: z.string(),
    conventions: z.array(z.string()),
  }),

  // Layer 2: Personas (Who is the agent?)
  personas: z.array(z.object({
    name: z.string(),
    role: z.string(),
    reasoning_style: z.string(),
    constraints: z.array(z.string()),
    allowed_tools: z.array(z.string()).optional(),
  })),

  // Layer 3: Rules (What must or must not happen?)
  rules: z.array(z.object({
    id: z.string(),
    scope: z.string(),
    severity: z.enum(["hard", "soft"]),
    action: z.string(),
    rationale: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })),

  // Layer 4: Skills (Step-by-step procedures to accomplish chores)
  skills: z.array(z.object({
    name: z.string(),
    description: z.string(),
    when_to_use: z.string(),
    tools_required: z.array(z.string()),
    procedure: z.string(),
  })),

  // Layer 5: Hooks (Lifecycle callbacks at tool boundaries)
  hooks: z.array(z.object({
    event: z.enum(["pre_tool_use", "post_tool_use"]),
    language: z.string(),
    stub: z.string(),
  })),

  // Layer 6: Settings (Cost, tokens, temperature, and limits)
  settings: z.object({
    approval_mode: z.enum(["auto", "confirm", "read-only"]).optional(),
    model_config: z.object({
      model: z.string().optional(),
      max_tokens: z.number().optional(),
      temperature: z.number().optional(),
    }).optional(),
    cost_controls: z.object({
      monthly_budget_usd: z.number().optional(),
      per_session_limit_usd: z.number().optional(),
    }).optional(),
    safety_modes: z.array(z.string()).optional(),
  }).optional(),

  // Layer 7: Custom Commands
  commands: z.array(z.object({
    name: z.string(),
    description: z.string(),
    aliases: z.array(z.string()).optional(),
    tools_required: z.array(z.string()),
    approval_scope: z.enum(["auto", "confirm", "admin"]).optional(),
  })).optional(),

  // Layer 8: MCP Servers
  mcp_servers: z.array(z.object({
    name: z.string(),
    endpoint: z.string(),
    auth_scope: z.array(z.string()).optional(),
    tools: z.array(z.string()).optional(),
    risk_level: z.enum(["low", "medium", "high"]).optional(),
  })).optional(),

  // Enterprise Security Layers
  identity: z.object({
    rbac_enabled: z.boolean().optional(),
    roles: z.array(z.object({
      name: z.string(),
      permissions: z.array(z.string()),
    })).optional(),
    agent_owner: z.string().optional(),
    iam_policy: z.record(z.string(), z.string()).optional(),
  }).optional(),

  audit: z.object({
    audit_enabled: z.boolean().optional(),
    log_level: z.enum(["debug", "info", "warn", "error"]).optional(),
    correlation_id_format: z.string().optional(),
    retention_days: z.number().optional(),
  }).optional(),

  compliance: z.object({
    frameworks: z.array(z.enum(["eu_ai_act", "iso_42001", "nist_ai_rmf", "gdpr", "hipaa", "soc2"])).optional(),
    compliance_gaps: z.array(z.object({
      framework: z.string(),
      gap: z.string(),
      remediation: z.string().optional(),
    })).optional(),
  }).optional(),

  meta: z.object({
    rule_precedence: z.array(z.string()),
    conflict_resolution: z.string(),
    source_backend: z.string(),
    target_backend: z.string(),
  }),
});
```

---

## 3. Implementing a Custom Adapter

To add a new platform adapter (for example, a custom tool named `mytool`):

### Step 3.1: Create the Adapter File

Create a new file `src/translator/adapters/mytool.ts` implementing the parse and render signatures:

```typescript
import * as fs from "node:fs";
import * as path from "node:path";
import { BlueprintIR } from "../ir.js";

export class MyToolAdapter {
  /**
   * Parse the platform-native file tree or unified configuration file 
   * and convert it into a compliant BlueprintIR structure.
   */
  async parse(projectRoot: string): Promise<BlueprintIR> {
    const configPath = path.join(projectRoot, ".mytoolrules");
    if (!fs.existsSync(configPath)) {
      throw new Error(`MyTool configuration not found at: ${configPath}`);
    }

    const raw = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Map fields from parsed payload to BlueprintIR
    return {
      version: "2.0",
      spatial_anchor: {
        project_name: parsed.name ?? "mytool-project",
        surface: parsed.scope ?? ".",
        temporal_anchor: parsed.phase ?? "active",
        conventions: parsed.styles ?? [],
      },
      personas: [],
      rules: (parsed.constraints ?? []).map((rule: any, index: number) => ({
        id: rule.id ?? `rule-${index}`,
        scope: rule.path ?? "**",
        severity: rule.strict ? "hard" : "soft",
        action: rule.behavior ?? "",
        rationale: rule.reason,
      })),
      skills: [],
      hooks: [],
      meta: {
        rule_precedence: parsed.precedence ?? [],
        conflict_resolution: "precedence-based",
        source_backend: "mytool",
        target_backend: "mytool",
      },
    };
  }

  /**
   * Translate the standard BlueprintIR and render it back 
   * into platform-native configuration files.
   */
  async render(ir: BlueprintIR, projectRoot: string): Promise<void> {
    const outputPath = path.join(projectRoot, ".mytoolrules");
    
    // Map BlueprintIR properties to MyTool schema
    const payload = {
      name: ir.spatial_anchor.project_name,
      scope: ir.spatial_anchor.surface,
      phase: ir.spatial_anchor.temporal_anchor,
      styles: ir.spatial_anchor.conventions,
      constraints: ir.rules.map((rule) => ({
        id: rule.id,
        path: rule.scope,
        strict: rule.severity === "hard",
        behavior: rule.action,
        reason: rule.rationale,
      })),
      precedence: ir.meta.rule_precedence,
    };

    fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf-8");
  }
}
```

---

## 4. Registering the Adapter

To register your adapter, add it to the adapter selector switch-case inside `src/validator/index.ts` under the `getAdapterByName` function:

```typescript
// 1. Import your custom adapter
import { MyToolAdapter } from "../translator/adapters/mytool.js";

// 2. Register within the selector
function getAdapterByName(backend: string) {
  switch (backend) {
    case "claude":
      return new ClaudeAdapter();
    case "cursor":
      return new CursorAdapter();
    case "mytool":
      return new MyToolAdapter(); // <--- Registered
    // ...
    default:
      return new GenericAdapter();
  }
}
```

---

## 5. Verifying Adapter Round-Trip Fidelity

All custom adapters must preserve governance semantics. Write a unit test verifying round-trip equivalence ($98\%$ or higher structural matching) inside `tests/unit/translator/`:

```typescript
import { test, expect } from "vitest";
import { MyToolAdapter } from "../../../src/translator/adapters/mytool.js";

test("MyTool adapter preserves semantics during round-trip translation", async () => {
  const adapter = new MyToolAdapter();
  const ir = await adapter.parse("/path/to/mock/root");
  
  // Render and re-parse
  await adapter.render(ir, "/path/to/mock/output");
  const reParsed = await adapter.parse("/path/to/mock/output");
  
  // Equivalence assert
  expect(reParsed.spatial_anchor.project_name).toBe(ir.spatial_anchor.project_name);
  expect(reParsed.rules.length).toBe(ir.rules.length);
});
```
