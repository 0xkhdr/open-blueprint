## ADDED Requirements

### Requirement: resolveCodexCommandsPath validates env-var-derived paths (CWE-22 / OWASP A01)
The `resolveCodexCommandsPath` function SHALL apply `path.resolve(path.normalize(envValue + '/prompts'))` and then assert the resolved path starts with the expected base directory (`path.resolve(envValue)`). If the boundary check fails, the function SHALL throw a typed `SecurityError` (extending the existing error hierarchy) with message `"Path traversal detected in environment variable"`. No file system access SHALL occur after a failed boundary check.

#### Scenario: Clean env var resolves normally
- **WHEN** `resolveCodexCommandsPath` receives an env var value of `/home/user/.codex`
- **THEN** it SHALL resolve to `/home/user/.codex/prompts` and proceed normally

#### Scenario: Traversal sequence in env var is rejected
- **WHEN** `resolveCodexCommandsPath` receives an env var value containing `../` sequences that escape the base directory
- **THEN** it SHALL throw `SecurityError` with `"Path traversal detected in environment variable"`

#### Scenario: Null/undefined env var handled safely
- **WHEN** the expected env var is not set (undefined)
- **THEN** `resolveCodexCommandsPath` SHALL throw a descriptive configuration error rather than concatenating `undefined` into a path

### Requirement: promptUser output validated before use in file paths
Raw strings returned by `promptUser` from stdin SHALL be validated before use in file system paths or config values. Validation SHALL enforce: maximum length of 256 characters, rejection of null bytes, rejection of Unicode control characters (U+0000–U+001F, U+007F).

#### Scenario: Valid user input passes validation
- **WHEN** `promptUser` returns a normal string like `my-project`
- **THEN** it SHALL pass validation and be usable in downstream path operations

#### Scenario: Null byte in user input rejected
- **WHEN** `promptUser` returns a string containing a null byte (`\0`)
- **THEN** the validator SHALL throw an `InputValidationError` before the string reaches any file path operation

#### Scenario: Overlong user input rejected
- **WHEN** `promptUser` returns a string longer than 256 characters
- **THEN** the validator SHALL throw an `InputValidationError`
