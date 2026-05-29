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
  disable_model_invocation: z.boolean().optional(),
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
  schema_version: z.enum(["1.0", "2.0"]).default("2.0").optional(),
});

// Layer 6: Settings
export const SettingsSchema = z.object({
  approval_mode: z.enum(["auto", "confirm", "read-only"]).optional(),
  model_config: z
    .object({
      model: z.string().optional(),
      max_tokens: z.number().optional(),
      temperature: z.number().optional(),
    })
    .optional(),
  cost_controls: z
    .object({
      monthly_budget_usd: z.number().optional(),
      per_session_limit_usd: z.number().optional(),
    })
    .optional(),
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
// Tool Registry Entry (per-tool auth within MCP server)
export const ToolRegistryEntrySchema = z.object({
  tool_name: z.string(),
  server_name: z.string(),
  auth_scopes: z.array(z.string()).default([]),
  access_level: z.enum(["public", "restricted", "admin"]).default("restricted"),
  description: z.string().optional(),
  risk_level: z.enum(["low", "medium", "high"]).optional(),
});

export const MCPServerSchema = z.object({
  name: z.string(),
  endpoint: z.string(),
  auth_scope: z.array(z.string()).optional(),
  tools: z.array(z.string()).optional(),
  risk_level: z.enum(["low", "medium", "high"]).optional(),
  governance: z
    .object({
      permission_validation: z.boolean().default(false),
      auto_approve: z.array(z.string()).optional(),
      require_confirmation: z.array(z.string()).optional(),
    })
    .optional(),
  tool_registry: z.array(ToolRegistryEntrySchema).optional(),
});

// Enterprise Cross-Layer Schemas

// Identity & RBAC
export const IdentitySchema = z.object({
  rbac_enabled: z.boolean().optional(),
  roles: z
    .array(
      z.object({
        name: z.string(),
        permissions: z.array(z.string()),
      })
    )
    .optional(),
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
  frameworks: z
    .array(z.enum(["eu_ai_act", "iso_42001", "nist_ai_rmf", "gdpr", "hipaa", "soc2"]))
    .optional(),
  compliance_gaps: z
    .array(
      z.object({
        framework: z.string(),
        gap: z.string(),
        remediation: z.string().optional(),
      })
    )
    .optional(),
  certified: z.boolean().optional(),
});

// Risk Tier Classification
export const RiskSchema = z.object({
  risk_tier: z.enum(["low", "medium", "high", "critical"]).optional(),
  risk_signals: z
    .object({
      has_external_apis: z.boolean().optional(),
      has_secrets_manager: z.boolean().optional(),
      has_auth_layer: z.boolean().optional(),
      has_data_sensitive: z.boolean().optional(),
    })
    .optional(),
  escalation_rules: z
    .array(
      z.object({
        condition: z.string(),
        action: z.string(),
      })
    )
    .optional(),
});

// Cross-Agent Communication
export const CrossAgentCommunicationSchema = z.object({
  message_schema: z.string().optional(),
  shared_state_schemas: z.record(z.string(), z.string()).optional(),
  inter_agent_validation: z.boolean().optional(),
  communication_protocol: z.enum(["direct", "broadcast", "queue"]).optional(),
});

// Agent Registry Entry (rich agent metadata)
export const AgentRegistryEntrySchema = z.object({
  name: z.string(),
  owner: z.string(),
  purpose: z.string(),
  risk_tier: z.enum(["low", "medium", "high", "critical"]).optional(),
  eval_status: z.enum(["untested", "tested", "certified", "deprecated"]).default("untested"),
  version: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  dependencies: z.array(z.string()).optional(),
});

// Agent Registry (top-level agent catalog)
export const AgentRegistrySchema = z.object({
  agents: z.array(AgentRegistryEntrySchema),
  registry_version: z.string().default("1.0"),
  last_updated: z.string().optional(),
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
  agent_teams: z
    .array(
      z.object({
        team_name: z.string(),
        agents: z.array(z.string()),
        owner: z.string().optional(),
        purpose: z.string().optional(),
        risk_tier: z.enum(["low", "medium", "high", "critical"]).optional(),
        eval_status: z.enum(["untested", "tested", "certified", "deprecated"]).optional(),
        version: z.string().optional(),
        capabilities: z.array(z.string()).optional(),
      })
    )
    .optional(),
  agent_chains: z
    .array(
      z.object({
        chain_name: z.string(),
        sequence: z.array(z.string()),
        parallel_mode: z.boolean().optional(),
        state_schema: z.string().optional(),
        error_handler: z.string().optional(),
        timeout_ms: z.number().optional(),
        retry_policy: z
          .object({
            max_retries: z.number(),
            backoff_ms: z.number(),
          })
          .optional(),
      })
    )
    .optional(),
  persistent_memory: z
    .object({
      enabled: z.boolean().optional(),
      retention_policy: z.string().optional(),
      directory: z.string().optional(),
      access_control: z.array(z.string()).optional(),
      schema_validation: z.boolean().optional(),
      encryption: z.boolean().optional(),
    })
    .optional(),
  cross_agent_communication: CrossAgentCommunicationSchema.optional(),
});

// Phase 4: Observability & Cost

// Telemetry Layer
export const TelemetrySchema = z.object({
  enabled: z.boolean().default(true),
  provider: z.enum(["opentelemetry", "datadog", "newrelic", "prometheus", "cloudwatch"]).optional(),
  sampling_rate: z.number().min(0).max(1).optional(),
  trace_enabled: z.boolean().optional(),
  metrics_enabled: z.boolean().optional(),
  logs_enabled: z.boolean().optional(),
  custom_attributes: z.record(z.string(), z.string()).optional(),
  datadog_config: z
    .object({
      api_key_env: z.string().optional(),
      app_name: z.string().optional(),
      service_name: z.string().optional(),
    })
    .optional(),
  newrelic_config: z
    .object({
      license_key_env: z.string().optional(),
      app_name: z.string().optional(),
    })
    .optional(),
  otel_config: z
    .object({
      exporter_type: z.enum(["grpc", "http", "jaeger"]).optional(),
      endpoint: z.string().optional(),
      headers: z.record(z.string(), z.string()).optional(),
    })
    .optional(),
});

// Cost Tracking Layer
export const CostSchema = z.object({
  cost_tracking_enabled: z.boolean().default(true),
  cost_per_token_usd: z.number().optional(),
  monthly_budget_usd: z.number().optional(),
  per_session_limit_usd: z.number().optional(),
  per_agent_budgets: z
    .array(
      z.object({
        agent_name: z.string(),
        monthly_budget_usd: z.number(),
      })
    )
    .optional(),
  cost_attribution_level: z.enum(["agent", "skill", "rule"]).default("agent"),
  token_tracking_enabled: z.boolean().default(true),
  estimated_monthly_tokens: z.number().optional(),
});

// Metrics Layer
export const MetricsSchema = z.object({
  metrics_enabled: z.boolean().default(true),
  latency_baseline_ms: z.number().optional(),
  error_rate_threshold: z.number().min(0).max(1).optional(),
  success_rate_baseline: z.number().min(0).max(1).optional(),
  per_skill_metrics: z
    .array(
      z.object({
        skill_name: z.string(),
        avg_latency_ms: z.number().optional(),
        error_rate: z.number().optional(),
        execution_count: z.number().optional(),
      })
    )
    .optional(),
  custom_metrics: z
    .array(
      z.object({
        metric_name: z.string(),
        description: z.string().optional(),
        type: z.enum(["gauge", "counter", "histogram"]),
      })
    )
    .optional(),
  grafana_dashboard_uid: z.string().optional(),
  datadog_dashboard_id: z.string().optional(),
});

// Alerting Layer
export const AlertingSchema = z.object({
  alerting_enabled: z.boolean().default(true),
  policy_violations: z
    .array(
      z.object({
        policy_name: z.string(),
        condition: z.string(),
        action: z.string(),
        severity: z.enum(["info", "warning", "critical"]),
      })
    )
    .optional(),
  budget_overrun_alerts: z.boolean().optional(),
  anomaly_detection: z
    .object({
      enabled: z.boolean(),
      std_dev_threshold: z.number().optional(),
      min_baseline_samples: z.number().optional(),
    })
    .optional(),
  notification_channels: z
    .array(
      z.object({
        channel_type: z.enum(["slack", "pagerduty", "webhook", "email"]),
        endpoint: z.string(),
        webhook_auth: z.string().optional(),
        severity_filter: z.array(z.enum(["info", "warning", "critical"])).optional(),
      })
    )
    .optional(),
});

// Drift Detection Enhancement
export const SemanticDriftSchema = z.object({
  semantic_drift_enabled: z.boolean().default(true),
  behavioral_analysis_enabled: z.boolean().optional(),
  rule_effectiveness_tracking: z.boolean().optional(),
  cost_drift_detection: z.boolean().optional(),
  output_comparison_enabled: z.boolean().optional(),
  similarity_threshold: z.number().min(0).max(1).optional(),
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
  agent_registry: AgentRegistrySchema.optional(),
  telemetry: TelemetrySchema.optional(),
  cost: CostSchema.optional(),
  metrics: MetricsSchema.optional(),
  alerting: AlertingSchema.optional(),
  semantic_drift: SemanticDriftSchema.optional(),
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
export type ToolRegistryEntry = z.infer<typeof ToolRegistryEntrySchema>;
export type MCPServer = z.infer<typeof MCPServerSchema>;
export type Identity = z.infer<typeof IdentitySchema>;
export type Audit = z.infer<typeof AuditSchema>;
export type Compliance = z.infer<typeof ComplianceSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type CrossAgentCommunication = z.infer<typeof CrossAgentCommunicationSchema>;
export type AgentRegistryEntry = z.infer<typeof AgentRegistryEntrySchema>;
export type AgentRegistry = z.infer<typeof AgentRegistrySchema>;
export type Registry = z.infer<typeof RegistrySchema>;
export type Orchestration = z.infer<typeof OrchestrationSchema>;
export type Telemetry = z.infer<typeof TelemetrySchema>;
export type Cost = z.infer<typeof CostSchema>;
export type Metrics = z.infer<typeof MetricsSchema>;
export type Alerting = z.infer<typeof AlertingSchema>;
export type SemanticDrift = z.infer<typeof SemanticDriftSchema>;
export type BlueprintIR = z.infer<typeof BlueprintIRSchema>;

export function isV2(ir: BlueprintIR): boolean {
  return (
    ir.meta?.schema_version === "2.0" || ir.settings !== undefined || ir.mcp_servers !== undefined
  );
}
export function isV1(ir: BlueprintIR): boolean {
  return !isV2(ir);
}
