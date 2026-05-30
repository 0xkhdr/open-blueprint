## ADDED Requirements

### Requirement: Validator SHALL enforce maximum file count before processing
Before starting any validation layer, the system SHALL count all blueprint files to be validated. If the count exceeds `MAX_VALIDATION_FILES` (default: 1000, overridable via `BP_MAX_VALIDATION_FILES` env var), the system SHALL abort with a `ResourceLimitError` listing the actual count and the configured limit.

#### Scenario: Repo within file limit proceeds normally
- **WHEN** the blueprint contains 50 files and `MAX_VALIDATION_FILES` is 1000
- **THEN** validation runs to completion without resource errors

#### Scenario: Repo exceeding file limit is rejected before I/O
- **WHEN** the blueprint contains 1500 files and `MAX_VALIDATION_FILES` is 1000
- **THEN** `ResourceLimitError` is thrown immediately with message `"File count 1500 exceeds limit 1000"` and no file content is read

#### Scenario: Limit is overridable via environment variable
- **WHEN** `BP_MAX_VALIDATION_FILES=5000` is set and the blueprint contains 2000 files
- **THEN** validation proceeds without error

### Requirement: Validator SHALL enforce maximum total byte size before processing
Before starting validation, the system SHALL sum the sizes of all blueprint files. If the total exceeds `MAX_VALIDATION_BYTES` (default: 52,428,800 bytes / 50 MB, overridable via `BP_MAX_VALIDATION_BYTES`), the system SHALL abort with a `ResourceLimitError`.

#### Scenario: Total size within limit proceeds
- **WHEN** total blueprint file size is 5 MB and limit is 50 MB
- **THEN** validation runs to completion

#### Scenario: Total size exceeding limit is rejected
- **WHEN** total blueprint file size is 60 MB and limit is 50 MB
- **THEN** `ResourceLimitError` is thrown with message indicating bytes vs limit

### Requirement: Validator SHALL time out after a configurable duration
The validation pipeline SHALL be wrapped in a `Promise.race` against a timeout of `VALIDATION_TIMEOUT_MS` (default: 30,000 ms, overridable via `BP_VALIDATION_TIMEOUT_MS`). On timeout, the system SHALL abort with a `ValidationTimeoutError` and log the elapsed time via Pino at `warn` level.

#### Scenario: Fast validation completes before timeout
- **WHEN** validation completes in 2 seconds and timeout is 30,000 ms
- **THEN** no timeout error is thrown and results are returned normally

#### Scenario: Slow validation is aborted at timeout
- **WHEN** validation is artificially delayed beyond 30,000 ms
- **THEN** `ValidationTimeoutError` is thrown and elapsed time is logged

#### Scenario: Timeout is overridable for large repos
- **WHEN** `BP_VALIDATION_TIMEOUT_MS=120000` is set
- **THEN** validation runs for up to 120 seconds before timing out
