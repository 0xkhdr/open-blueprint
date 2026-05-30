## ADDED Requirements

### Requirement: Audit log failures surface on stderr, not silently swallowed
The `preAction` hook in `cli/index.ts` that calls `logAudit` SHALL replace the empty `catch(() => {})` with a catch handler that writes a diagnostic line to `process.stderr`. The diagnostic SHALL include the word `[audit]`, the word `FAILED`, and the error message. The user command SHALL still execute after an audit failure — audit failure is non-blocking.

#### Scenario: Audit failure writes to stderr
- **WHEN** `logAudit` throws during the `preAction` hook
- **THEN** a line matching `/\[audit\] FAILED:/` SHALL be written to `process.stderr`

#### Scenario: Audit failure does not block user command
- **WHEN** `logAudit` throws during the `preAction` hook
- **THEN** the command action SHALL still execute and produce its normal output

#### Scenario: Audit success produces no stderr output
- **WHEN** `logAudit` succeeds
- **THEN** no `[audit]` line SHALL appear on `process.stderr`

### Requirement: Audit log failure uses normalizeError for message extraction
The stderr diagnostic written on audit failure SHALL use `normalizeError(e).message` to safely extract the error message regardless of what type was thrown.

#### Scenario: Non-Error thrown from logAudit
- **WHEN** `logAudit` rejects with a plain string `"disk full"`
- **THEN** the stderr line SHALL include `disk full` as the message (not `[object Object]` or similar)
