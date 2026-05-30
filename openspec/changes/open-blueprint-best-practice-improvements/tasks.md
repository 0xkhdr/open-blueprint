## 1. Broken Logic Fixes (Priority 1)

- [ ] 1.1 Fix `computeSimilarity` in `src/validator/drift.ts` — replace length-ratio formula with binary `hash1 === hash2 ? 1.0 : 0.0`
- [ ] 1.2 Update all callers of `computeSimilarity` that use `< 0.7` threshold to use `!== 1.0`
- [ ] 1.3 Delete `src/enterprise/secrets.ts` and update all imports to use `security/scan.ts`
- [ ] 1.4 Update `doctor.ts` `--secret-scan` path to call `scanContent()` from `security/scan.ts`
- [ ] 1.5 Remove `ink` from `package.json` dependencies and run `npm install` to clean lockfile
- [ ] 1.6 Verify no `import.*from 'ink'` or `require('ink')` references remain in source

## 2. Async I/O Migration — Leaf Modules (Priority 2)

- [ ] 2.1 Migrate `src/registry/signer.ts` — replace `readdirSync`, `readFileSync` with `fsPromises` equivalents; make `loadPublicKey()` async
- [ ] 2.2 Migrate `src/validator/cache.ts` — replace all `fs.*Sync` calls; remove sync public API variants; make all exported functions async
- [ ] 2.3 Migrate `src/registry/client.ts` — replace `readdirSync`, `cpSync`, `readFileSync`, `writeFileSync`, `mkdirSync` with `fsPromises`; make all methods async
- [ ] 2.4 Migrate `src/security/audit.ts` — replace all `fs.*Sync` calls; use `fsPromises.mkdir` for dir creation; use a `WriteStream` in append mode for log entries
- [ ] 2.5 Migrate `src/validator/drift.ts` fingerprint I/O — replace `readFileSync`, `writeFileSync`, `existsSync` with `fsPromises`; keep `computeSimilarity` pure/sync

## 3. Async I/O Migration — Higher-Level Modules (Priority 2)

- [ ] 3.1 Migrate `src/config/project.ts` — make `initProjectConfig()` and `saveProjectConfig()` async; replace all `fs.*Sync` calls
- [ ] 3.2 Update all callers of `initProjectConfig` and `saveProjectConfig` to `await` the result
- [ ] 3.3 Migrate `src/lsp/server.ts` — replace `fs.existsSync` with `await fsPromises.access(...).then(() => true).catch(() => false)`
- [ ] 3.4 Migrate `src/cli/commands/doctor.ts` — replace all `fs.*Sync` calls; refactor independent checks to run concurrently via `Promise.all`; sort output results before printing

## 4. Expand lint:no-sync-fs Coverage

- [ ] 4.1 Update `lint:no-sync-fs` script in `package.json` to target `src/**/*.ts` (remove hardcoded file list)
- [ ] 4.2 Run `npm run lint:no-sync-fs` and verify it passes on the fully migrated codebase
- [ ] 4.3 Add `lint:no-sync-fs` to the CI `lint` job in `.github/workflows/ci.yml`

## 5. Plugin Sandboxing

- [ ] 5.1 Create `src/plugins/sandbox.ts` with a `createPluginContext(api: PluginAPI)` function that returns a restricted `vm.Context`
- [ ] 5.2 Define the `PluginAPI` interface (`{ validate(result: ValidationResult): void; log(msg: string): void; error(msg: string): void }`)
- [ ] 5.3 Create `src/plugins/loader.ts` — load plugin file content, compile with `new vm.Script(code)`, run in sandbox context, wrap in `Promise.race` with `VALIDATION_TIMEOUT_MS`
- [ ] 5.4 Implement `PluginLoadError` and `PluginTimeoutError` custom error classes extending `BpError`
- [ ] 5.5 Integrate plugin loading into the validation pipeline — iterate `ProjectConfigSchema.plugins`, load each, collect results
- [ ] 5.6 Surface plugin errors in `bp doctor` output as structured warnings

## 6. Template Cache LRU + TTL

- [ ] 6.1 Add `lru-cache` to `package.json` dependencies
- [ ] 6.2 Replace `const templateCache = new Map()` in `src/templater/engine.ts` with `new LRUCache({ max: ..., ttl: ... })`
- [ ] 6.3 Read `BP_TEMPLATE_CACHE_MAX` (default `500`) and `BP_TEMPLATE_CACHE_TTL_MS` (default `300000`) env vars to configure the cache
- [ ] 6.4 Update `clearTemplateCache()` to call `cache.clear()` on the LRU instance

## 7. SARIF Output for bp verify

- [ ] 7.1 Create `src/cli/formatters/sarif.ts` — implement SARIF 2.1.0 serializer (schema version field, `runs[]`, `results[]` with `ruleId`, `message.text`, `locations[]`)
- [ ] 7.2 Add `--format` flag to `bp verify` command with values `json` (default) and `sarif`
- [ ] 7.3 Route verify output through the SARIF formatter when `--format sarif` is passed
- [ ] 7.4 Write a test: `bp verify --format sarif` on a fixture project produces valid SARIF 2.1.0 JSON

## 8. OpenTelemetry Self-Instrumentation

- [ ] 8.1 Add `@opentelemetry/api` to `package.json` dependencies (production); add `@opentelemetry/sdk-node` and `@opentelemetry/exporter-trace-otlp-http` to `devDependencies`
- [ ] 8.2 Create `src/telemetry/tracer.ts` — obtain a tracer via `trace.getTracer('open-blueprint')`, export `startSpan` helper
- [ ] 8.3 Instrument `bp detect` — wrap `detectStack()` in a `bp.detect` span
- [ ] 8.4 Instrument `bp template` — wrap `renderTemplate()` in a `bp.template` span
- [ ] 8.5 Instrument `bp validate` — wrap each validation layer call in a `bp.validate.<layer>` span
- [ ] 8.6 Instrument `bp write` — wrap `writeOutput()` in a `bp.write` span
- [ ] 8.7 Add error recording to spans: on exception, call `span.recordException(err)` and `span.setStatus({ code: SpanStatusCode.ERROR })`
- [ ] 8.8 Verify zero overhead when no SDK registered: run `bp detect` without OTel env vars and confirm no latency regression

## 9. Backend Version Pinning

- [ ] 9.1 Add `minVersion?: string` and `testedVersions?: string[]` to `BackendConfig` type in `src/backends/registry.ts`
- [ ] 9.2 Create `src/backends/version-check.ts` — implement `detectBackendVersion(backendId: string): Promise<string | null>` (check known version file locations per backend)
- [ ] 9.3 Call `detectBackendVersion` during `bp detect` or `bp verify` for each configured backend
- [ ] 9.4 Compare detected version against `minVersion` and `testedVersions`; emit `logger.warn` when out of range
- [ ] 9.5 Verify that version detection failure (tool not installed) produces no warning or error

## 10. Monorepo Workspace Awareness

- [ ] 10.1 Verify `fast-glob` is a direct dependency (add if transitive only)
- [ ] 10.2 Create `src/detector/workspace-parser.ts` — implement `parseWorkspacePackages(root: string, fs: FileSystem): Promise<string[]>` supporting `pnpm-workspace.yaml`, `package.json#workspaces`, `nx.json#projects`, `lerna.json#packages`
- [ ] 10.3 Add `workspacePackages: string[]` field to the project fingerprint schema
- [ ] 10.4 Call `parseWorkspacePackages` from `detectStack()` when `isMonorepo` is `true`; handle empty/malformed configs gracefully with `logger.warn`
- [ ] 10.5 Add blueprint coverage check in `bp verify` — for each `workspacePackages` entry, check that expected backend blueprint files exist; emit warning per missing package

## 11. CI Security Hardening

- [ ] 11.1 Add `codeql` job to `.github/workflows/ci.yml` — use `github/codeql-action/init@v3` and `github/codeql-action/analyze@v3` for `javascript-typescript`; trigger on push to `main` and PRs
- [ ] 11.2 Add `sarif-upload` step to CI — run `bp verify --format sarif > results.sarif`; upload via `github/codeql-action/upload-sarif@v3`
- [ ] 11.3 Add `"noGlobalEval": "error"` to `linter.rules.security` in `biome.json`
- [ ] 11.4 Run `npx biome lint` on codebase and fix any newly reported violations

## 12. Property-Based Tests

- [ ] 12.1 Write property-based test for `VarsSchema` — use `fast-check` to generate arbitrary objects; assert parse succeeds or throws `TemplateVarsValidationError` (never an unhandled error)
- [ ] 12.2 Write property-based test for `computeOutputHash` — use `fast-check` to generate arbitrary strings; assert determinism and 64-char hex output
- [ ] 12.3 Write property-based test for structural validator — generate arbitrary blueprint IR objects; assert no unhandled exceptions
- [ ] 12.4 Add `fast-check` tests to CI `test` job; confirm they run and pass in CI

## 13. Circular Dependency Audit

- [ ] 13.1 Add `madge` as a `devDependency`
- [ ] 13.2 Add `"check:circular": "madge --circular --ts-config tsconfig.json src/"` to `package.json` scripts
- [ ] 13.3 Run `npm run check:circular` and document any cycles found
- [ ] 13.4 Break any detected cycles (move shared types to a common module, invert dependencies, etc.)
- [ ] 13.5 Add `check:circular` to the CI `lint` job
