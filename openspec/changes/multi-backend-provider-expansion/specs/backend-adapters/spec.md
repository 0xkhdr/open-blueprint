## ADDED Requirements

### Requirement: 18 new translator adapters cover all remaining backends
`src/translator/adapters/` SHALL contain adapter implementations for each of the 18 new backends: amazon-q, auggie, bob, cline, codebuddy, continue, costrict, crush, factory, forgecode, iflow, junie, kilocode, kimi, lingma, opencode, qoder, roocode, trae, windsurf.

#### Scenario: All 28 backend IDs resolvable in translator
- **WHEN** `parseBlueprint(root, backendId)` is called for any of the 28 backend IDs
- **THEN** it resolves an adapter and returns a `BlueprintIR` without throwing `Unknown backend`

#### Scenario: renderBlueprint for all 28 backends
- **WHEN** `renderBlueprint(ir, root, backendId)` is called for any of the 28 backend IDs
- **THEN** it writes the expected files without throwing

### Requirement: New adapters extend base class matching their backend group
Adapters for standard markdown backends SHALL extend a common `MarkdownAdapter` base. TOML adapters extend `TomlCommandAdapter`. Skill-only adapters extend `SkillOnlyAdapter`. Prompt-md adapters extend `PromptMdAdapter`.

#### Scenario: SkillOnlyAdapter render throws on command render
- **WHEN** `renderCommand()` is called on a `SkillOnlyAdapter` subclass
- **THEN** it throws an error indicating the backend does not support command files

### Requirement: New adapters use registry config for all path construction
Path construction in new adapters (skills dir, commands dir, file extension) SHALL be derived from `BackendConfig` imported from the registry, not hardcoded strings.

#### Scenario: Adapter path matches registry config
- **WHEN** the `WindsurfAdapter` constructs its commands path
- **THEN** the path matches `BackendConfig.commandsPath` from the registry entry for `windsurf`
