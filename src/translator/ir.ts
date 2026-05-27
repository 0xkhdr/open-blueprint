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

export const BlueprintIRSchema = z.object({
  version: z.literal("1.0"),
  spatial_anchor: SpatialAnchorSchema,
  personas: z.array(PersonaSchema),
  rules: z.array(RuleSchema),
  skills: z.array(SkillSchema),
  hooks: z.array(HookSchema),
  meta: MetaSchema,
});

export type SpatialAnchor = z.infer<typeof SpatialAnchorSchema>;
export type Persona = z.infer<typeof PersonaSchema>;
export type Rule = z.infer<typeof RuleSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Hook = z.infer<typeof HookSchema>;
export type Meta = z.infer<typeof MetaSchema>;
export type BlueprintIR = z.infer<typeof BlueprintIRSchema>;
