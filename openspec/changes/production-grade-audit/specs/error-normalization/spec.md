## ADDED Requirements

### Requirement: Unified error normalization utility
The system SHALL provide a `normalizeError(e: unknown): Error` function exported from `src/utils/errors.ts` that converts any thrown value into an `Error` instance. If `e` is already an `Error`, it SHALL be returned as-is. If `e` is a string, it SHALL be wrapped in `new Error(e)`. All other values SHALL be wrapped via `new Error(String(e))`.

#### Scenario: Error instance passthrough
- **WHEN** `normalizeError` receives an `Error` instance
- **THEN** it SHALL return the same `Error` instance without wrapping

#### Scenario: String coercion
- **WHEN** `normalizeError` receives a plain string
- **THEN** it SHALL return `new Error(string)` with the string as the message

#### Scenario: Unknown value coercion
- **WHEN** `normalizeError` receives a non-Error, non-string value (number, object, null, undefined)
- **THEN** it SHALL return `new Error(String(value))`

### Requirement: Replace duplicated error-coercion pattern at call-sites
All existing `e instanceof Error ? e.message : String(e)` patterns in the codebase SHALL be replaced with calls to `normalizeError(e).message`. No new occurrences of the raw ternary pattern SHALL be introduced.

#### Scenario: Call-site uses normalizeError
- **WHEN** a catch block needs the error message
- **THEN** it SHALL use `normalizeError(e).message` not `e instanceof Error ? e.message : String(e)`

### Requirement: Governance layer error mapping utility
The system SHALL provide a `mapLayerErrors(layerName: string, rawErrors: unknown[]): ValidationError[]` function (module-private to `validator/index.ts`) that maps raw layer errors to typed `ValidationError` objects tagged with the layer name. `validateGovernance` SHALL use this function for every governance layer rather than inline boilerplate.

#### Scenario: Boilerplate eliminated per layer
- **WHEN** `validateGovernance` processes any governance layer (settings, commands, MCP, identity, audit, compliance, risk, registry, orchestration)
- **THEN** it SHALL call `mapLayerErrors(layerName, errors)` rather than repeating mapping code inline

#### Scenario: Layer name preserved in error
- **WHEN** `mapLayerErrors('mcp', [rawErr])` is called
- **THEN** the returned `ValidationError` SHALL include `layer: 'mcp'` in its metadata
