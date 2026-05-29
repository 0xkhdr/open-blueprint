## 1. Spec Foundation Documentation

- [x] 1.1 Create `docs/nfrs.md` with performance budgets (command latency), reliability targets, and OWASP compliance statements
- [x] 1.2 Create `docs/adr/` directory and write ADR-001 through ADR-006 covering: TypeScript, Vitest, pino, Commander, Zod, Handlebars choices
- [x] 1.3 Create `docs/api/detector.md` with `Fingerprint` Zod schema, detection algorithm inputs, and two usage examples
- [x] 1.4 Create `docs/api/validator.md` with four validation layer descriptions, `ValidationResult` types, exit code mappings, and drift state machine
- [x] 1.5 Create `docs/api/translator.md` with `BlueprintIR` schema, adapter identifiers, and round-trip conversion example
- [x] 1.6 Create `docs/api/templater.md` with template context schema, Handlebars helper catalogue, and rendering lifecycle
- [x] 1.7 Create `docs/data-models.md` documenting `Fingerprint`, `BlueprintIR`, `ValidationResult`, `RulePack` with field descriptions and JSON examples
- [x] 1.8 Create `docs/errors.md` with the full exit code registry (codes 0–10): name, description, example trigger, and resolution steps
- [x] 1.9 Update `docs/commands.md` to link each command's error section to `docs/errors.md#code-<n>`
- [x] 1.10 Update `README.md` to add links to `docs/nfrs.md` and `docs/errors.md` in the documentation index

## 2. Structured Logger (`src/logger.ts`)

- [x] 2.1 Add `pino` and `pino-pretty` as dependencies (`npm install pino && npm install -D pino-pretty`)
- [x] 2.2 Create `src/logger.ts` exporting a `pino` logger with: level from `BP_LOG_LEVEL` (default `info`), `silent` when `NODE_ENV=test`, `pino-pretty` transport when TTY detected, JSON otherwise
- [x] 2.3 Add `AsyncLocalStorage`-based correlation ID injection to `src/logger.ts`; generate UUID per process invocation at CLI entry point
- [x] 2.4 Configure `redact` option in `pino` covering: `apiKey`, `token`, `secret`, `password`, `credential`, `auth`, `authorization`, `cookie`, `privateKey`
- [x] 2.5 Add a Biome lint rule (or `no-restricted-globals` equivalent) to prohibit direct `console.*` usage in `src/`
- [x] 2.6 Replace all `console.*` calls in `src/detector/` with logger calls at appropriate levels
- [x] 2.7 Replace all `console.*` calls in `src/validator/` with logger calls at appropriate levels
- [x] 2.8 Replace all `console.*` calls in `src/translator/` with logger calls at appropriate levels
- [x] 2.9 Replace all `console.*` calls in `src/templater/`, `src/ecosystem/`, `src/dx/`, `src/multiagent/`, `src/observability/` with logger calls
- [x] 2.10 Replace all `console.*` calls in `src/cli/commands/` with logger calls (keep spinner/chalk output for UX; only diagnostic output moves to logger)
- [x] 2.11 Add command timing: emit `{ event: "command.complete", command, durationMs, exitCode }` from CLI entry point after each command completes
- [x] 2.12 Add unit tests for `src/logger.ts`: level control via env var, redaction of sensitive fields, correlation ID presence

## 3. Error Taxonomy (`src/errors.ts`)

- [x] 3.1 Create `src/errors.ts` with `BpError` base class carrying `exitCode: number`, `code: string`, `resolution: string`
- [x] 3.2 Implement typed subclasses: `ValidationError` (codes 4/5 by layer), `DetectionError` (exit 1), `TranslationError` (exit 7), `TemplateError` (exit 3), `NetworkError` (exit 8, with `attemptCount`/`lastStatusCode`), `ConfigError` (exit 3), `PermissionError` (exit 9), `HealthError` (exit 10)
- [x] 3.3 Update CLI entry point (`src/cli/index.ts`) to catch `BpError` and exit with `error.exitCode`; catch unknown errors and exit with 1 after logging stack trace
- [x] 3.4 Replace all direct `process.exit()` calls in `src/validator/` with `throw new ValidationError(...)`
- [x] 3.5 Replace all direct `process.exit()` calls in `src/detector/` with typed `BpError` throws
- [x] 3.6 Replace all direct `process.exit()` calls in `src/translator/` with `throw new TranslationError(...)`
- [x] 3.7 Replace all direct `process.exit()` calls in `src/cli/commands/` with typed throws (keep `ConfigError` for arg validation)
- [x] 3.8 Ensure every `BpError` message ends with "Fix: ..." or "See: docs/errors.md#code-<n>"
- [x] 3.9 Write unit tests for each `BpError` subclass verifying `exitCode`, `name`, and message format
- [x] 3.10 Implement retry utility `src/utils/retry.ts`: exponential backoff with jitter, 3 attempts, 500ms base, 8000ms max; used by marketplace/registry fetches
- [x] 3.11 Add `SIGTERM`/`SIGINT` handlers in CLI entry point: call `logger.flush()` and complete in-progress writes before exit
- [x] 3.12 Update `vitest.config.ts` to set `process.env.NODE_ENV = "test"` so logger is silent during all test runs

## 4. Stub Completion

- [x] 4.1 Review `src/translator/adapters/pi.ts` and complete the Pi AI schema field mapping based on integration test fixtures
- [x] 4.2 Review `src/translator/adapters/generic.ts` and complete missing field normalization for fallback adapter
- [x] 4.3 Review `src/translator/adapters/codex.ts` and complete tool-use serialization for Codex format
- [x] 4.4 Review `src/validator/hook.ts` and complete the hook dependency graph cycle detection using topological sort (DFS with gray/black marking)
- [x] 4.5 Implement `bp hook list` subcommand in `src/cli/commands/hook.ts`: list hook files with trigger, command, and enabled status
- [x] 4.6 Implement `bp hook remove <name>` subcommand: delete hook file with confirmation prompt
- [x] 4.7 Implement `bp hook validate` subcommand: run hook dependency cycle detection, report cycle path on failure
- [x] 4.8 Add unit tests for Pi adapter happy path, invalid input, and error propagation
- [x] 4.9 Add unit tests for generic adapter field normalization with missing optional fields
- [x] 4.10 Add unit tests for Codex adapter tool-use serialization
- [x] 4.11 Add unit tests for hook cycle detection: acyclic graph (pass), direct cycle (fail), indirect cycle (fail), self-reference (fail)

## 5. Security Hardening

- [x] 5.1 Audit all CLI commands that accept path arguments; add `resolveAndValidatePath(input, allowedBase)` utility in `src/utils/paths.ts`
- [x] 5.2 Apply path validation to all `--output`, `--dir`, `--file`, and `--template` flags across CLI commands
- [x] 5.3 Add template variable sanitization in `src/templater/index.ts`: strip/escape shell metacharacters from user-supplied variables before Handlebars render
- [x] 5.4 Add URL scheme validation in registry/marketplace fetch code: reject non-`https://` URLs with `PermissionError` (exit 9)
- [x] 5.5 Add audit log emission calls in `src/templater/` for each file write: `{ event: "file.write", path, operation, user }`
- [x] 5.6 Add `.github/workflows/sast.yml` with CodeQL analysis on `push` to `main` and `pull_request` targeting `main`, language pack `javascript-typescript`
- [x] 5.7 Install `@cyclonedx/cyclonedx-npm` as devDependency and add `npm run sbom` script to `package.json`
- [x] 5.8 Add unit tests for `resolveAndValidatePath`: path traversal attempt, symlink escape, valid path within allowed base
- [x] 5.9 Add unit tests for template variable sanitization: clean input passthrough, metacharacter stripping

## 6. `bp health` Command

- [x] 6.1 Create `src/cli/commands/health.ts` implementing `bp health [--json]`
- [x] 6.2 Implement health checks: (a) config file parseable, (b) all engine modules importable, (c) template registry reachable (HTTP HEAD with 5s timeout), (d) no conflicting `.bp.json` and global config
- [x] 6.3 Exit with code 0 when all checks PASS, code 10 when any FAIL
- [x] 6.4 JSON output mode: `{ status, checks: [{name, status, message}], version, correlationId }`
- [x] 6.5 Register `health` command in `src/cli/index.ts`
- [x] 6.6 Add unit tests for health command: all-pass scenario, config-missing scenario, JSON output format

## 7. Test Coverage Expansion

- [x] 7.1 Measure current branch coverage baseline: `npm run test:coverage` and record the percentage
- [x] 7.2 Update `vitest.config.ts` to add coverage thresholds: `branches: 90, lines: 90, functions: 90`
- [x] 7.3 Create `tests/e2e/` directory with shared `setup.ts` for temp dir management
- [x] 7.4 Write E2E test `tests/e2e/init.test.ts`: golden path for `bp init claude` against `node-express` fixture
- [x] 7.5 Write E2E test `tests/e2e/verify.test.ts`: passing case (clean scaffold) and failing case (broken rule file)
- [x] 7.6 Write E2E test `tests/e2e/translate.test.ts`: Claude → Cursor → Claude round-trip with semantic preservation check
- [x] 7.7 Write E2E test `tests/e2e/drift.test.ts`: clean state (exit 0) and drifted state (exit 6) using fixture with intentionally modified files
- [x] 7.8 Write snapshot test `tests/unit/cli/health.snapshot.test.ts` for `bp health` output format
- [x] 7.9 Write snapshot test `tests/unit/cli/doctor.snapshot.test.ts` for `bp doctor` output against `node-express` fixture
- [x] 7.10 Update fuzz tests in `tests/fuzz/` to cover the new `BpError` types: verify no unhandled exceptions escape any engine public API
- [x] 7.11 Fill unit test gaps surfaced by coverage gate: prioritize error path branches in validator, translator adapters, and config parser
- [x] 7.12 Add `tests/e2e/` to CI test script (`npm run test:e2e`) and register as a separate CI job step

## 8. DevOps Pipeline

- [x] 8.1 Create `Dockerfile` with builder stage (`node:22` + TypeScript compile) and runner stage (`node:22-alpine`, non-root `node` user, only `dist/` and prod deps)
- [x] 8.2 Add `.dockerignore` excluding `src/`, `tests/`, `*.ts`, `node_modules/`, `.git/`
- [x] 8.3 Verify Docker build produces image under 150MB and `bp --version` runs correctly inside container
- [x] 8.4 Add `docker-scout` scan step to CI workflow after Docker build; fail on HIGH/CRITICAL CVEs
- [x] 8.5 Create `.releaserc.json` with semantic-release config: branches `main`, plugins for changelog, npm publish, GitHub release, SBOM asset attachment
- [x] 8.6 Create `.github/workflows/release.yml` triggered on push to `main`: runs full CI, then semantic-release
- [x] 8.7 Add `node dist/cli/index.js --version` validation step after `npm run build` in CI workflow to confirm compiled output is executable
- [x] 8.8 Add Bun to the CI test matrix: install Bun action, run `bun test` against existing test suite, document any incompatibilities found
- [x] 8.9 Update `package.json` to add `"engines": { "bun": ">=1.0.0" }` once Bun compatibility confirmed
- [x] 8.10 Document Docker usage in `docs/getting-started.md`: pull command, volume mount for project directory, example `bp verify` invocation inside container
