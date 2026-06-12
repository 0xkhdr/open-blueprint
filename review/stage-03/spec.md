# Spec — Stage 3: Error Handling & Observability Hardening

**Status:** Draft — revise with Stage 1–2 findings before implementation
**Depends on:** Stage 2 `ILogger` injection, engine interfaces
**Date:** 2026-06-12

## 1. Goal

Bulletproof error system + structured observability: every error carries a stable code, an
actionable resolution, and file/line where possible; every suppressed error is logged; telemetry
is optional and leak-free.

## 2. Design

### Error hierarchy (`src/errors.ts`)
- Every `BpError` subclass: stable `code`, `resolution` linking to
  `docs/troubleshooting.md#code-N`, optional `file`/`line`/`suggestion`, `toSarif()` method
  (reuses `src/report/` SARIF model — no duplicate serializer).
- Exit-code mapping table tested exhaustively; property test for code uniqueness (feeds Stage 4).
- **Decision to document:** `SecurityError` and `PermissionError` sharing exit code 9 — audit
  call sites; either justify in spec addendum + troubleshooting doc, or split (splitting changes
  the public exit-code contract → only with explicit approval and `bp migrate` note).

### Catch-block policy
- No `catch (e: any)`; every catch narrows `unknown` → `BpError` via type guard or rethrows
  wrapped.
- No silent `catch { /* continue */ }`. Suppression allowed only with `logger.warn|error` +
  context (operation, path, correlation ID) + comment stating why suppression is safe.

### Logging
- All non-CLI output through injected Pino logger (Biome `noConsole: error` already enforces
  console ban; audit confirms no escapes via `process.stdout.write` outside CLI).
- Correlation IDs propagate through multi-step ops (init → detect → template → validate) using
  `AsyncLocalStorage` (node:async_hooks — no new dependency).
- Redaction list audited against actual sensitive fields: secret-scan matches, signature keys,
  user paths in telemetry.

### Telemetry (`src/observability/`, `src/telemetry/`)
- OTel strictly optional: no exporter configured → true no-op, zero startup cost (ties into
  Stage 7 lazy loading).
- Span per validation level (hooks into Stage 2 `ValidationPipeline`).
- Spans must close on validation timeout (record `timeout` status, not leak).
- Telemetry never serializes file contents or matched secrets.

## 3. Constraints

- Exit codes 0–10 unchanged (unless code-9 split explicitly approved).
- `docs/troubleshooting.md` anchors stable; doc updated in same PR as any error change.
- No new runtime deps.

## 4. Exit criteria

- `src/errors.ts` 100% test coverage.
- Catch-block audit table in `review/stage-03/catch-audit.md` (file:line, verdict, action).
- `npm run ci` passes.
