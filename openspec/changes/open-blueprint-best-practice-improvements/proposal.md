## Why

The open-blueprint (`bp`) codebase has critical gaps that undermine correctness, reliability, and security: output drift detection is mathematically broken, six modules block the event loop with synchronous I/O, plugins can execute arbitrary code without isolation, and the CI pipeline lacks any static security analysis. These gaps exist despite the previous round of improvements and represent the highest-priority engineering debt before a stable 1.0 release.

## What Changes

- Fix `computeSimilarity` — currently returns `1.0` for all non-identical SHA-256 hashes, making drift detection non-functional
- Consolidate `enterprise/secrets.ts` with `security/scan.ts` — remove the weaker duplicate, route all secret scanning through the entropy+regex engine
- Remove unused `ink` dependency (~200KB install bloat with zero usage)
- Migrate all remaining synchronous `node:fs` calls to async in: `audit.ts`, `config/project.ts`, `drift.ts`, `cache.ts`, `registry/client.ts`, `registry/signer.ts`, `lsp/server.ts`, and `doctor.ts`
- Expand `lint:no-sync-fs` to cover all `src/**/*.ts` files (not just 6 files)
- Implement plugin sandboxing via `vm.Script` context or `Worker` thread with restricted globals
- Add LRU cache with TTL to `templateCache` in `engine.ts` (replacing unbounded `Map`)
- Add `--format sarif` option to `bp verify` for GitHub Advanced Security integration
- Add OpenTelemetry self-instrumentation to the `bp` CLI pipeline
- Add `minBackendVersion` / `supportedVersions` to `BackendConfig`
- Parse monorepo workspace configs (`pnpm-workspace.yaml`, `package.json#workspaces`, `nx.json`) to identify workspace packages, not just detect their presence
- Improve cost anomaly detection with EWMA or rolling z-score instead of naive split-half baseline
- Add CodeQL, secret scanning, and SARIF upload to `ci.yml`
- Add property-based tests with `fast-check` for `VarsSchema`, `computeOutputHash`, validation layers
- Run `madge --circular` and resolve any dependency cycles
- Add Biome security lint rules (`noGlobalEval`, `noSyncScripts` equivalents)

## Capabilities

### New Capabilities

- `broken-logic-fixes`: Fix mathematically broken `computeSimilarity`, consolidate dual secret scanners into one, remove unused `ink` dependency
- `async-io-migration`: Migrate all remaining synchronous `node:fs` calls in `audit.ts`, `config/project.ts`, `drift.ts`, `cache.ts`, `registry/client.ts`, `registry/signer.ts`, `lsp/server.ts`, and `doctor.ts`; expand `lint:no-sync-fs` to full source coverage
- `plugin-sandboxing`: Load and execute custom validator plugins inside `vm.Script` or `Worker` thread with restricted globals and permission boundaries
- `observability-enhancements`: LRU+TTL template cache, SARIF output format for `bp verify`, OpenTelemetry self-instrumentation across the init→detect→template→validate pipeline
- `backend-version-pinning`: Add `minBackendVersion` and `supportedVersions` fields to `BackendConfig`; validate at runtime against detected backend versions
- `monorepo-workspace-awareness`: Parse `pnpm-workspace.yaml`, `package.json#workspaces`, `nx.json#projects` to enumerate workspace packages and validate blueprint coverage
- `ci-security-hardening`: Add CodeQL, GitHub Advanced Security secret scanning, SARIF upload, property-based tests, `madge --circular` check, and Biome security rules to the CI pipeline

### Modified Capabilities

## Impact

- `src/security/audit.ts` — rewritten to async I/O
- `src/config/project.ts` — `initProjectConfig` and `saveProjectConfig` become async
- `src/validator/drift.ts` — `computeSimilarity` fixed; fingerprint I/O becomes async
- `src/validator/cache.ts` — sync variants removed/deprecated, all paths async
- `src/registry/client.ts`, `src/registry/signer.ts` — async I/O
- `src/lsp/server.ts` — single `fs.existsSync` call replaced with async
- `src/cli/commands/doctor.ts` — fully async with `Promise.all` for independent checks
- `src/templater/engine.ts` — `templateCache` replaced with LRU+TTL implementation
- `src/cli/commands/verify.ts` — new `--format` flag with `sarif` option
- `src/backends/registry.ts` — `BackendConfig` extended with version fields
- `src/detector/index.ts` — monorepo detection parses workspace files
- `src/enterprise/secrets.ts` — removed or replaced with re-export from `security/scan.ts`
- `package.json` — `ink` removed; `lru-cache`, `@opentelemetry/api`, `@opentelemetry/sdk-node` added
- `.github/workflows/ci.yml` — CodeQL, secret scanning, SARIF upload steps added
- `biome.json` — security lint rules added
- `package.json#scripts` — `lint:no-sync-fs` expanded to `src/**/*.ts`
