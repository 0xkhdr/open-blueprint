## ADDED Requirements

### Requirement: process.exit() called only at the parseAsync boundary
All command action handlers SHALL return `Promise<number>` representing the exit code. The top-level `parseAsync()` call in `cli/index.ts` SHALL be the only location in the codebase that calls `process.exit(code)`. No other file in `src/` SHALL call `process.exit()` directly.

#### Scenario: Command action returns exit code instead of calling process.exit
- **WHEN** a command action encounters an error condition
- **THEN** it SHALL return the appropriate exit code as a resolved Promise value, not call `process.exit()`

#### Scenario: Successful command returns 0
- **WHEN** a command action completes without error
- **THEN** it SHALL return `Promise.resolve(0)`

#### Scenario: parseAsync boundary handles termination
- **WHEN** a command action resolves with a non-zero exit code
- **THEN** `cli/index.ts` SHALL call `process.exit(code)` exactly once after `parseAsync` resolves

#### Scenario: CI lint rule enforces no interior process.exit
- **WHEN** a PR introduces `process.exit(` in any file under `src/` except `src/cli/index.ts`
- **THEN** the CI lint check SHALL fail

### Requirement: ESM-only module loading in cli/index.ts
The `require("../security/audit.js")` call with ESM fallback in `cli/index.ts` SHALL be replaced with a standard dynamic `import('../security/audit.js')` with a proper error boundary. No `require()` calls SHALL exist in any file under `src/`.

#### Scenario: Audit module loads via dynamic import
- **WHEN** `cli/index.ts` loads the security audit module
- **THEN** it SHALL use `await import('../security/audit.js')` or a top-level static import

#### Scenario: Import failure surfaces as a descriptive error
- **WHEN** the security audit module fails to load
- **THEN** a descriptive error SHALL be thrown or logged; the catch block SHALL NOT be empty
