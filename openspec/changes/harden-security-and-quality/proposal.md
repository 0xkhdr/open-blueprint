## Why

The `bp` CLI has 20 identified gaps across security, code quality, and architecture that block safe use in production CI/CD pipelines and enterprise environments. These include exploitable attack vectors (template injection, prototype pollution, secret scanning bypasses, audit log tampering) and structural problems (sync I/O blocking the event loop, silent error swallowing, duplicated adapter registry logic) that create maintenance and reliability risk.

## What Changes

- Replace 32-bit rolling hash in `drift.ts` with SHA-256 via `crypto.createHash`
- Remove `NODE_ENV` guard from `registry/client.ts` production code path
- Remove hardcoded RSA mock key from `registry/signer.ts`; load from configurable keyring
- Add Zod validation for `vars` in `templater/index.ts` before template rendering
- Fix `deepFreeze` in `engine.ts` to null-prototype input objects before freezing
- Add resource limits to `validator/index.ts` (max files, max total size, timeout)
- Fix silent `catch` blocks across `detector`, `drift`, `audit`, `cache` to emit structured Pino errors
- Migrate sync `fs.*` calls in `templater/index.ts`, `writer.ts`, `engine.ts`, `security/audit.ts`, `config/project.ts`, `validator/structural.ts` to async `FileSystem` abstraction
- Refactor hardcoded adapter registry in `translator/index.ts` to dynamic imports; deduplicate `doctor.ts` `getAdapterByName`
- Replace naive unified diff in `writer.ts` with `diff` npm package output
- Add HMAC signing + correlation ID reuse to `security/audit.ts` log entries
- Add entropy scoring to `security/scan.ts` secret detection alongside existing regex patterns

## Capabilities

### New Capabilities
- `secure-vars-validation`: Zod-based validation of template vars input before Handlebars rendering — prevents injection and prototype pollution
- `resource-limits`: File count, total size, and timeout guards on the validation pipeline
- `audit-integrity`: HMAC-signed audit log entries with correlation ID propagation
- `entropy-secret-scanning`: Entropy-based high-entropy string detection augmenting regex patterns in secret scanning

### Modified Capabilities

## Impact

- `src/validator/drift.ts`: hash function replacement (output format changes — drift cache invalidated on upgrade)
- `src/registry/client.ts`, `src/registry/signer.ts`: registry auth and key loading paths change
- `src/templater/index.ts`, `src/templater/writer.ts`, `src/templater/engine.ts`: async migration + vars validation
- `src/security/audit.ts`, `src/security/scan.ts`: audit integrity + entropy scanning
- `src/validator/index.ts`, `src/validator/structural.ts`, `src/validator/drift.ts`, `src/validator/cache.ts`: resource limits + async migration + structured error logging
- `src/translator/index.ts`, `src/cli/commands/doctor.ts`: adapter registry refactor
- `src/config/project.ts`: async migration
- `package.json`: adds `diff` npm package dependency
