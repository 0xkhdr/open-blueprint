## ADDED Requirements

### Requirement: Plugins execute inside vm.Script sandbox
Custom validator plugins listed in `ProjectConfigSchema.plugins` SHALL be loaded and executed inside a Node.js `vm.Script` context. The sandbox global object MUST NOT expose `process`, `require`, `__dirname`, `__filename`, `module`, or `exports`. Plugins receive a stable `PluginAPI` object injected at context creation.

#### Scenario: Plugin cannot access process
- **WHEN** a plugin script attempts to access `process.env` or `process.exit()`
- **THEN** the access results in a `ReferenceError` inside the sandbox
- **THEN** the error is caught and reported as a plugin validation error
- **THEN** `bp` does not crash

#### Scenario: Plugin cannot require modules
- **WHEN** a plugin script calls `require('fs')` or `require('child_process')`
- **THEN** the call results in a `ReferenceError` inside the sandbox
- **THEN** the plugin is marked as failed with a sandboxing violation error

#### Scenario: Plugin receives PluginAPI
- **WHEN** a valid plugin script is loaded
- **THEN** it has access to a `PluginAPI` object with at least `{ validate, log, error }` methods
- **THEN** it can call `PluginAPI.validate(result)` to report validation outcomes

### Requirement: Plugin execution is time-bounded
Plugin execution SHALL be wrapped in a `Promise.race` with `VALIDATION_TIMEOUT_MS`. If a plugin exceeds the timeout, its execution is abandoned and a `PluginTimeoutError` is thrown.

#### Scenario: Plugin timeout fires
- **WHEN** a plugin script enters an infinite loop
- **THEN** execution is abandoned after `VALIDATION_TIMEOUT_MS` milliseconds
- **THEN** `bp` reports a `PluginTimeoutError` and continues with remaining plugins

#### Scenario: Fast plugin completes normally
- **WHEN** a plugin script completes within the timeout
- **THEN** its `PluginAPI.validate()` result is incorporated into the validation report
- **THEN** no timeout error is thrown

### Requirement: Plugin loading errors are isolated
A plugin that fails to parse, compile, or initialize SHALL produce a `PluginLoadError` scoped to that plugin only. Other plugins and the core validation pipeline SHALL continue unaffected.

#### Scenario: Syntax error in plugin
- **WHEN** a plugin file contains a JavaScript syntax error
- **THEN** loading that plugin produces a `PluginLoadError`
- **THEN** remaining plugins in `ProjectConfigSchema.plugins` are still loaded and executed

#### Scenario: Plugin load error surfaced in doctor
- **WHEN** `bp doctor` is run and a plugin fails to load
- **THEN** the doctor output includes a warning for the failing plugin with the error message
