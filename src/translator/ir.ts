import { z } from "zod";

export const SpatialAnchorSchema = z.object({
  project_name: z.string(),
  surface: z.string(),
  temporal_anchor: z.string(),
  conventions: z.array(z.string()),
});

export const PersonaSchema = z.object({
  name: z.string(),
  role: z.string(),
  reasoning_style: z.string(),
  constraints: z.array(z.string()),
  allowed_tools: z.array(z.string()).optional(),
});

export const RuleSchema = z.object({
  id: z.string(),
  scope: z.string(),
  severity: z.enum(["hard", "soft"]),
  action: z.string(),
  rationale: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const SkillSchema = z.object({
  name: z.string(),
  description: z.string(),
  when_to_use: z.string(),
  tools_required: z.array(z.string()),
  procedure: z.string(),
});

export const HookSchema = z.object({
  event: z.enum(["pre_tool_use", "post_tool_use"]),
  language: z.string(),
  stub: z.string(),
});

export const MetaSchema = z.object({
  rule_precedence: z.array(z.string()),
  conflict_resolution: z.string(),
  source_backend: z.string(),
  target_backend: z.string(),
});

// Layer 6: Settings
export const SettingsSchema = z.object({
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
});

// Layer 7: Commands
export const CommandSchema = z.object({
  name: z.string(),
  description: z.string(),
  aliases: z.array(z.string()).optional(),
  tools_required: z.array(z.string()),
  approval_scope: z.enum(["auto", "confirm", "admin"]).optional(),
});

// Layer 8: MCP Servers
export const MCPServerSchema = z.object({
  name: z.string(),
  endpoint: z.string(),
  auth_scope: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  risk_level: z.enum(["low", "medium", "high"]).optional(),
});

// Enterprise Cross-Layer Schemas

// Identity & RBAC
export const IdentitySchema = z.object({
  rbac_enabled: z.boolean().optional(),
  roles: z.array(z.object({
    name: z.string(),
    permissions: z.array(z.string()),
  })).optional(),
  agent_owner: z.string().optional(),
  iam_policy: z.record(z.string(), z.string()).optional(),
});

// Audit Logging
export const AuditSchema = z.object({
  audit_enabled: z.boolean().optional(),
  log_level: z.enum(["debug", "info", "warn", "error"]).optional(),
  correlation_id_format: z.string().optional(),
  retention_days: z.number().optional(),
  compliance_checkpoints: z.array(z.string()).optional(),
});

// Compliance
export const ComplianceSchema = z.object({
  frameworks: z.array(z.enum(["eu_ai_act", "iso_42001", "nist_ai_rmf", "gdpr", "hipaa", "soc2"])).optional(),
  compliance_gaps: z.array(z.object({
    framework: z.string(),
    gap: z.string(),
    remediation: z.string().optional(),
  })).optional(),
  certified: z.boolean().optional(),
});

// Risk Tier Classification
export const RiskSchema = z.object({
  risk_tier: z.enum(["low", "medium", "high", "critical"]).optional(),
  risk_signals: z.object({
    has_external_apis: z.boolean().optional(),
    has_secrets_manager: z.boolean().optional(),
    has_auth_layer: z.boolean().optional(),
    has_data_sensitive: z.boolean().optional(),
  }).optional(),
  escalation_rules: z.array(z.object({
    condition: z.string(),
    action: z.string(),
  })).optional(),
});

// Registry & Marketplace
export const RegistrySchema = z.object({
  registry_name: z.string().optional(),
  published_version: z.string().optional(),
  dependencies: z.array(z.string()).optional(),
  verified_publisher: z.boolean().optional(),
});

// Orchestration & Multi-Agent
export const OrchestrationSchema = z.object({
  agent_teams: z.array(z.object({
    team_name: z.string(),
    agents: z.array(z.string()),
  })).optional(),
  agent_chains: z.array(z.object({
    chain_name: z.string(),
    sequence: z.array(z.string()),
    parallel_mode: z.boolean().optional(),
  })).optional(),
  persistent_memory: z.object({
    enabled: z.boolean().optional(),
    retention_policy: z.string().optional(),
  }).optional(),
});

export const BlueprintIRSchema = z.object({
  version: z.literal("2.0"),
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

export type SpatialAnchor = z.infer<typeof SpatialAnchorSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Hook = z.infer<typeof HookSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type Settings = z.infer<typeof SettingsSchema>;
export type Command = z.infer<typeof CommandSchema>;
export type MCPServer = z.infer<typeof MCPServerSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
export type Audit = z.infer<typeof AuditSchema>;
export type Compliance = z.infer<typeof ComplianceSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
export type Orchestration = z.infer<typeof OrchestrationSchema>;
export type BlueprintIR = z.infer<typeof BlueprintIRSchema>;
