## Context

`open-blueprint` (`bp`) is a CLI tool that detects project stacks, generates configuration blueprints for AI coding tools, and validates output against user-defined rules. A prior improvement round addressed the most visible issues (async templating, Zod validation, HMAC audit signing, resource limits) but left several critical gaps: output drift detection is mathematically broken, 8 modules still block the Node.js event loop with sync `fs` calls, plugins have no isolation boundary, the template cache is unbounded, and CI has no static security analysis.

This design covers all Priority 1–4 items from `open-blueprint-analysis.md`.

## Goals / Non-Goals

**Goals:**
- Restore drift detection correctness (`computeSimilarity`)
- Eliminate all synchronous `node:fs` calls from the critical path
- Enforce a safety boundary around plugin execution
- Bound template cache memory with LRU+TTL
- Add SARIF output to `bp verify` for GitHub Advanced Security
- Add OpenTelemetry instrumentation to the `bp` CLI pipeline
- Add backend version pinning to adapters
- Promote monorepo detection from presence-check to workspace-parse
- Harden CI with CodeQL, secret scanning, SARIF upload
- Enforce sync-fs-free guarantee via lint

**Non-Goals:**
- Full distributed tracing in multi-process setups
- Plugin permission model (filesystem/network ACL) — sandboxing only, no capability system
- Migrating tests to a new framework
- Changing the public `bp` CLI API surface (flags remain the same except `--format`)

## Decisions

### D1: `computeSimilarity` — replace with content-hash equality

**Decision:** Remove the fake similarity score. Drift is binary: hashes match or they don't. `computeSimilarity` returns `1.0` (identical) or `0.0` (different). Callers that used the `< 0.7` threshold now use `!== 1.0`.

**Rationale:** SHA-256 hashes are always 64 characters, so the length-ratio formula always returns either `1.0` (equal) or `0.75` (never), meaning the `< 0.7` gate never fires. There is no meaningful "partial similarity" between two cryptographic hashes. If fuzzy similarity of *content* is needed in the future, it requires a different algorithm (Simhash, MinHash) operating on raw content, not on hashes.

**Alternative considered:** Implement Levenshtein distance on hex strings. Rejected — comparing hex strings as text carries no semantic meaning about the underlying content.

### D2: Secrets module consolidation — `security/scan.ts` is canonical

**Decision:** `enterprise/secrets.ts` is deleted. All callers (including `doctor --secret-scan`) import from `security/scan.ts`.

**Rationale:** `security/scan.ts` has 9 patterns + Shannon entropy + base64 detection + common word filtering. `enterprise/secrets.ts` appears to only cover AWS credentials. Maintaining two scanners creates divergence risk. One canonical scanner is simpler.

**Alternative considered:** Make `enterprise/secrets.ts` re-export `security/scan.ts`. Rejected — dead files accumulate; a direct deletion forces callers to update imports explicitly.

### D3: Async I/O migration — wrap, don't redesign

**Decision:** Replace `fs.*Sync` calls with `fsPromises.*` in-place. Function signatures that were sync become `async`; callers are updated to `await`. No new queue, stream, or worker abstraction.

**Rationale:** The affected modules (`audit.ts`, `config/project.ts`, `drift.ts`, `cache.ts`, `registry/client.ts`, `registry/signer.ts`, `lsp/server.ts`, `doctor.ts`) have simple sequential I/O patterns. The complexity of a write-queue or worker-pool is not justified for CLI tools where these paths are called rarely per invocation. The goal is simply to not block the event loop.

**Exception:** `audit.ts` should use a `WriteStream` (append mode) to avoid repeated `open`/`close` overhead on high-frequency audit logging.

**Alternative considered:** `graceful-fs` wrapper. Rejected — it shims sync calls, not converts them.

### D4: Plugin sandboxing — `vm.Script` in restricted context

**Decision:** Load plugins using Node's built-in `vm` module in a `Script` context with a restricted global sandbox (no `process`, no `require`, no `fs`). Plugins receive a stable API object injected at context creation.

**Rationale:** `Worker` threads provide stronger isolation (separate V8 heap) but add serialization overhead and complexity. For validator plugins that run synchronously on small data structures, `vm.Script` gives sufficient isolation with minimal overhead.

**Risk:** `vm.Script` does not prevent CPU exhaustion. A plugin can run an infinite loop. Mitigate by wrapping execution in a `Promise.race` with a timeout (reuse `VALIDATION_TIMEOUT_MS`).

**Alternative considered:** `worker_threads`. Not rejected — prefer `vm.Script` for now, document that `Worker` is the upgrade path if CPU isolation is needed.

### D5: Template cache — `lru-cache` package

**Decision:** Replace `const templateCache = new Map()` in `engine.ts` with an `LRUCache` instance from the `lru-cache` npm package (already widely used in the Node ecosystem).

**Config:** `max: 500` entries, `ttl: 300_000` ms (5 min). Both overridable via `BP_TEMPLATE_CACHE_MAX` and `BP_TEMPLATE_CACHE_TTL_MS` env vars.

**Rationale:** `lru-cache` is battle-tested, zero-dependency for this use case, and adds ~15KB to the install. The alternative of implementing LRU manually introduces risk and maintenance burden.

### D6: SARIF output — custom serializer, no external library

**Decision:** Implement SARIF 2.1.0 serialization directly (it's a JSON schema with ~10 fields needed). No new dependency.

**Rationale:** The `@microsoft/sarif-multitool` package is 50MB+. A custom serializer for the subset of SARIF needed for GitHub Advanced Security code scanning upload is ~100 lines.

### D7: OpenTelemetry — `@opentelemetry/api` only, no SDK in production

**Decision:** Instrument with `@opentelemetry/api` (the vendor-neutral facade). The SDK (`@opentelemetry/sdk-node`) is a `devDependency` used only for local testing. Spans are no-ops unless an SDK is configured by the user's environment.

**Rationale:** The `@opentelemetry/api` package is ~40KB and produces zero overhead when no SDK is registered. Bundling the full SDK in `bp` would add ~3MB and require users to configure exporters they may not want.

### D8: Backend version pinning — semver ranges in config

**Decision:** Add `minVersion?: string` (semver) and `testedVersions?: string[]` fields to `BackendConfig`. Detection of installed backend version is best-effort (check `~/.cursor/package.json`, etc.). Validation warns (not errors) when version is outside tested range.

**Rationale:** Hard-erroring on version mismatch would break `bp` for users on untested-but-compatible versions. Warning is safer for a 1.0 release.

### D9: Monorepo workspace parsing — read, not just detect

**Decision:** After detecting monorepo presence, parse the appropriate config file to enumerate packages:
- `pnpm-workspace.yaml` → `packages[]` globs
- `package.json#workspaces` → array or object with `packages[]`
- `nx.json#projects` → project names
- `lerna.json#packages` → globs

Result is stored as `workspacePackages: string[]` on the fingerprint. Use Node's built-in `glob` (Node 22+) or `fast-glob` (already a transitive dependency) to expand globs.

### D10: CI security hardening — GitHub Actions native tooling

**Decision:** Add three new workflow jobs to `ci.yml`: `codeql` (using `github/codeql-action/analyze`), `security-scan` (SARIF upload via `bp verify --format sarif`), and `dependency-audit` (Snyk or `npm audit` with SARIF output). Keep existing `test` job unchanged.

**Rationale:** GitHub Advanced Security is free for public repos. No external service (Snyk, Semgrep SaaS) is required. CodeQL covers the most critical static analysis needs.

## Risks / Trade-offs

- **`vm.Script` CPU exhaustion** → Plugin execution wrapped in `Promise.race` with `VALIDATION_TIMEOUT_MS`
- **`config/project.ts` async signature change** → All callers updated in same PR; no external API consumers (CLI internal only)
- **`lru-cache` new dependency** → Widely used (500M+ weekly downloads), MIT license, no transitive deps
- **OpenTelemetry spans with no exporter** → `@opentelemetry/api` guarantees no-op behavior with zero overhead when no SDK registered
- **SARIF custom serializer schema drift** → Pin to SARIF 2.1.0; add `$schema` field for validation
- **`doctor.ts` concurrent checks** → `Promise.all` on independent checks; order of output becomes non-deterministic (use sorted result array)
- **Removing `ink`** → If `ink` is referenced anywhere not found by grep, build will fail immediately (caught in CI)

## Migration Plan

1. **Step 1 — Broken logic fixes** (no API changes): Fix `computeSimilarity`, delete `enterprise/secrets.ts`, remove `ink`. Deployable independently.
2. **Step 2 — Async I/O migration** (internal signature changes): Migrate modules bottom-up (leaf modules first: `signer.ts`, `cache.ts`, then `client.ts`, `audit.ts`, `drift.ts`, `config/project.ts`, then `doctor.ts`, `lsp/server.ts`). Update `lint:no-sync-fs` last to lock in the guarantee.
3. **Step 3 — Plugin sandboxing**: Add `vm` context. Existing plugins (none currently) would need to be rewritten to use the injected API object instead of `require`.
4. **Step 4 — Template cache LRU, SARIF, OTel**: Additive changes, no migration needed.
5. **Step 5 — Backend version pinning + monorepo parsing**: Additive to `BackendConfig` schema and fingerprint schema.
6. **Step 6 — CI hardening**: Add workflow jobs, add `biome.json` rules. No application code changes.

Each step can be shipped as a separate PR. Steps 1 and 2 are the highest priority.

## Open Questions

- **Q1:** Should `doctor --secret-scan` output SARIF as well, or only `bp verify`?
- **Q2:** Is `fast-glob` already a direct dependency, or only transitive? If transitive, add it explicitly.
- **Q3:** What is the upgrade path from `vm.Script` to `worker_threads` sandboxing, and should it be designed now?
