# Non-Functional Requirements

## Performance Budgets

| Command | P50 Latency | P99 Latency | Notes |
|---------|-------------|-------------|-------|
| `bp init` | < 800ms | < 2000ms | includes template rendering |
| `bp verify` | < 500ms | < 1500ms | per 100 rule files |
| `bp convert` | < 600ms | < 1800ms | per 50 rule files |
| `bp doctor` | < 300ms | < 800ms | local scan only |
| `bp health` | < 5000ms | < 10000ms | includes network HEAD check |
| `bp drift` | < 1000ms | < 3000ms | semantic diff scan |

## Reliability Targets

- **Availability**: `bp` is a dev/CI tool; no uptime SLA applies. Registry/marketplace fetch failures must degrade gracefully (exit 8, not panic).
- **Idempotency**: `bp init --force` must produce the same output for the same inputs. Running twice must not accumulate state.
- **Exit code stability**: Exit codes 0–10 are part of the public API and must not change after v1.0.0 without a BREAKING change in `CHANGELOG.md`.
- **Atomicity**: File writes use temp-file-then-rename where supported to prevent partial writes.

## OWASP Compliance Statements

| Concern | Control | Implementation |
|---------|---------|----------------|
| A1 – Broken Access Control | Path traversal prevention | `resolveAndValidatePath()` in `src/utils/paths.ts` rejects `..` escapes |
| A3 – Injection | Shell metacharacter sanitization | Template variable sanitization in `src/templater/index.ts` |
| A5 – Security Misconfiguration | No shell command execution in hooks | `validateHookSafety()` rejects `exec`/`spawn`/`fork` patterns |
| A6 – Vulnerable Components | Dependency scanning | `npm audit --audit-level=high` in CI; SBOM via `@cyclonedx/cyclonedx-npm` |
| A7 – Identification Failures | Sensitive field masking | `pino` redact list covers `apiKey`, `token`, `secret`, `password`, `credential`, `auth`, `authorization`, `cookie`, `privateKey` |
| A9 – Security Logging | Structured audit log | `logAudit()` records every command invocation with correlation ID |
| A10 – SSRF | URL scheme validation | Registry/marketplace fetches reject non-`https://` URLs |

## Security Hardening Baseline

- All path arguments resolved against `process.cwd()` as allowed base
- No `eval()` or `Function()` constructor usage in source
- No `child_process` usage at runtime (only in tests via `execSync`)
- Template rendering sandboxed through Handlebars (no code execution)
- Secrets never logged; `pino` redact list applied at logger creation
