import { describe, expect, it } from "vitest";
import {
  AgentRegistry,
  AgentRegistryEntry,
  AgentRegistryEntrySchema,
  AgentRegistrySchema,
  Alerting,
  AlertingSchema,
  Audit,
  AuditSchema,
  BlueprintIR,
  BlueprintIRSchema,
  Command,
  CommandSchema,
  Compliance,
  ComplianceSchema,
  Cost,
  CostSchema,
  CrossAgentCommunication,
  CrossAgentCommunicationSchema,
  Hook,
  HookSchema,
  Identity,
  IdentitySchema,
  MCPServer,
  MCPServerSchema,
  Meta,
  MetaSchema,
  Metrics,
  MetricsSchema,
  Orchestration,
  OrchestrationSchema,
  Persona,
  PersonaSchema,
  Registry,
  RegistrySchema,
  Risk,
  RiskSchema,
  Rule,
  RuleSchema,
  SemanticDrift,
  SemanticDriftSchema,
  Settings,
  SettingsSchema,
  Skill,
  SkillSchema,
  SpatialAnchor,
  SpatialAnchorSchema,
  Telemetry,
  TelemetrySchema,
  ToolRegistryEntry,
  ToolRegistryEntrySchema,
  isV1,
  isV2,
} from "../../../src/translator/ir.js";

const minimalV1IR: BlueprintIR = {
  version: "2.0",
  spatial_anchor: {
    project_name: "test",
    surface: "claude",
    temporal_anchor: "2024-01-01",
    conventions: [],
  },
  personas: [],
  rules: [],
  skills: [],
  hooks: [],
  meta: {
    rule_precedence: [],
    conflict_resolution: "last-wins",
    source_backend: "claude",
    target_backend: "claude",
  },
};

const fullV2IR: BlueprintIR = {
  ...minimalV1IR,
  settings: {
    approval_mode: "auto",
    cost_controls: { monthly_budget_usd: 100 },
  },
  commands: [
    {
      name: "test-cmd",
      description: "test",
      tools_required: [],
    },
  ],
  mcp_servers: [
    {
      name: "github",
      endpoint: "https://mcp.github.com",
    },
  ],
  meta: {
    ...minimalV1IR.meta,
    schema_version: "2.0",
  },
};

describe("IR type exports", () => {
  it("all schemas are defined", () => {
    expect(SpatialAnchorSchema).toBeDefined();
    expect(PersonaSchema).toBeDefined();
    expect(RuleSchema).toBeDefined();
    expect(SkillSchema).toBeDefined();
    expect(HookSchema).toBeDefined();
    expect(MetaSchema).toBeDefined();
    expect(SettingsSchema).toBeDefined();
    expect(CommandSchema).toBeDefined();
    expect(ToolRegistryEntrySchema).toBeDefined();
    expect(MCPServerSchema).toBeDefined();
    expect(IdentitySchema).toBeDefined();
    expect(AuditSchema).toBeDefined();
    expect(ComplianceSchema).toBeDefined();
    expect(RiskSchema).toBeDefined();
    expect(CrossAgentCommunicationSchema).toBeDefined();
    expect(AgentRegistryEntrySchema).toBeDefined();
    expect(AgentRegistrySchema).toBeDefined();
    expect(RegistrySchema).toBeDefined();
    expect(OrchestrationSchema).toBeDefined();
    expect(TelemetrySchema).toBeDefined();
    expect(CostSchema).toBeDefined();
    expect(MetricsSchema).toBeDefined();
    expect(AlertingSchema).toBeDefined();
    expect(SemanticDriftSchema).toBeDefined();
    expect(BlueprintIRSchema).toBeDefined();
  });
});

describe("IR schema validation", () => {
  it("minimal v1.0 IR passes BlueprintIRSchema", () => {
    const result = BlueprintIRSchema.safeParse(minimalV1IR);
    expect(result.success).toBe(true);
  });

  it("full v2.0 IR passes BlueprintIRSchema", () => {
    const result = BlueprintIRSchema.safeParse(fullV2IR);
    expect(result.success).toBe(true);
  });

  it("missing required field fails validation", () => {
    const bad = { version: "2.0" };
    const result = BlueprintIRSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("SkillSchema accepts disable_model_invocation", () => {
    const skill = {
      name: "test",
      description: "desc",
      when_to_use: "always",
      tools_required: [],
      procedure: "do it",
      disable_model_invocation: true,
    };
    const result = SkillSchema.safeParse(skill);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.disable_model_invocation).toBe(true);
    }
  });

  it("MetaSchema accepts schema_version 2.0", () => {
    const meta = {
      rule_precedence: [],
      conflict_resolution: "last-wins",
      source_backend: "claude",
      target_backend: "claude",
      schema_version: "2.0",
    };
    const result = MetaSchema.safeParse(meta);
    expect(result.success).toBe(true);
  });

  it("MetaSchema accepts schema_version 1.0", () => {
    const meta = {
      rule_precedence: [],
      conflict_resolution: "last-wins",
      source_backend: "claude",
      target_backend: "claude",
      schema_version: "1.0",
    };
    const result = MetaSchema.safeParse(meta);
    expect(result.success).toBe(true);
  });

  it("MetaSchema rejects invalid schema_version", () => {
    const meta = {
      rule_precedence: [],
      conflict_resolution: "last-wins",
      source_backend: "claude",
      target_backend: "claude",
      schema_version: "3.0",
    };
    const result = MetaSchema.safeParse(meta);
    expect(result.success).toBe(false);
  });
});

describe("isV2 / isV1 type guards", () => {
  it("isV2 returns true for IR with schema_version 2.0", () => {
    const ir: BlueprintIR = {
      ...minimalV1IR,
      meta: { ...minimalV1IR.meta, schema_version: "2.0" },
    };
    expect(isV2(ir)).toBe(true);
  });

  it("isV2 returns true for IR with settings", () => {
    const ir: BlueprintIR = {
      ...minimalV1IR,
      settings: { approval_mode: "auto" },
    };
    expect(isV2(ir)).toBe(true);
  });

  it("isV2 returns true for IR with mcp_servers", () => {
    const ir: BlueprintIR = {
      ...minimalV1IR,
      mcp_servers: [{ name: "test", endpoint: "https://test.com" }],
    };
    expect(isV2(ir)).toBe(true);
  });

  it("isV2 returns false for minimal IR with no v2 fields", () => {
    expect(isV2(minimalV1IR)).toBe(false);
  });

  it("isV1 returns true for minimal IR", () => {
    expect(isV1(minimalV1IR)).toBe(true);
  });

  it("isV1 returns false for v2.0 IR", () => {
    expect(isV1(fullV2IR)).toBe(false);
  });
});
