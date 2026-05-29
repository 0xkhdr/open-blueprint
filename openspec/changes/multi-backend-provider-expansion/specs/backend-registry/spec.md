## ADDED Requirements

### Requirement: Registry exports all 28 backend configs
`src/backends/registry.ts` SHALL export a `const BACKENDS` array typed `as const` containing exactly 28 `BackendConfig` entries. Each entry SHALL include: `id` (kebab-case string), `name` (human-readable string), `skillsPath` (relative path string), `commandsPath` (relative path string or `null`), `commandSyntax` (`"colon" | "hyphen" | "bare" | "skill"`), `fileExtension` (`.md`, `.prompt`, `.prompt.md`, `.toml`, or `null`), `supportsCommands` (boolean), `supportsSkills` (boolean). Optional fields: `globalHomeEnv` (string), `fallbackGlobalPath` (string), `note` (string).

#### Scenario: All 28 IDs resolve
- **WHEN** `getBackend(id)` is called for any of the 28 canonical backend IDs
- **THEN** it returns the matching `BackendConfig` object without throwing

#### Scenario: Unknown ID throws
- **WHEN** `getBackend("unknown-tool")` is called
- **THEN** it throws an error with message containing the unknown ID

#### Scenario: `listBackendIds()` returns complete set
- **WHEN** `listBackendIds()` is called
- **THEN** it returns an array of exactly 28 strings matching all canonical IDs

### Requirement: Registry is the single source for supported backend enumeration
All code that needs the list of valid backend IDs (CLI validation, `SUPPORTED_BACKENDS`, doctor checks) SHALL import from `src/backends/registry.ts`. No other file SHALL hardcode a list of backend IDs.

#### Scenario: CLI init derives supported list from registry
- **WHEN** `bp init` validates a backend argument
- **THEN** it uses `listBackendIds()` from the registry rather than a local constant

#### Scenario: Skill-only backends are queryable as a group
- **WHEN** `getSkillOnlyBackends()` is called
- **THEN** it returns the subset of backends where `supportsCommands === false`
