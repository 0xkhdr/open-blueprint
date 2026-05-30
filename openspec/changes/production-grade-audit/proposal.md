## Why

`open-blueprint` v1.0.0 ships with structural and security issues that block production confidence: sync I/O in async paths, `process.exit` calls that prevent in-process testing, an ESM/CJS hybrid in an ESM-only package, swallowed audit-log failures, and path-traversal vectors in env-var concatenation. The codebase has grown to 31+ backends with no architectural guardrails, creating a maintenance cliff before v2.

## What Changes

- Extract `normalizeError(e): Error` utility — eliminates ~15 duplicated error-coercion sites
- Extract `mapLayerErrors(layerName, errors)` helper — removes boilerplate repeated per governance layer in `validateGovernance`
- Replace `switch`-over-9-cases in `getAdapterByName()` with a `Map<string, AdapterCtor>` registry
- Move `EXIT_CODES` from `validator/index.ts` to `src/constants.ts` — removes cross-domain coupling
- Asyncify all `fs.*Sync` calls in `detector/index.ts` and `validator/index.ts` (cache reads)
- Replace content-insensitive mtime cache with SHA-256 content-hash cache in validator
- Add `HandlebarsRegistry` — compile-once, cache-by-key templater
- Harden Zod schemas (`FingerprintSchema`, `BlueprintIR`) with `.maxLength()`, `.regex()`, `.refine()`
- Fix path-traversal in `resolveCodexCommandsPath` — apply `path.resolve` + boundary check (OWASP A01 / CWE-22)
- Surface audit-log failures — replace `catch(() => {})` with stderr fallback write
- Introduce `FileSystem` interface with `RealFileSystem` / `InMemoryFileSystem` impls for testable `detect()`
- Eliminate double `detect(cwd)` call in `init.ts` — cache fingerprint across single invocation
- Remove ESM/`require` hybrid from `cli/index.ts` — standardize on dynamic `import()`
- Replace `process.exit()` call-sites (10+) with returned exit codes; terminate only at `parseAsync` boundary
- Add property-based tests for exit-code invariants and fingerprint schema round-trips (`fast-check`)
- Introduce `InitOrchestrator` service — extract pure business logic from `init.ts` command action

**BREAKING:** None — public CLI interface and exit-code contract unchanged.

## Capabilities

### New Capabilities
- `error-normalization`: Unified `normalizeError` utility and `mapLayerErrors` helper
- `adapter-registry`: Map-based adapter registry replacing switch statement in validator
- `shared-constants`: `src/constants.ts` as single source for `EXIT_CODES` and other cross-domain constants
- `async-fs-layer`: Async-first file system operations in detector and validator
- `content-hash-cache`: SHA-256-based validation cache replacing mtime cache
- `handlebars-registry`: Pre-compiled, keyed Handlebars template cache
- `schema-hardening`: Zod schema guards for `FingerprintSchema` and `BlueprintIR`
- `path-traversal-fix`: Sanitized path resolution for env-var-derived paths (CWE-22)
- `audit-log-hardening`: Non-silent audit failure surface with stderr fallback
- `filesystem-interface`: `FileSystem` abstraction for testable detector
- `init-orchestrator`: Pure `InitOrchestrator` service extracted from CLI command action
- `exit-code-discipline`: Centralized `process.exit` — returned codes propagate to single call-site
- `property-based-tests`: `fast-check` coverage for exit codes and schema invariants

### Modified Capabilities

## Impact

- `src/cli/index.ts` — ESM fix, exit-code discipline, audit hardening
- `src/cli/commands/init.ts` — orchestrator extraction, deduplicated `detect()`, returned exit codes
- `src/validator/index.ts` — adapter registry, async cache, content-hash cache, `mapLayerErrors`
- `src/detector/index.ts` — full async-fs refactor, `FileSystem` interface injection
- `src/logger.ts` — no structural change; `normalizeError` reduces call-site noise
- `src/errors.ts` — no structural change
- `src/templater/index.ts` — `HandlebarsRegistry` integration
- `src/security/audit.ts` — stderr fallback on failure
- `src/constants.ts` (new) — `EXIT_CODES` and shared magic values
- `tests/unit/**` — `InMemoryFileSystem` enables pure unit tests for detector
- `tests/unit/properties/**` (new) — `fast-check` property-based test suite
- No new runtime dependencies; `fast-check` already in devDependencies
