# Open-Blueprint (`bp`) Repository Analysis

## Executive Summary

**open-blueprint** (`bp`) is a zero-runtime-overhead CLI utility that scaffolds and verifies governance structures for agentic AI coding tools (Claude Code, Cursor, Codex, etc.). It supports 31 backends, runs 4-layer validation (structural → semantic → logical → drift), and uses Handlebars templating with a fingerprint-based detector.

This analysis identifies **critical gaps** in code quality, security posture, and architectural maintainability that should be addressed before the tool is used in production CI/CD pipelines or enterprise environments.

---

## 1. Package Domain Analysis

### 1.1 Architecture Overview
```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   DETECTOR   │───▶│  TEMPLATER   │───▶│  VALIDATOR   │───▶│  TRANSLATOR  │
│  (Repo MRI)  │    │ (Handlebars) │    │ (4-Layer QA) │    │(Backend Sync)│
└──────────────┘    └──────────────┘    └──────────────┘    └──────────────┘
```

- **Detector**: Scans repo topology, languages, frameworks, security signals
- **Templater**: Handlebars-based scaffolding with risk-tier template merging
- **Validator**: 4-layer gate (structural, semantic, logical, drift) + governance
- **Translator**: 31 backend adapters converting BlueprintIR to target formats

### 1.2 Strengths
- **Comprehensive backend coverage**: 31 AI tools supported with manifest-driven configuration
- **Strong type safety**: TypeScript strict mode, Zod schemas for IR validation
- **Good CI hygiene**: Biome linting, Vitest coverage, multi-node CI matrix
- **Documentation maturity**: ADRs, progressive-disclosure docs, NFRs, glossary
- **Observability**: Pino structured logging with correlation IDs and redaction
- **LSP integration**: VS Code language server for real-time validation

### 1.3 Domain Gaps
| Gap | Impact | Severity |
|-----|--------|----------|
| No plugin sandboxing | Custom validators run in same process | High |
| No remote registry auth | Registry client lacks token-based auth flows | Medium |
| Missing backend version pinning | Adapters don't declare compatible backend versions | Medium |
| No monorepo workspace detection | Detector sees packages/ but doesn't parse workspace configs | Low |

---

## 2. Code Quality Gaps

### 2.1 Synchronous I/O in Async Codepaths
**Files**: `src/templater/index.ts`, `src/templater/writer.ts`, `src/templater/engine.ts`, `src/security/audit.ts`, `src/config/project.ts`, `src/validator/structural.ts`, `src/validator/drift.ts`, `src/validator/cache.ts`

The project has a custom lint rule (`lint:no-sync-fs`) that bans sync fs in detector and validator, but the ban is **incomplete**:
- `templater/index.ts` uses `fs.existsSync`, `fs.readFileSync`, `fs.readdirSync`, `fs.writeFileSync`
- `writer.ts` uses `fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync`, `fs.mkdirSync`
- `engine.ts` uses `fs.existsSync`, `fs.readdirSync`, `fs.readFileSync`
- `security/audit.ts` uses `fs.existsSync`, `fs.mkdirSync`, `fs.appendFileSync`, `fs.unlinkSync`, `fs.lstatSync`, `fs.symlinkSync`
- `config/project.ts` uses `fs.existsSync`, `fs.readFileSync`, `fs.writeFileSync`
- `structural.ts` uses `fs.existsSync`, `fs.readFileSync`, `fs.statSync`

**Impact**: Blocks the event loop during template rendering and validation, degrading performance on large repos.

**Fix**: Migrate all sync fs calls to the `FileSystem` abstraction (`src/utils/fs.ts`) which already supports async and in-memory implementations.

### 2.2 Hardcoded Adapter Registry
**File**: `src/translator/index.ts` (lines ~10-80)

```typescript
async function buildAdapterMap() {
  const [{ ClaudeAdapter }, { CursorAdapter }, ...] = await Promise.all([
    import("./adapters/claude.js"),
    import("./adapters/cursor.js"),
    // ... 31 imports
  ]);
}
```

**Impact**: Adding a new backend requires editing this file. The `doctor.ts` command duplicates this logic with its own `getAdapterByName()` switch statement.

**Fix**: Use a dynamic registry pattern:
```typescript
const adapterModules = await import(`./adapters/${backend}.js`);
```
Or implement a proper dependency-injection container.

### 2.3 Inconsistent Error Handling
**Pattern**: Many files catch errors and silently ignore them:
- `detector/index.ts`: `try { ... } catch { /* fall through */ }` (6 instances)
- `validator/drift.ts`: `try { ... } catch { /* skip */ }` (4 instances)
- `security/audit.ts`: `try { ... } catch { /* Fail silently */ }`
- `cache.ts`: `try { ... } catch { /* Ignore write failures */ }`

**Impact**: Silent failures make debugging impossible. The audit log explicitly states it "fails silently to avoid breaking main process" — this is a security anti-pattern.

**Fix**: Use the `logger` to emit structured error events even when swallowing exceptions.

### 2.4 Weak Unified Diff Implementation
**File**: `src/templater/writer.ts` — `generateUnifiedDiff()`

The diff algorithm is a naive line-by-line comparison that doesn't produce valid unified diff format (no hunk headers, no context lines, no `@@` markers).

**Impact**: `--dry-run` output is not machine-parseable by standard diff tools.

**Fix**: Use a proper diff library (e.g., `diff` npm package) or invoke `git diff --no-index`.

### 2.5 No Input Validation on Template Variables
**File**: `src/templater/index.ts` — `sanitizeTemplateVars()`

Only strips shell metacharacters. It does **not**:
- Validate object depth (prototype pollution risk)
- Validate key names (could inject Handlebars helpers)
- Validate string length (DoS via massive strings)

**Fix**: Add Zod schema validation for `vars` before merging into context.

### 2.6 Test Coverage Gaps
- The `tests/unit/` directory exists but test files could not be retrieved for inspection
- No visible property-based testing configuration despite `fast-check` being in devDependencies
- E2E tests are excluded from coverage runs (`--exclude 'tests/e2e/**'`)

---

## 3. Security Gaps

### 3.1 Secret Scanning is Regex-Based and Bypassable
**Files**: `src/security/scan.ts`, `src/enterprise/secrets.ts`

Current patterns use simple regexes like:
```typescript
/\beyJhbGciOi[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\b/i  // JWT
/\bAKIA[0-9A-Z]{16}\b/i  // AWS
```

**Bypass vectors**:
1. **String splitting**: `"eyJhbGci" + "Oi..."` defeats regex
2. **Base64 encoding**: Secrets encoded in comments or strings
3. **Variable interpolation**: `process.env.KEY` where KEY is defined elsewhere
4. **No entropy detection**: High-entropy strings that don't match patterns are missed

**Fix**: Integrate `gitleaks` or `trufflehog` patterns, add entropy scoring, and implement AST-aware scanning for JS/TS.

### 3.2 Handlebars `noEscape: true` is Dangerous
**File**: `src/templater/engine.ts`

```typescript
hbs.compile(source, { noEscape: true, strict: false })
```

`noEscape: true` disables HTML escaping. While this is intentional for markdown output, if user-supplied content (from `vars`) contains malicious payloads, it can corrupt generated files or inject markdown/HTML payloads.

**Fix**: Only disable escaping for trusted template sources, never for user `vars`.

### 3.3 Prototype Pollution in Context Handling
**File**: `src/templater/engine.ts` — `deepFreeze()`

```typescript
function deepFreeze(obj: T): T {
  Object.getOwnPropertyNames(obj).forEach((name) => {
    const value = (obj as Record<string, unknown>)[name];
    if (value && typeof value === "object") deepFreeze(value);
  });
  return Object.freeze(obj);
}
```

This only freezes own properties. It does **not**:
- Freeze prototype chain (`Object.getPrototypeOf`)
- Handle `__proto__` or `constructor` keys in the input `vars`

**Impact**: Malicious `vars` could pollute the Handlebars context prototype.

**Fix**: Use `Object.setPrototypeOf(obj, null)` before freezing, or validate `vars` with Zod.

### 3.4 Audit Log Integrity Missing
**File**: `src/security/audit.ts`

Audit logs are written as plaintext JSON lines to `~/.bp/audit-YYYY-MM-DD.log`:
- No cryptographic signing
- No append-only protection
- No tamper detection
- Each log entry generates a **new** correlation ID instead of reusing the command's correlation ID

**Impact**: Audit logs cannot be used as compliance evidence.

**Fix**: 
1. Reuse the command's correlation ID from `logger.ts`
2. Sign each log entry with HMAC
3. Write to an append-only stream with integrity checks

### 3.5 Path Traversal in `resolveCodexCommandsPath`
**File**: `src/cli/commands/init.ts`

```typescript
const resolved = path.resolve(path.normalize(path.join(base, "prompts")));
if (!resolved.startsWith(base + path.sep) && resolved !== base) {
  throw new SecurityError("Path traversal detected");
}
```

This check is vulnerable on Windows (`path.sep` is `\` but `startsWith` may fail with mixed separators). Also, `path.normalize` doesn't resolve symlinks.

**Fix**: Use `path.resolve(base, "prompts")` and compare with `path.relative(base, resolved)` ensuring no `..` prefix.

### 3.6 Hardcoded Mock Cryptographic Key
**File**: `src/registry/signer.ts`

```typescript
export const DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA01v6jJqN1wP8R6+27/Zc
...
-----END PUBLIC KEY-----`;
```

This is a **fake/hardcoded** RSA public key. The `verifySignature` function will always fail against real signatures, but the presence of a hardcoded key suggests the signing system is not production-ready.

**Impact**: Template package integrity verification is effectively non-functional.

**Fix**: Load public keys from a configurable keyring or environment variable. Remove the hardcoded mock.

### 3.7 Registry Client Test Code in Production Path
**File**: `src/registry/client.ts`

```typescript
if (RegistryClient.mockRegistry.size > 0 || process.env.NODE_ENV === "test" || this.registryUrl.includes("mock")) {
  // use mock registry
}
```

`NODE_ENV` check in production code is an anti-pattern. An attacker can set `NODE_ENV=test` to bypass real registry validation.

**Fix**: Remove all `NODE_ENV` branches from production code. Use dependency injection for test doubles.

### 3.8 No Rate Limiting / Resource Limits
**File**: `src/validator/index.ts`

The validator reads all blueprint files into memory and runs 4 layers of validation. There is no:
- Maximum file count limit
- Maximum file size limit (beyond manifest config)
- Timeout for validation
- Memory usage cap

**Impact**: A malicious repo with thousands of large `.md` files can cause OOM or CPU exhaustion.

**Fix**: Add resource guards:
```typescript
const MAX_FILES = 1000;
const MAX_TOTAL_SIZE = 50 * 1024 * 1024; // 50MB
const VALIDATION_TIMEOUT = 30000; // 30s
```

### 3.9 Weak Output Hash for Drift Detection
**File**: `src/validator/drift.ts`

```typescript
export function computeOutputHash(output: string): string {
  const normalized = output.toLowerCase().replace(/\s+/g, " ").trim();
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
```

This is a 32-bit non-cyclic string hash (similar to Java's `String.hashCode()`). It has:
- High collision probability
- No cryptographic properties
- Easy to craft collisions

**Impact**: Drift detection can be bypassed or falsely triggered.

**Fix**: Use `crypto.createHash('sha256')`.

### 3.10 LSP Server Uses `require()`
**File**: `src/lsp/server.ts`

```typescript
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createConnection } = require("vscode-languageserver/lib/node/main");
```

This bypasses TypeScript type checking and ESM module resolution. It also creates a runtime dependency on CommonJS internals that may break with future `vscode-languageserver` updates.

**Fix**: Use proper ESM imports or add a typed wrapper.

### 3.11 Missing Security Headers / CI Scans
The CI pipeline (`ci.yml`) runs `npm audit --audit-level=high` but lacks:
- Snyk or OWASP dependency check
- CodeQL analysis
- Secret scanning (GitHub Advanced Security)
- SARIF output generation

---

## 4. Suggested Improvements (Claude Code Work Items)

### Priority 1: Security Hardening
1. **Replace regex secret scanning** with entropy-based detection + `gitleaks` pattern integration
2. **Add SARIF output** to `verify` command for GitHub Advanced Security integration
3. **Implement audit log integrity**: HMAC-sign each entry, reuse correlation IDs
4. **Remove `NODE_ENV` checks** from production code; use DI for testing
5. **Replace hardcoded `DEFAULT_PUBLIC_KEY`** with configurable keyring
6. **Add resource limits** to validator (max files, max size, timeout)
7. **Fix `computeOutputHash`** to use SHA-256

### Priority 2: Code Quality
8. **Migrate all sync fs calls** to async `FileSystem` abstraction (complete the `lint:no-sync-fs` enforcement)
9. **Refactor adapter registry** to dynamic imports or DI container; remove duplication in `doctor.ts`
10. **Add proper unified diff** using a standard library
11. **Validate `vars` input** with Zod before template rendering
12. **Fix silent catch blocks** to log structured errors via Pino

### Priority 3: Architecture
13. **Plugin sandboxing**: Run custom validators in a VM or worker thread
14. **Template cache TTL**: Add expiration to `templateCache` in `engine.ts`
15. **Backend version pinning**: Add `minBackendVersion` to `BackendConfig`
16. **Monorepo workspace parsing**: Detect `pnpm-workspace.yaml`, `turbo.json`, `nx.json` contents, not just presence
17. **Add property-based tests** with `fast-check` for validation layers

### Priority 4: Observability & Ops
18. **Add OpenTelemetry tracing** to validation layers (currently only telemetry schema exists, no instrumentation)
19. **Implement cost anomaly alerts** with proper statistical baseline (current std-dev math is naive)
20. **Add structured metrics export** for CI dashboards (Prometheus/Datadog)

---

## 5. Quick Wins for Claude Code

When working with this repo in Claude Code, focus on these high-impact, low-effort fixes:

1. **Run `bp verify --level all` on itself** — dogfood the tool to find its own structural issues
2. **Add `fs/promises` migration** to `templater/index.ts` and `writer.ts` — the `FileSystem` interface already exists
3. **Replace `computeOutputHash`** with `crypto.createHash('sha256')` — 5-line change
4. **Add Zod validation for `vars`** in `templater/index.ts` — prevents injection
5. **Fix `doctor.ts` `getAdapterByName`** to use `translator/index.ts` registry — removes 50 lines of duplication
6. **Add `fast-check` property tests** for `validateStructuralBatch` — the dependency is already installed

---

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation Priority |
|------|-----------|--------|---------------------|
| Secret leakage undetected | High | Critical | P1 |
| Audit log tampering | Medium | High | P1 |
| Template injection via vars | Medium | High | P1 |
| DoS via large repo validation | Medium | Medium | P2 |
| Registry signature bypass | Low | High | P1 |
| Path traversal on Windows | Low | Medium | P2 |
| Prototype pollution | Low | Medium | P2 |
| Backend adapter maintenance burden | High | Low | P3 |

---

*Analysis generated for open-blueprint v1.0.0 (commit: main)*
*Date: 2026-05-30*
