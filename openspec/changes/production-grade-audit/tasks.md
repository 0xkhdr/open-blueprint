## 1. Shared Foundation

- [x] 1.1 Create `src/constants.ts` — move `EXIT_CODES` here, add `KNOWN_SOURCE_DIRS`, `KNOWN_FRAMEWORK_NAMES`, and default glob patterns
- [x] 1.2 Re-export `EXIT_CODES` from `src/validator/index.ts` pointing to `src/constants.ts` (backward compat shim)
- [x] 1.3 Create `src/utils/errors.ts` — implement `normalizeError(e: unknown): Error`
- [x] 1.4 Replace all `e instanceof Error ? e.message : String(e)` occurrences across the codebase with `normalizeError(e).message`
- [x] 1.5 Add `mapLayerErrors(layerName: string, rawErrors: unknown[]): ValidationError[]` as a module-private helper in `src/validator/index.ts` and refactor `validateGovernance` to use it

## 2. FileSystem Interface & Async Detector

- [x] 2.1 Create `src/utils/fs.ts` — define `FileSystem` interface with `readFile`, `readdir`, `stat`, `access`; implement `RealFileSystem` using `node:fs/promises`
- [x] 2.2 Implement `InMemoryFileSystem` in `src/utils/fs.ts` (or `src/utils/fs.test-helpers.ts`) with `addFile(path, content)` helper; support `ENOENT` rejection for missing files
- [x] 2.3 Rewrite `detect()` in `src/detector/index.ts` to accept `fs?: FileSystem` (default `new RealFileSystem()`); replace all `fs.*Sync` calls with `fs/promises` equivalents; batch independent reads via `Promise.all`
- [x] 2.4 Rewrite `scanDirectoryTopology()` to use async `readdir` and `stat`
- [x] 2.5 Update all callers of `detect()` that depend on its sync return type to await the new async signature
- [x] 2.6 Replace hardcoded source directory and framework name strings in `src/detector/index.ts` with references to `src/constants.ts`

## 3. Validator Improvements

- [x] 3.1 Create `src/translator/adapters/registry.ts` — export a `Map<string, () => Adapter>` populated from an adapter registry object; add TypeScript exhaustiveness check against the `Backend` union type
- [x] 3.2 Replace `switch`-based `getAdapterByName()` in `src/validator/index.ts` with a lookup against the registry from step 3.1
- [x] 3.3 Replace mtime cache key in `src/validator/index.ts` with SHA-256 content-hash using `node:crypto`; implement mtime pre-filter for efficiency
- [x] 3.4 Asyncify all cache read/write operations in `src/validator/index.ts` — replace `fs.existsSync` and `fs.statSync` with `fs/promises` equivalents

## 4. Schema Hardening

- [ ] 4.1 Add `.maxLength(64)` and `.regex(/^[a-z0-9_-]+$/)` guards to identifier fields in `FingerprintSchema`
- [ ] 4.2 Add `.maxLength(512)` to free-form string fields in `FingerprintSchema`
- [ ] 4.3 Add `.maxLength(256)` to path fields and `.maxLength(2048)` to content fields in `BlueprintIR`
- [ ] 4.4 Add `.refine()` guards on glob pattern fields in `BlueprintIR` to reject patterns with 4+ consecutive `*` characters
- [ ] 4.5 Replace any manually-declared `Fingerprint` and `BlueprintIR` TypeScript interfaces with `z.infer<typeof Schema>`; eliminate `as unknown as T` casts for these types

## 5. Handlebars Registry

- [ ] 5.1 Create `src/templater/registry.ts` — implement `HandlebarsRegistry` as a module-level `Map<string, HandlebarsTemplateDelegate>`; key format `${backend}::${templatePack}::${templateName}`
- [ ] 5.2 Implement lazy compile-on-first-access in `HandlebarsRegistry`
- [ ] 5.3 Export `clearForTesting()` from registry — no-op unless `NODE_ENV === 'test'`
- [ ] 5.4 Integrate `HandlebarsRegistry` into `runTemplater` in `src/templater/index.ts`

## 6. Security Fixes

- [ ] 6.1 Fix `resolveCodexCommandsPath` — apply `path.resolve(path.normalize(...))` and add boundary check; throw `SecurityError` on traversal (CWE-22 / OWASP A01)
- [ ] 6.2 Add `validateUserInput(s: string): string` in `src/utils/input.ts` — enforce max 256 chars, reject null bytes and Unicode control characters (U+0000–U+001F, U+007F)
- [ ] 6.3 Pipe `promptUser` return values through `validateUserInput` before any file path or config usage
- [ ] 6.4 Fix audit-log failure handling in `cli/index.ts` `preAction` hook — replace `catch(() => {})` with `catch((e) => { process.stderr.write(...) })` using `normalizeError`

## 7. InitOrchestrator & Exit Code Discipline

- [ ] 7.1 Create `src/cli/orchestrators/init.ts` — implement `InitOrchestrator` class accepting `InitContext`; move all business logic from `init.ts` action handler here; no chalk/ora/readline imports
- [ ] 7.2 Reduce `src/cli/commands/init.ts` to a thin adapter — construct `InitContext`, call `InitOrchestrator.run()`, render messages, return exit code
- [ ] 7.3 Ensure `detect()` is called exactly once per init invocation; pass cached fingerprint to all downstream operations
- [ ] 7.4 Convert all command action handlers in `src/cli/commands/` to return `Promise<number>` (exit code)
- [ ] 7.5 Remove all `process.exit()` calls from `src/` except the single call-site in `src/cli/index.ts` `parseAsync` boundary
- [ ] 7.6 Replace `require("../security/audit.js")` with `await import('../security/audit.js')` in `src/cli/index.ts`; add descriptive error handling

## 8. Property-Based Tests

- [ ] 8.1 Create `tests/unit/properties/arbitraries.ts` — export `fast-check` arbitraries for `Fingerprint` and `BlueprintIR` that generate schema-valid instances
- [ ] 8.2 Create `tests/unit/properties/exit-codes.property.test.ts` — property test asserting all exit codes are integers in `[0, 10]`
- [ ] 8.3 Create `tests/unit/properties/fingerprint-schema.property.test.ts` — property test for JSON round-trip and invalid-input `ZodError` invariant
- [ ] 8.4 Call `HandlebarsRegistry.clearForTesting()` in vitest `afterEach` hooks for templater tests
- [ ] 8.5 Add unit tests for `detect()` using `InMemoryFileSystem` covering: missing `package.json`, TypeScript project detection, monorepo topology detection

## 9. CI Lint Guards

- [ ] 9.1 Add Biome or custom lint rule asserting no `fs.*Sync` calls in `src/detector/` or validator cache paths
- [ ] 9.2 Add lint rule asserting no `process.exit(` in `src/` except `src/cli/index.ts`
- [ ] 9.3 Add lint rule asserting no `require(` in any `src/` file
- [ ] 9.4 Verify `npm audit` shows zero high/critical CVEs; document any accepted low/medium findings in `SECURITY.md`
