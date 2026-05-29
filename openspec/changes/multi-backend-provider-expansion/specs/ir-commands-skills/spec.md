## ADDED Requirements

### Requirement: `BlueprintIR` meta supports `target_backends` array
`MetaSchema` in `src/translator/ir.ts` SHALL add an optional `target_backends` field (string array) alongside the existing `target_backend` string. When `target_backends` is populated, it represents all backends for a multi-backend export operation.

#### Scenario: Multi-backend IR carries all target IDs
- **WHEN** a `BlueprintIR` is constructed for a `bp init --tools claude,cursor` run
- **THEN** `ir.meta.target_backends` contains `["claude","cursor"]`

#### Scenario: Single-backend IR backwards compatible
- **WHEN** a `BlueprintIR` is constructed for a single backend
- **THEN** `ir.meta.target_backend` is set as before and `target_backends` may be omitted

### Requirement: `CommandSyntaxAdapter` invocation patterns available at render time
The render pipeline SHALL have access to the correct invocation pattern string for the target backend when rendering command file templates. This SHALL be provided via the `CommandSyntaxAdapter` rather than stored in the IR.

#### Scenario: Template context includes commandPrefix
- **WHEN** a command file template is rendered for `cursor`
- **THEN** the template context includes `commandPrefix: "/opsx-"` derived from `CommandSyntaxAdapter`

#### Scenario: Skill-only backend template context has no commandPrefix
- **WHEN** a SKILL.md template is rendered for `kimi`
- **THEN** the template context includes `isSkillOnly: true` and the skill-specific invocation string
