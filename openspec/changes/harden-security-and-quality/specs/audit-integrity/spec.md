## ADDED Requirements

### Requirement: Each audit log entry SHALL carry an HMAC-SHA256 signature
When writing an audit log entry, the system SHALL compute `HMAC-SHA256(JSON.stringify(entry), key)` where `key` is loaded from the `BP_AUDIT_HMAC_KEY` environment variable. The resulting hex digest SHALL be appended to the log entry as a `sig` field before the line is written. If `BP_AUDIT_HMAC_KEY` is not set, the system SHALL emit a Pino `warn` log `"Audit HMAC key not configured; log integrity cannot be verified"` and write the entry with `sig: null`.

#### Scenario: HMAC key set — entry is signed
- **WHEN** `BP_AUDIT_HMAC_KEY=abc123` is set and an audit entry is written
- **THEN** the written JSON line contains a non-null `sig` field matching `HMAC-SHA256(JSON.stringify(entry_without_sig), "abc123")`

#### Scenario: HMAC key not set — warning emitted, entry written with null sig
- **WHEN** `BP_AUDIT_HMAC_KEY` is not set and an audit entry is written
- **THEN** a Pino `warn` event is emitted and the entry is written with `sig: null`

#### Scenario: Tampered entry fails verification
- **WHEN** a log entry's `content` field is modified after writing
- **THEN** re-computing HMAC over the modified entry yields a different digest than the stored `sig`

### Requirement: Audit log entries SHALL reuse the command's correlation ID
The `AuditLogger` SHALL accept a `correlationId` parameter at construction time (or via a `setCorrelationId(id: string)` method). Each written entry SHALL carry this ID in the `correlationId` field. The system SHALL NOT generate a new UUID per entry.

#### Scenario: Correlation ID propagates to all entries in a command
- **WHEN** a `bp init` command runs with correlation ID `req-abc`
- **THEN** all audit entries written during that command carry `correlationId: "req-abc"`

#### Scenario: AuditLogger without correlation ID falls back to a session ID
- **WHEN** no correlation ID is provided at construction
- **THEN** all entries carry the same session-scoped UUID (consistent within a process run, not per-entry random)
