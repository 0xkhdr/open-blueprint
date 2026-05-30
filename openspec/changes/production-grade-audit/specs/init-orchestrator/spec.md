## ADDED Requirements

### Requirement: InitOrchestrator encapsulates init business logic
The system SHALL provide a `class InitOrchestrator` in `src/cli/orchestrators/init.ts` that accepts an `InitContext` object (containing `cwd: string`, `options: InitOptions`, `fs: FileSystem`, `logger: Logger`) and exposes a `run(): Promise<{ exitCode: number; messages: OrchestratorMessage[] }>` method. All business logic currently in the `init.ts` command action (backend resolution, fingerprinting, templating, file writes) SHALL be moved into this class. The orchestrator SHALL NOT import `chalk`, `ora`, or `readline` — I/O rendering is the adapter's responsibility.

#### Scenario: Orchestrator returns exit code without calling process.exit
- **WHEN** `new InitOrchestrator(context).run()` completes successfully
- **THEN** it SHALL resolve with `{ exitCode: 0, messages: [...] }` and SHALL NOT call `process.exit`

#### Scenario: Orchestrator returns non-zero exit code on error
- **WHEN** `new InitOrchestrator(context).run()` encounters a known error (e.g., backend not found)
- **THEN** it SHALL resolve with `{ exitCode: <non-zero>, messages: [{ level: 'error', text: '...' }] }`

#### Scenario: Orchestrator is unit-testable without I/O
- **WHEN** tests instantiate `InitOrchestrator` with an `InMemoryFileSystem` and a no-op logger
- **THEN** tests SHALL exercise the full orchestrator logic without file system or console side effects

### Requirement: InitCommand adapter is thin CLI wiring
The `src/cli/commands/init.ts` file SHALL be reduced to a thin `InitCommand` adapter responsible only for: parsing CLI args into `InitContext`, instantiating `InitOrchestrator`, rendering `OrchestratorMessage[]` via chalk/ora, and returning the exit code. It SHALL contain no business logic.

#### Scenario: init.ts action handler delegates to orchestrator
- **WHEN** the `init` command action is invoked
- **THEN** it SHALL construct an `InitContext`, call `new InitOrchestrator(context).run()`, render the messages, and return the exit code

#### Scenario: detect() called exactly once per init invocation
- **WHEN** the `init` command processes a project
- **THEN** `detect(cwd)` SHALL be called exactly once; the fingerprint SHALL be passed to all downstream operations that need it
