## 1. P1 Security: Hash and Registry Fixes

- [ ] 1.1 Replace `computeOutputHash` in `src/validator/drift.ts` with `crypto.createHash('sha256')`
- [ ] 1.2 Remove `NODE_ENV === "test"` and `mockRegistry` branch from `src/registry/client.ts`; add `registryAdapter` constructor injection parameter
- [ ] 1.3 Remove hardcoded `DEFAULT_PUBLIC_KEY` from `src/registry/signer.ts`; load from `BP_REGISTRY_PUBLIC_KEY` env var or `~/.bp/keys/` keyring file; emit warn and fall back to no-verify if unset
- [ ] 1.4 Fix `path traversal` check in `src/cli/commands/init.ts` `resolveCodexCommandsPath` to use `path.relative` with `..` prefix check instead of `startsWith`
- [ ] 1.5 Fix `deepFreeze` in `src/templater/engine.ts` to null-prototype input before freezing (use `JSON.parse(JSON.stringify(obj))` round-trip)

## 2. Secure Vars Validation (spec: secure-vars-validation)

- [ ] 2.1 Add `TemplateVarsValidationError` class to `src/templater/errors.ts`
- [ ] 2.2 Write Zod schema for `vars` in `src/templater/index.ts`: `z.record(z.string(), z.unknown())`, max depth 5, max string length 10,000, blocked Handlebars helper key names
- [ ] 2.3 Call Zod validation in `sanitizeTemplateVars()` before any processing; throw `TemplateVarsValidationError` on failure
- [ ] 2.4 Add prototype-strip round-trip (`JSON.parse(JSON.stringify(vars))`) after validation, before `deepFreeze`
- [ ] 2.5 Add unit tests for all scenarios in `specs/secure-vars-validation/spec.md`

## 3. Audit Integrity (spec: audit-integrity)

- [ ] 3.1 Add `correlationId` parameter to `AuditLogger` constructor in `src/security/audit.ts`; add `setCorrelationId` method; default to a single session UUID if not provided
- [ ] 3.2 Propagate correlation ID from `logger.ts` context to `AuditLogger` at command entry points in `src/cli/commands/`
- [ ] 3.3 Implement HMAC-SHA256 signing: load key from `BP_AUDIT_HMAC_KEY`, compute `HMAC(JSON.stringify(entry))`, append `sig` field before writing
- [ ] 3.4 Emit Pino `warn` when `BP_AUDIT_HMAC_KEY` is not set; write entry with `sig: null`
- [ ] 3.5 Add unit tests for all scenarios in `specs/audit-integrity/spec.md`

## 4. Resource Limits (spec: resource-limits)

- [ ] 4.1 Add `ResourceLimitError` and `ValidationTimeoutError` classes to `src/validator/errors.ts`
- [ ] 4.2 Add constants `MAX_VALIDATION_FILES`, `MAX_VALIDATION_BYTES`, `VALIDATION_TIMEOUT_MS` to `src/validator/index.ts` with env var overrides
- [ ] 4.3 Implement pre-validation file count check; throw `ResourceLimitError` if exceeded
- [ ] 4.4 Implement pre-validation total byte size check; throw `ResourceLimitError` if exceeded
- [ ] 4.5 Wrap validation pipeline in `Promise.race` against timeout; throw `ValidationTimeoutError` with Pino warn on expiry
- [ ] 4.6 Add unit tests for all scenarios in `specs/resource-limits/spec.md`

## 5. Entropy Secret Scanning (spec: entropy-secret-scanning)

- [ ] 5.1 Implement `computeShannonEntropy(token: string): number` in `src/security/scan.ts`
- [ ] 5.2 Add 200-word exclusion list and repeated-char / short-base64 filters
- [ ] 5.3 Add `HIGH_ENTROPY_STRING` finding type to scan result types
- [ ] 5.4 Wire entropy scan into `scanContent()` behind `entropyEnabled` option; deduplicate against regex findings for same token position
- [ ] 5.5 Add `--entropy-scan` CLI flag to `bp verify` and `bp scan` commands
- [ ] 5.6 Add `scan.entropyEnabled` field to project manifest schema
- [ ] 5.7 Add unit tests for all scenarios in `specs/entropy-secret-scanning/spec.md`

## 6. Async Migration (complete lint:no-sync-fs enforcement)

- [ ] 6.1 Migrate `src/templater/index.ts` sync `fs.*` calls to injected `FileSystem` async methods
- [ ] 6.2 Migrate `src/templater/writer.ts` sync `fs.*` calls to injected `FileSystem` async methods
- [ ] 6.3 Migrate `src/templater/engine.ts` sync `fs.*` calls to injected `FileSystem` async methods
- [ ] 6.4 Migrate `src/security/audit.ts` sync `fs.*` calls to injected `FileSystem` async methods
- [ ] 6.5 Migrate `src/config/project.ts` sync `fs.*` calls to injected `FileSystem` async methods
- [ ] 6.6 Migrate `src/validator/structural.ts` sync `fs.*` calls to injected `FileSystem` async methods
- [ ] 6.7 Extend `lint:no-sync-fs` ESLint rule to cover all `src/` subdirectories (not just detector and validator)

## 7. Adapter Registry Refactor

- [ ] 7.1 Replace hardcoded 31-import `buildAdapterMap` in `src/translator/index.ts` with dynamic `import()` gated by a `KNOWN_BACKENDS` Set allowlist
- [ ] 7.2 Export `getAdapter(backend: string)` from `src/translator/index.ts`
- [ ] 7.3 Delete `getAdapterByName` switch statement from `src/cli/commands/doctor.ts`; replace with call to `src/translator/index.ts` `getAdapter`
- [ ] 7.4 Verify all 31 backends still resolve correctly; update adapter tests

## 8. Code Quality: Silent Errors and Diff

- [ ] 8.1 Replace all `catch { /* silent */ }` blocks in `src/detector/index.ts` (6 instances) with `logger.warn({ err }, '...')`
- [ ] 8.2 Replace silent catch blocks in `src/validator/drift.ts` (4 instances) with `logger.warn`
- [ ] 8.3 Replace silent catch blocks in `src/security/audit.ts` and `src/validator/cache.ts` with `logger.warn`
- [ ] 8.4 Add `diff` npm package to `package.json` dependencies
- [ ] 8.5 Replace `generateUnifiedDiff()` in `src/templater/writer.ts` with `diff.createPatch()` from the `diff` package
- [ ] 8.6 Add `--no-escape` → escape boundary: ensure `noEscape: true` in `engine.ts` applies only to the template source, not to `vars` values (vars are pre-encoded as literal strings before Handlebars sees them)

## 9. LSP and Misc Fixes

- [ ] 9.1 Replace `require("vscode-languageserver/lib/node/main")` in `src/lsp/server.ts` with proper ESM `import` statement
- [ ] 9.2 Verify `tsc --noEmit` passes after all async migrations and ESM fixes
- [ ] 9.3 Run `npm audit --audit-level=high` and confirm no new high-severity advisories from `diff` package addition

## 10. CI and Documentation

- [ ] 10.1 Add `CHANGELOG.md` entry documenting drift cache invalidation on upgrade (hash algorithm change)
- [ ] 10.2 Add `BP_AUDIT_HMAC_KEY`, `BP_REGISTRY_PUBLIC_KEY`, `BP_MAX_VALIDATION_FILES`, `BP_MAX_VALIDATION_BYTES`, `BP_VALIDATION_TIMEOUT_MS` to environment variable documentation
- [ ] 10.3 Add `--entropy-scan` flag to CLI help text and `docs/` command reference
- [ ] 10.4 Run full test suite (`npm test`) and confirm no regressions
