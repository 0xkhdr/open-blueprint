## Context

`open-blueprint` (`bp`) is a governance scaffolding CLI with 31 backend adapters, 4-layer validation, Handlebars templating, and structured audit logging. A comprehensive analysis identified 20 gaps across security, code quality, and architecture. The codebase already has a `FileSystem` abstraction (`src/utils/fs.ts`) supporting async and in-memory modes, Zod for schema validation, Pino for structured logging, and Vitest for testing. The project runs in Node.js with ESM modules.

## Goals / Non-Goals

**Goals:**
- Eliminate all identified P1 security vulnerabilities before any production CI/CD use
- Complete async migration of sync `fs.*` calls using the existing `FileSystem` abstraction
- Reduce silent failure surface by routing caught errors through Pino structured logging
- Refactor duplicated adapter registry logic between `translator/index.ts` and `doctor.ts`
- Add resource guards to the validation pipeline to prevent OOM/CPU exhaustion
- Ship new capabilities: Zod vars validation, HMAC audit integrity, entropy secret scanning, validator resource limits

**Non-Goals:**
- Plugin sandboxing (VM/worker thread isolation for custom validators) — architectural scope too large for this change
- OpenTelemetry instrumentation — separate observability initiative
- Monorepo workspace parsing improvements — separate detector enhancement
- Backend version pinning — separate translator initiative
- Property-based tests with `fast-check` — deferred to test coverage initiative

## Decisions

### D1: SHA-256 for drift hash via Node.js `crypto` (no new dep)
`drift.ts` uses a 32-bit rolling hash with easy collision probability. Replace with `crypto.createHash('sha256')` from Node.js built-ins. This invalidates existing drift caches on upgrade — acceptable; drift cache is a performance optimization, not persistent state. Alternative: `xxhash` for speed, but SHA-256 from builtins avoids a dependency and is sufficient for drift detection throughput.

### D2: Zod schema for template `vars` — null-prototype + depth limit
`sanitizeTemplateVars()` only strips shell metacharacters. Two-step fix: (1) validate with Zod schema enforcing `z.record(z.string(), z.unknown())` with max depth 5 and max string length 10,000; (2) strip prototype chain via `JSON.parse(JSON.stringify(vars))` before `deepFreeze`. Alternative: custom recursive validator — rejected; Zod already in deps and provides better error messages.

### D3: HMAC audit log integrity with `crypto.createHmac`
Each audit log entry gets an HMAC-SHA256 signature computed over `JSON.stringify(entry)` using a key loaded from `BP_AUDIT_HMAC_KEY` env var (falls back to a stable machine-derived key for local use). Correlation ID propagates from `logger.ts` context. Alternative: append-only filesystem — OS-dependent and complex; HMAC is portable and verifiable.

### D4: Entropy scoring added to secret scan, not replacing regex
Entropy-based detection (Shannon entropy > 4.5 bits/char for strings ≥ 20 chars) supplements existing patterns rather than replacing them. False positive rate is bounded by combining entropy threshold with context filters (exclude common words, base64 padding, repeated chars). Alternative: integrate `gitleaks` binary — adds external dependency and complicates distribution; in-process entropy is sufficient for P1 gap closure.

### D5: Dynamic adapter registry via `import()` with allowlist
`translator/index.ts` hardcodes 31 imports. Replace with `const mod = await import(\`./adapters/${backend}.js\`)` gated by a Set of known backend names (security allowlist to prevent path traversal). `doctor.ts` `getAdapterByName` is deleted and replaced by calling `translator/index.ts`'s registry. Alternative: DI container — overkill; dynamic import with allowlist achieves the goal with minimal new abstraction.

### D6: Resource limits as configurable constants with env override
Add `MAX_VALIDATION_FILES`, `MAX_VALIDATION_BYTES`, `VALIDATION_TIMEOUT_MS` as module-level constants with `process.env` overrides. Validation pipeline checks these before starting. Alternative: manifest config — adds schema churn; env vars are simpler for CI override.

### D7: Remove `NODE_ENV` from `registry/client.ts`; use constructor injection
The `NODE_ENV === "test"` branch is deleted. `RegistryClient` accepts an optional `registryAdapter` constructor parameter for test doubles. The hardcoded `DEFAULT_PUBLIC_KEY` in `signer.ts` is replaced by a required `publicKey` parameter loaded at call site from `BP_REGISTRY_PUBLIC_KEY` env var or a keyring file at `~/.bp/keys/`.

### D8: Async migration via `FileSystem` abstraction (already DI'd)
The `FileSystem` interface (`src/utils/fs.ts`) is already injected in most classes. The remaining sync `fs.*` calls are in files that bypass DI by importing `fs` directly. Fix: replace direct `import fs from 'fs'` with the injected `FileSystem` instance's async methods throughout the 6 affected files.

### D9: Silent catch blocks → structured Pino error logging
All `catch { /* silent */ }` blocks are replaced with `logger.warn({ err }, 'message')`. No rethrowing — callers that explicitly swallow errors (cache writes, audit appends, drift cache saves) keep swallowing but now emit observable warnings.

### D10: Unified diff via `diff` npm package
`writer.ts` `generateUnifiedDiff()` is replaced with `diff.createPatch()` from the `diff` npm package (already widely used, MIT licensed). Output is standard unified diff format parseable by `patch`, `git apply`, etc.

## Risks / Trade-offs

- **Drift cache invalidation on hash change** → Acceptable: cache is ephemeral. Document in CHANGELOG.
- **HMAC key management for local use** → Machine-derived fallback key means local audit logs are integrity-checked but not portable. Enterprise users must set `BP_AUDIT_HMAC_KEY`. Document clearly.
- **Entropy false positives** → Mitigated by context filters + threshold tuning. Users can opt out via `--no-entropy-scan` flag.
- **Dynamic adapter import security** → Backend name allowlist prevents path traversal. Any unknown name throws `UnsupportedBackendError` before import.
- **Async migration breaks in-memory test fakes** → The `FileSystem` abstraction already has an `InMemoryFileSystem` implementation; tests using it are unaffected. Tests using real `fs` sync calls need updating.

## Migration Plan

1. Merge changes — no config migration needed for most fixes
2. On first `bp verify` after upgrade: drift cache is invalidated (one-time re-check, expected)
3. For HMAC audit integrity: existing log files are not retroactively signed; new entries are signed from upgrade date
4. For registry key: if `BP_REGISTRY_PUBLIC_KEY` not set, registry signature verification emits a warning and falls back to no-verify mode (existing behavior) — breaking only when strict mode explicitly enabled

## Open Questions

- Should `BP_AUDIT_HMAC_KEY` be required in strict/enterprise mode or always optional? → Default: optional with warn. Strict mode enforcement deferred to enterprise config initiative.
- Should entropy scanning run by default or opt-in? → Default: opt-in via `--entropy-scan` flag. Can promote to default in next minor after false positive rate validated in practice.
