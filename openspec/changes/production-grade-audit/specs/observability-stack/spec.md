## ADDED Requirements

### Requirement: Structured logger replaces console calls
All `console.log`, `console.warn`, `console.error`, and `console.debug` calls in `src/` SHALL be replaced with calls to the centralized `pino` logger exported from `src/logger.ts`. Direct `console.*` usage SHALL be prohibited in source code (enforced via Biome lint rule or custom ESLint rule).

#### Scenario: Log level controlled by environment variable
- **WHEN** `BP_LOG_LEVEL=debug` is set before running any bp command
- **THEN** debug-level log entries are emitted including engine internals
- **WHEN** `BP_LOG_LEVEL` is unset
- **THEN** only `info`, `warn`, and `error` entries are emitted

#### Scenario: Silent in test environment
- **WHEN** tests run with `NODE_ENV=test` and no explicit `BP_LOG_LEVEL`
- **THEN** no log output is emitted to stdout/stderr, preventing test output noise

#### Scenario: Pretty output in development
- **WHEN** `NODE_ENV=development` or TTY is detected
- **THEN** `pino-pretty` transport formats logs with colors and human-readable timestamps

#### Scenario: JSON output in CI
- **WHEN** `NODE_ENV=production` or non-TTY environment
- **THEN** logs are emitted as newline-delimited JSON consumable by log aggregators

### Requirement: Correlation IDs on all log entries
Every log entry emitted during a single CLI command invocation SHALL carry a `correlationId` field containing a UUID generated at process startup. Correlation IDs enable grouping of all log entries from a single invocation in log aggregators.

#### Scenario: Correlation ID present on every entry
- **WHEN** any bp command runs and produces log output
- **THEN** every log line contains a `correlationId` field with the same UUID value for that invocation

#### Scenario: Correlation ID changes between invocations
- **WHEN** two separate bp command invocations run sequentially
- **THEN** each invocation produces a distinct `correlationId` value

### Requirement: bp health command
The CLI SHALL expose a `bp health` command that checks the integrity of the local bp installation and configuration, emitting a structured health report and exiting with code 0 (healthy) or 10 (unhealthy).

#### Scenario: Healthy installation returns exit 0
- **WHEN** `bp health` runs with a valid configuration and all engines accessible
- **THEN** the command exits with code 0 and outputs a health report showing all checks as PASS

#### Scenario: Missing config returns exit 10
- **WHEN** `bp health` runs in a directory without a `.bp.json` and without global config
- **THEN** the command exits with code 10 and the report shows the config check as FAIL with a resolution hint

#### Scenario: JSON output mode
- **WHEN** `bp health --json` runs
- **THEN** output is a JSON object with fields: `status` ("healthy"|"unhealthy"), `checks` (array of `{name, status, message}`), `version`, `correlationId`

### Requirement: Command timing metrics
Each CLI command SHALL emit a log entry at `info` level upon completion containing execution duration in milliseconds, command name, and exit status. This enables CI pipeline performance tracking.

#### Scenario: Timing entry emitted on success
- **WHEN** `bp verify` completes successfully
- **THEN** a log entry is emitted with `{ event: "command.complete", command: "verify", durationMs: <n>, exitCode: 0 }`

#### Scenario: Timing entry emitted on failure
- **WHEN** `bp verify` fails with a validation error
- **THEN** a log entry is emitted with `{ event: "command.complete", command: "verify", durationMs: <n>, exitCode: 4 }` before the process exits

### Requirement: Sensitive field redaction
The logger SHALL automatically redact the values of any log entry fields whose key names match a predefined list of sensitive field names, replacing values with `[REDACTED]`.

#### Scenario: API key field redacted
- **WHEN** a log entry is created containing a field named `apiKey` with a real value
- **THEN** the emitted JSON contains `"apiKey": "[REDACTED]"` instead of the real value

#### Scenario: Non-sensitive fields unaffected
- **WHEN** a log entry is created containing fields like `filePath`, `command`, `duration`
- **THEN** those fields are emitted with their actual values unchanged

#### Scenario: Redaction list covers all sensitive patterns
- **WHEN** any log entry is emitted
- **THEN** fields named `apiKey`, `token`, `secret`, `password`, `credential`, `auth`, `authorization`, `cookie`, `privateKey` are redacted
