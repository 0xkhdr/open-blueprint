# Open-Blueprint (`bp`) Post-Improvement Gap Analysis

## Executive Summary

This analysis evaluates the **open-blueprint** repository after the previous round of improvements was implemented. Significant progress has been made across templater async migration, security hardening, adapter registry refactoring, audit logging, resource limits, and diff generation. However, **critical gaps remain** in the architecture, particularly around incomplete migrations, lingering sync I/O, test coverage, CI security posture, and enterprise-grade operational concerns.

---

## 1. Improvements Successfully Implemented (Verified)

| # | Improvement | Status | Evidence |
|---|------------|--------|----------|
| 1 | **Templater async migration** | ✅ Done | `templater/index.ts` now uses `fsPromises`, `findTemplateFiles()` is async |
| 2 | **Writer async migration** | ✅ Done | `writer.ts` fully async with `fsPromises`, `createPatch` from `diff` package |
| 3 | **Engine async partials** | ✅ Done | `registerPartials()` is async, uses `fsPromises` |
| 4 | **Template vars Zod validation** | ✅ Done | `VarsSchema` with depth limits, blocked HBS keys, string length caps |
| 5 | **Audit log HMAC signing** | ✅ Done | `AuditLogger` class with `createHmac('sha256')`, correlation ID reuse |
| 6 | **Audit log structured warnings** | ✅ Done | `logger.warn()` on missing HMAC key and write failures |
| 7 | **Adapter registry refactor** | ✅ Done | `ADAPTER_LOADERS` map in `translator/index.ts`, `getAdapter()` exported; `doctor.ts` uses it |
| 8 | **Proper unified diff** | ✅ Done | `createPatch` from `diff` package replaces naive line diff |
| 9 | **Resource limits** | ✅ Done | `MAX_VALIDATION_FILES`, `MAX_VALIDATION_BYTES`, `VALIDATION_TIMEOUT_MS` with env overrides |
| 10 | **Validation timeout** | ✅ Done | `Promise.race()` with `ValidationTimeoutError` in `validator/index.ts` |
| 11 | **Silent catch → logger** | ✅ Partial | `drift.ts` and `cache.ts` now use `logger.warn()` on errors |
| 12 | **SHA-256 output hash** | ✅ Done | `computeOutputHash()` uses `crypto.createHash('sha256')` |
| 13 | **Registry public key loading** | ✅ Done | `loadPublicKey()` loads from `BP_REGISTRY_PUBLIC_KEY` env or `~/.bp/keys/` |
| 14 | **Registry DI for tests** | ✅ Done | `RegistryAdapter` interface, injectable via constructor |
| 15 | **Path traversal fix** | ✅ Done | `resolveCodexCommandsPath()` uses `path.relative()` + `startsWith('..')` check |
| 16 | **LSP `require()` removal** | ✅ Done | `import { createConnection }` from ESM entry |
| 17 | **Config async loader** | ✅ Done | `loadProjectConfigAsync()` added |
| 18 | **Structural validator async** | ✅ Done | `validateStructural()` and `validateStructuralBatch()` are async |
| 19 | **Entropy-based secret scanning** | ✅ Done | `scanContent()` with Shannon entropy, base64 detection, common word filtering |
| 20 | **Custom error classes** | ✅ Done | `ResourceLimitError`, `ValidationTimeoutError`, `TemplateVarsValidationError` |

---

## 2. Critical Gaps Remaining

### 2.1 Incomplete Async Migration (Sync I/O Still Lingers)

While the templater, writer, engine, and structural validator were migrated, **several modules still use synchronous `node:fs`**:

| File | Sync Calls | Impact |
|------|-----------|--------|
| `src/security/audit.ts` | `fs.existsSync`, `fs.mkdirSync`, `fs.appendFileSync`, `fs.lstatSync`, `fs.unlinkSync`, `fs.symlinkSync` | Audit logging blocks event loop; high-frequency commands degrade |
| `src/config/project.ts` | `fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync` | Config loading blocks; `initProjectConfig` and `saveProjectConfig` are sync |
| `src/validator/drift.ts` | `fs.readFileSync`, `fs.writeFileSync`, `fs.existsSync` | Drift detection blocks on fingerprint I/O |
| `src/validator/cache.ts` | `fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync`, `fs.mkdirSync` | Cache operations block; sync variants still exposed |
| `src/registry/client.ts` | `fs.existsSync`, `fs.mkdirSync`, `fs.cpSync`, `fs.readFileSync`, `fs.writeFileSync`, `fs.readdirSync` | Registry install/publish blocks on file I/O |
| `src/registry/signer.ts` | `fs.readdirSync`, `fs.readFileSync` | Key loading blocks |
| `src/lsp/server.ts` | `fs.existsSync` | LSP document validation blocks on project root detection |
| `src/cli/commands/doctor.ts` | `fs.existsSync`, `fs.readdirSync`, `fs.statSync`, `fs.readFileSync`, `fs.writeFileSync` | Doctor command is entirely sync I/O |
| `src/cli/commands/init.ts` | `fs` (via `InitOrchestrator` — not inspected) | Likely sync |
| `src/enterprise/secrets.ts` | `fs` (file truncated in fetch, but likely sync) | Enterprise secret scan likely sync |

**The `lint:no-sync-fs` script was expanded** to cover more files, but it only checks `src/detector/index.ts`, `src/validator/index.ts`, `src/validator/structural.ts`, `src/templater/index.ts`, `src/templater/writer.ts`, `src/templater/engine.ts`. It **does not** cover `audit.ts`, `config/project.ts`, `drift.ts`, `cache.ts`, `registry/client.ts`, `lsp/server.ts`, `doctor.ts`, or `enterprise/secrets.ts`.

**Fix**: Expand the lint rule to cover all source files, or migrate all remaining sync I/O to async.

### 2.2 No Plugin Sandboxing

Custom validators (plugins) are referenced in `ProjectConfigSchema` via `plugins: z.array(z.string()).default([])`, but there is **no evidence** of:
- Plugin loading mechanism
- VM/worker thread isolation
- Permission boundary enforcement

**Impact**: A malicious or compromised plugin can execute arbitrary code with the same privileges as `bp`.

**Fix**: Implement plugin loading in a `vm.Script` context or `Worker` thread with restricted globals.

### 2.3 Missing OpenTelemetry Instrumentation

The `BlueprintIRSchema` defines a rich `TelemetrySchema` with OpenTelemetry, Datadog, New Relic, and Prometheus configurations. However, **the `bp` CLI itself has zero telemetry instrumentation**:
- No spans around validation layers
- No metrics for file count, validation time, error rates
- No distributed tracing for `init` → `detect` → `template` → `validate` pipeline

**Impact**: The tool can configure telemetry for *other* projects but cannot observe its own performance.

**Fix**: Add `@opentelemetry/api` and instrument the 4 validation layers, templater, and detector.

### 2.4 No SARIF Output Format

Despite the security scanning improvements, `bp verify` does **not** output SARIF (Static Analysis Results Interchange Format). This means:
- Cannot integrate with GitHub Advanced Security code scanning
- Cannot upload results to GitHub Security tab
- CI security gates must parse custom JSON

**Fix**: Add `--format sarif` option to `verify` command.

### 2.5 CI Security Scanning Still Minimal

The `ci.yml` workflow has **not changed** from the previous analysis:
- Still only runs `npm audit --audit-level=high`
- No CodeQL analysis
- No secret scanning (GitHub Advanced Security)
- No Snyk or OWASP dependency check
- No SARIF upload

**Fix**: Add GitHub Advanced Security steps, CodeQL, and `github/codeql-action`.

### 2.6 Template Cache Has No TTL / Expiration

`src/templater/engine.ts`:
```typescript
const templateCache = new Map();
```

The cache is a plain `Map` with:
- No maximum size limit
- No TTL / expiration
- No LRU eviction
- `clearTemplateCache()` exists but is never called automatically

**Impact**: Long-running processes (LSP server, watch mode) will accumulate unbounded memory.

**Fix**: Implement an LRU cache with TTL (e.g., `lru-cache` package or a simple wrapper).

### 2.7 No Backend Version Pinning

`BackendConfig` in `src/backends/registry.ts` has no `minBackendVersion` or `supportedVersions` field. The adapters don't declare what versions of Claude Code, Cursor, etc. they are compatible with.

**Impact**: Breaking changes in backend tools (e.g., Cursor changing `.cursor/rules` format) will silently produce invalid output.

**Fix**: Add version constraints to `BackendConfig` and validate against detected backend versions.

### 2.8 Monorepo Detection is Surface-Level

`src/detector/index.ts` detects monorepos by checking for file existence:
```typescript
fileExists(path.join(root, "pnpm-workspace.yaml"), fs),
fileExists(path.join(root, "lerna.json"), fs),
fileExists(path.join(root, "nx.json"), fs),
```

But it **does not parse** these files to:
- Identify workspace packages
- Detect inter-package dependencies
- Validate that all packages have blueprints

**Impact**: Monorepo governance is incomplete — `bp` knows it's a monorepo but not what's in it.

**Fix**: Parse `pnpm-workspace.yaml`, `package.json#workspaces`, `nx.json#projects`, etc.

### 2.9 `computeSimilarity` is Still Flawed

`src/validator/drift.ts`:
```typescript
export function computeSimilarity(hash1: string, hash2: string): number {
  if (hash1 === hash2) return 1.0;
  return 0.5 + (Math.min(hash1.length, hash2.length) / Math.max(hash1.length, hash2.length)) * 0.5;
}
```

This function compares **SHA-256 hex strings** by length ratio. Since all SHA-256 hashes are 64 characters, `hash1.length === hash2.length` always, so this always returns `1.0` when hashes differ. The similarity threshold of `< 0.7` will **never trigger**.

**Impact**: Output drift detection is completely non-functional.

**Fix**: Compare hashes directly (`hash1 !== hash2`) or use a proper string similarity algorithm (Levenshtein, cosine similarity on tokenized output).

### 2.10 `doctor.ts` Still Uses Sync I/O Extensively

The `doctor` command is a diagnostic tool that runs multiple checks. Every check uses `fs.existsSync`, `fs.readdirSync`, `fs.statSync`, `fs.readFileSync`. In a large repo, this serially blocks the event loop for each check.

**Impact**: `bp doctor` is slow and unresponsive on large repositories.

**Fix**: Migrate doctor checks to async I/O and run independent checks in parallel with `Promise.all`.

### 2.11 `Ink` Dependency is Unused

`package.json` includes `"ink": "^7.0.4"` (React for CLI), but there is **no evidence** of Ink components anywhere in the source. This is a large dependency (~200KB+) that bloats the install.

**Fix**: Remove `ink` from dependencies if unused, or implement Ink-based TUI components.

### 2.12 No Test Files Visible

The `tests/unit/` directory exists but test files could not be retrieved. The `fast-check` dependency is installed but there is **no visible property-based test** configuration. E2E tests are excluded from coverage.

**Impact**: Cannot verify that improvements are actually tested.

**Fix**: Ensure unit tests are committed and run in CI. Add property-based tests for `VarsSchema`, `computeOutputHash`, and validation layers.

### 2.13 `enterprise/secrets.ts` is Truncated / Incomplete

The file fetch returned truncated content. The patterns appear to only cover AWS credentials. Compared to `security/scan.ts` which has 9 patterns + entropy, `enterprise/secrets.ts` seems to be a **duplicate, less-capable version**.

**Impact**: `doctor --secret-scan` may use `enterprise/secrets.ts` instead of the improved `security/scan.ts`, giving weaker detection.

**Fix**: Consolidate secret scanning into a single module, or ensure `enterprise/secrets.ts` uses the same entropy + regex engine as `security/scan.ts`.

### 2.14 No Cost Anomaly Statistical Rigor

`checkCostDrift()` in `drift.ts` uses a naive split-half baseline comparison:
```typescript
const midpoint = Math.floor(history.length / 2);
const baselineTokens = history.slice(0, midpoint).reduce(...) / midpoint;
```

This is **not** a proper statistical anomaly detection:
- No seasonality handling
- No trend detection
- No outlier rejection
- Assumes stationary distribution

**Impact**: False positives on normal usage spikes, false negatives on gradual cost creep.

**Fix**: Implement proper time-series anomaly detection (e.g., EWMA, Holt-Winters, or simple rolling z-score).

### 2.15 `Biome` Linter Rules are Minimal

`biome.json`:
```json
"linter": {
  "rules": {
    "recommended": true,
    "suspicious": { "noExplicitAny": "error", "noConsole": "error" },
    "style": { "useConst": "error" }
  }
}
```

Missing security-focused rules:
- No `noDangerouslySetInnerHtml` equivalent for template output
- No `noSyncScripts` for sync I/O
- No `noGlobalEval` for dynamic code execution

**Fix**: Add Biome security rules or integrate `eslint-plugin-security`.

---

## 3. Architectural Debt

### 3.1 Circular Dependency Risk

`detector/index.ts` imports `enrichFingerprint` which may call back into detector logic. `templater/index.ts` imports `enrichFingerprint` from detector. `validator/index.ts` imports from templater, detector, and translator. The dependency graph is dense and may have hidden cycles.

**Fix**: Run `madge --circular src/` to detect and break cycles.

### 3.2 No Dependency Injection Container

Despite the `FileSystem` abstraction and `RegistryAdapter` interface, there is no unified DI container. Services are instantiated inline or via static methods.

**Fix**: Consider a lightweight DI container (e.g., `tsyringe`, `inversify`, or a simple registry pattern).

### 3.3 Error Hierarchy is Flat

All errors extend `BpError` with manual `exitCode` assignment. There is no `BpError.from(err)` factory for wrapping unknown errors, and no error code registry.

**Fix**: Add an error code registry (enum or const object) and a factory method.

---

## 4. Suggested Next Steps (Claude Code Work Items)

### Priority 1: Fix Broken Logic
1. **Fix `computeSimilarity`** — it's mathematically broken for SHA-256 hashes
2. **Consolidate `enterprise/secrets.ts`** with `security/scan.ts` or remove the weaker one
3. **Remove unused `ink` dependency**

### Priority 2: Complete Async Migration
4. **Migrate `audit.ts`** to async I/O (or use a write stream)
5. **Migrate `config/project.ts`** sync functions to async
6. **Migrate `drift.ts`** fingerprint I/O to async
7. **Migrate `cache.ts`** sync functions to async (or deprecate sync variants)
8. **Migrate `registry/client.ts`** to async I/O
9. **Migrate `doctor.ts`** checks to async with `Promise.all`
10. **Expand `lint:no-sync-fs`** to cover ALL `src/**/*.ts` files

### Priority 3: Add Missing Features
11. **Implement plugin sandboxing** with `vm.Script` or `Worker`
12. **Add OpenTelemetry self-instrumentation**
13. **Add SARIF output format** to `verify`
14. **Add template cache LRU + TTL**
15. **Add backend version pinning** to `BackendConfig`
16. **Parse monorepo workspace configs** (not just detect presence)
17. **Improve cost anomaly detection** with rolling statistics

### Priority 4: CI & Quality
18. **Add CodeQL, secret scanning, and SARIF upload** to `ci.yml`
19. **Ensure unit tests are visible and run in CI**
20. **Add property-based tests** with `fast-check`
21. **Run `madge --circular`** and resolve cycles
22. **Add Biome security lint rules**

---

## 5. Risk Assessment (Post-Improvement)

| Risk | Before | After | Remaining Gap |
|------|--------|-------|---------------|
| Secret leakage undetected | High | Medium | `enterprise/secrets.ts` may be weaker; no AST-aware scanning |
| Audit log tampering | High | Low | HMAC signing added, but still sync I/O |
| Template injection via vars | High | Low | Zod validation + JSON round-trip + deepFreeze |
| DoS via large repo validation | Medium | Low | Resource limits + timeout added |
| Registry signature bypass | High | Medium | DI for tests added, but mock registry still in production path |
| Path traversal on Windows | Medium | Low | Fixed with `path.relative()` check |
| Prototype pollution | Medium | Low | JSON round-trip strips prototype |
| Output drift detection non-functional | — | **Critical** | `computeSimilarity` is broken |
| Unbounded template cache | — | Medium | No TTL/LRU on `templateCache` |
| Plugin arbitrary code execution | — | **High** | No sandboxing implemented |
| No self-observability | — | Medium | Schema exists but no instrumentation |
| CI security posture | Low | Low | No change to CI security scanning |

---

*Analysis generated for open-blueprint v1.0.0 (commit: main, post-improvement)*
*Date: 2026-05-30*