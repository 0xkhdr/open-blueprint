## ADDED Requirements

### Requirement: Unified BpError hierarchy
All errors thrown or propagated by bp SHALL use the `BpError` base class or one of its typed subclasses. Direct calls to `process.exit()` outside of the CLI entry point (`src/cli/index.ts`) are prohibited. The CLI entry point SHALL catch `BpError` instances and exit with the corresponding `exitCode` field.

#### Scenario: ValidationError exits with code 4 or 5
- **WHEN** `bp verify` encounters a structural validation failure
- **THEN** a `ValidationError` with `layer: "structural"` is thrown and the process exits with code 4
- **WHEN** `bp verify` encounters a semantic validation failure
- **THEN** a `ValidationError` with `layer: "semantic"` is thrown and the process exits with code 5

#### Scenario: Unexpected errors exit with code 1
- **WHEN** an unhandled exception reaches the CLI entry point
- **THEN** the exception is caught, logged as `error` level with stack trace, and the process exits with code 1

#### Scenario: ConfigError exits with code 3
- **WHEN** `.bp.json` contains invalid JSON or fails Zod schema validation
- **THEN** a `ConfigError` is thrown with a message identifying the invalid field and the process exits with code 3

#### Scenario: NetworkError exits with code 8 with retry context
- **WHEN** a marketplace or registry fetch fails after all retries are exhausted
- **THEN** a `NetworkError` is thrown containing `attemptCount`, `lastStatusCode` (if HTTP), and the process exits with code 8

### Requirement: Retry strategy for external network operations
All outbound HTTP calls to the template registry, marketplace, and rule library SHALL implement exponential backoff retry with jitter. The default retry policy SHALL be 3 attempts with a base delay of 500ms and maximum delay of 8000ms.

#### Scenario: Transient failure retried automatically
- **WHEN** a marketplace fetch returns HTTP 503 or a network timeout occurs
- **THEN** the client retries up to 3 times with exponential backoff before propagating a `NetworkError`

#### Scenario: 4xx errors not retried
- **WHEN** a registry fetch returns HTTP 404 or 401
- **THEN** the client does not retry and immediately propagates the error with the status code

#### Scenario: Retry attempts logged
- **WHEN** a retry is triggered
- **THEN** a `warn`-level log entry is emitted with `{ event: "retry", attempt: <n>, delayMs: <n>, operation: "<name>" }`

### Requirement: Graceful shutdown
The CLI process SHALL handle `SIGTERM` and `SIGINT` signals gracefully by completing any in-progress file writes, flushing log buffers, and exiting cleanly. No partial files SHALL be left on disk after an interrupted file write.

#### Scenario: SIGINT during init produces no partial files
- **WHEN** `bp init` is interrupted with Ctrl+C while writing scaffold files
- **THEN** any file write in progress is completed or rolled back, leaving no zero-byte or truncated files

#### Scenario: Log buffer flushed on exit
- **WHEN** the process receives SIGTERM
- **THEN** the pino logger's `flush()` method is called before `process.exit()` ensuring no log entries are lost

### Requirement: Error messages include resolution paths
Every `BpError` message presented to the user SHALL include: what went wrong, where (file path + line number when applicable), and at least one actionable resolution step.

#### Scenario: Validation error includes file and line
- **WHEN** `bp verify` fails on a specific `.claude/rules/style.md` file
- **THEN** the error output includes the file path and line number of the offending content

#### Scenario: Resolution hint present
- **WHEN** any bp command exits with a non-zero code
- **THEN** the last line of stderr contains a hint starting with "Fix:" or "Try:" or a pointer to `docs/errors.md#code-<n>`

### Requirement: Hook command fully implemented
The `bp hook` subcommand SHALL implement all of: `hook list`, `hook add`, `hook remove`, `hook validate`. The `hook validate` command SHALL detect and report dependency cycles in hook chains.

#### Scenario: hook list displays all registered hooks
- **WHEN** `bp hook list` runs in a directory with a `.claude/hooks/` directory
- **THEN** all hook files are listed with their trigger event, command, and enabled/disabled status

#### Scenario: hook remove deletes hook file
- **WHEN** `bp hook remove <name>` runs with a valid hook name
- **THEN** the corresponding hook file is deleted and a success message is emitted

#### Scenario: Dependency cycle detected and reported
- **WHEN** `bp hook validate` runs and detects a circular hook dependency (hook A triggers hook B which triggers hook A)
- **THEN** the command exits with code 4 and reports the cycle path in the error message
