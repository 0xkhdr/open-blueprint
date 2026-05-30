## Context

`open-blueprint` v1.0.0 is a 31-backend CLI tool with four internal engines (Detector, Templater, Validator, Translator). The codebase has accumulated structural debt during rapid feature growth: synchronous I/O blocks the Node.js event loop during `detect()` and cache reads, `process.exit()` is called from 10+ interior call-sites making the CLI untestable in-process, `EXIT_CODES` lives in `validator/index.ts` but is imported cross-domain, and the audit-log hook silently swallows failures. Two security vectors are present: path-traversal via unvalidated env-var concatenation (CWE-22) and unbounded stdin strings reaching file-system paths. The codebase is otherwise well-structured with Zod schemas, pino logging, and a layered validation architecture.

## Goals / Non-Goals

**Goals:**
- Eliminate sync I/O in async paths (detector, validator cache)
- Make the CLI testable in-process by removing interior `process.exit()` calls
- Harden two security vectors: path-traversal and input validation on stdin
- Surface audit-log failures (no silent swallow)
- Reduce duplicated error-handling boilerplate via shared utilities
- Replace switch-based adapter lookup with O(1) registry
- Cache Handlebars template compilation to avoid per-call parse overhead
- Replace mtime cache with content-hash (SHA-256) cache for tamper resistance
- Introduce `FileSystem` interface enabling pure unit tests for detector
- Add property-based test coverage for exit-code and schema invariants

**Non-Goals:**
- Changing the public CLI interface or exit-code values
- Introducing new runtime dependencies (all changes use Node.js built-ins or existing deps)
- Refactoring backends themselves or the translator adapter implementations
- Replacing the Handlebars templating engine with an alternative

## Decisions

### D1: `normalizeError` utility — single module, not a class

**Decision:** Export `normalizeError(e: unknown): Error` from `src/utils/errors.ts` as a plain function.

**Rationale:** The pattern `e instanceof Error ? e.message : String(e)` appears at ~15 call-sites. A function is the smallest unit that eliminates duplication without introducing a class hierarchy. Placing it in `src/utils/errors.ts` keeps it adjacent to existing error types in `src/errors.ts`.

**Alternative considered:** Extending the existing `BlueprintError` hierarchy — rejected because most call-sites only need the message string, not a typed error instance.

### D2: `mapLayerErrors` helper — co-located with `validateGovernance`

**Decision:** Define `mapLayerErrors(layerName: string, rawErrors: unknown[]): ValidationError[]` in `src/validator/index.ts`, private to the module.

**Rationale:** The boilerplate is only used by `validateGovernance`. Extracting to a shared module would over-generalize. If a second consumer emerges, promote to `src/utils/`.

### D3: Adapter registry — `Map` initialized at module load

**Decision:** Replace `switch (name)` in `getAdapterByName()` with a `Map<string, () => Adapter>` (factory functions, not constructors) populated at module top-level via `Object.entries` over an imported registry object.

**Rationale:** Factory functions (not `new () => Adapter`) allow adapters that have async initialization. The registry object can be imported from `src/translator/adapters/registry.ts`, keeping `validator/index.ts` decoupled from adapter internals. O(1) lookup vs O(n) switch for 9+ cases.

**Alternative considered:** Dynamic `import()` on first use — rejected because it adds async surface to a path that is currently synchronous and the adapters are always needed.

### D4: `EXIT_CODES` in `src/constants.ts`

**Decision:** Move `EXIT_CODES` (and any other shared magic values: hardcoded directory names, framework names, default glob patterns) to a new `src/constants.ts` file, re-exported from existing module boundaries.

**Rationale:** `EXIT_CODES` is currently defined in `validator/index.ts` but imported by `cli/commands/init.ts` and `cli/index.ts` — a domain-boundary violation. Shared constants belong at the `src/` root. Re-exporting from `validator/index.ts` for one release cycle avoids breaking internal imports.

### D5: Async FS — `fs/promises` with `Promise.all` batching

**Decision:** Rewrite `detect()` and `scanDirectoryTopology()` in `detector/index.ts` to use `import { readFile, readdir, access, stat } from 'node:fs/promises'`. Batch independent reads with `Promise.all`. Inject a `FileSystem` interface (see D7) to enable testing.

**Rationale:** Sync FS calls block the Node.js event loop. On HDD, `detect()` reads 5-10 files serially; parallelizing with `Promise.all` reduces wall-clock time ~30% on spinning disk (each serial `readFileSync` adds ~2ms seek latency; parallel reads amortize seeks). On SSD the gain is smaller (~5%) but event-loop non-blocking is still correct behavior for a library function.

**Alternative considered:** Running `detect()` in a `worker_thread` — rejected as over-engineering; async FS is sufficient.

### D6: Content-hash cache (SHA-256) for validator

**Decision:** Replace mtime-based cache key in `validator/index.ts` with `crypto.createHash('sha256').update(fileContent).digest('hex')`. Cache entries keyed by `(filePath, contentHash)`.

**Rationale:** mtime is trivially forged by `touch` or backdated writes. SHA-256 is available in Node.js built-ins (`node:crypto`), zero new dependencies. Content-hash invalidation is also more correct when files are restored from git (same mtime, different content).

**Risk:** SHA-256 computation adds ~0.1ms per file on modern hardware — negligible vs file I/O.

### D7: `FileSystem` interface — adapter pattern, not DI container

**Decision:** Define `interface FileSystem { readFile, readdir, stat, access }` in `src/utils/fs.ts`. `detect()` accepts an optional `fs?: FileSystem` parameter defaulting to `new RealFileSystem()`. Tests inject `InMemoryFileSystem`.

**Rationale:** Full DI container (inversify, tsyringe) is over-engineering for a CLI tool. An optional parameter with a sensible default keeps the public API unchanged while enabling pure unit tests. The interface matches the `fs/promises` signature subset needed.

### D8: `HandlebarsRegistry` — module-level singleton with lazy compile

**Decision:** Implement `HandlebarsRegistry` as a module-level `Map<string, HandlebarsTemplateDelegate>` in `src/templater/registry.ts`. Templates are compiled on first access and cached. Key format: `${backend}::${templatePack}::${templateName}`.

**Rationale:** Handlebars `compile()` is CPU-bound (regex parsing). Re-parsing on every `runTemplater` call wastes cycles proportional to template count × invocation count. Lazy compile (not eager) avoids startup overhead for commands that don't use templating.

### D9: Path-traversal fix — `path.resolve` + boundary check (CWE-22)

**Decision:** In `resolveCodexCommandsPath`, after concatenating the env-var value with `prompts`, call `path.resolve(result)` and assert the result starts with the expected base directory. Throw a typed `SecurityError` (extend existing error hierarchy) if the boundary is violated.

**Rationale:** `path.resolve` collapses `../` sequences. The prefix check ensures the resolved path stays within the intended directory. OWASP A01:2021 / CWE-22. No new dependencies.

### D10: `InitOrchestrator` — pure service, thin command adapter

**Decision:** Extract the ~250-line `action` body of `init.ts` into `class InitOrchestrator` in `src/cli/orchestrators/init.ts`. The orchestrator accepts a `context: InitContext` object (cwd, logger, fs, options) and returns `{ exitCode: number; messages: string[] }`. The `InitCommand` adapter maps CLI args to context and renders messages via chalk/ora.

**Rationale:** God-function with mixed I/O, business logic, and side effects. Extracting to an orchestrator makes every decision unit-testable without spawning a subprocess. Thin adapter pattern is standard for Commander-based CLIs.

### D11: `process.exit` — single call-site at `parseAsync` boundary

**Decision:** All command action handlers return `Promise<number>` (exit code). The top-level `parseAsync().catch()` block in `cli/index.ts` is the only place that calls `process.exit(code)`.

**Rationale:** `process.exit()` in interior code is an untestable side effect. Returning exit codes enables `await program.parseAsync(args)` in tests without process termination. This pattern is standard in Commander v12+.

### D12: Audit-log failure surface

**Decision:** In the `preAction` hook, replace `catch(() => {})` with `catch((e) => { process.stderr.write(\`[audit] FAILED: \${normalizeError(e).message}\n\`); }`. Do not throw — audit failure must not block the user command.

**Rationale:** Silent audit failure violates compliance principles but blocking the user on audit failure is also wrong. Writing to stderr preserves both: operators see the failure, users are not blocked. Stderr is always available even if the audit file/sink is broken.

## Risks / Trade-offs

- **Async FS refactor scope** → The detector and validator are deeply sync. Asyncifying them requires updating all callers. Risk of missed await. Mitigation: TypeScript will catch missing awaits if return types change from `T` to `Promise<T>`.
- **`InitOrchestrator` extraction** → Large refactor of a high-traffic file. Risk of behavioral regression. Mitigation: extract first (no logic change), then modify; keep E2E tests green throughout.
- **Content-hash cache** → SHA-256 on every validated file adds marginal CPU. On repos with 1000+ blueprint files this is ~100ms. Mitigation: cache the hash alongside the validation result; only rehash on file stat mtime change as a cheap pre-filter.
- **Adapter registry** → If adapters are added without updating the registry, they silently fall through to `GenericAdapter`. Mitigation: add a compile-time exhaustiveness check via TypeScript's discriminated union or a registry validation test.
- **`FileSystem` interface** → Adds a parameter to `detect()`. If other internal callers exist, they need updating. Mitigation: default parameter preserves backward compat.

## Migration Plan

1. Add `src/constants.ts` and re-export `EXIT_CODES` from `validator/index.ts` — zero breaking change.
2. Add `src/utils/errors.ts` with `normalizeError` — replace call-sites one file at a time.
3. Add `src/utils/fs.ts` with `FileSystem` interface — update `detect()` with optional param.
4. Asyncify `detector/index.ts` — update `init.ts` and any other callers.
5. Asyncify validator cache — update `validate()` callers.
6. Replace validator switch with adapter registry.
7. Add `HandlebarsRegistry` — plug into `runTemplater`.
8. Fix path-traversal in `resolveCodexCommandsPath`.
9. Harden Zod schemas.
10. Extract `InitOrchestrator` — wire `InitCommand` adapter.
11. Propagate exit-code discipline — remove `process.exit()` from interior sites.
12. Fix audit-log failure handling.
13. Add property-based tests.

Rollback: each step is an independent commit; git revert is safe at any point. No data migrations required.

## Open Questions

- Should `HandlebarsRegistry` be cleared between test runs? (Likely yes — add a `clearForTesting()` export gated on `NODE_ENV=test`.)
- Should `InMemoryFileSystem` be published as part of the public API for downstream testing? (Start private; promote if ecosystem demand arises.)
- Is there a second consumer of `mapLayerErrors` anticipated soon? (If yes, promote to `src/utils/` now rather than later.)
