# Tasks — Stage 3: Error Handling & Observability Hardening

## 1. Error hierarchy

- [ ] **T1.1** Inventory all `BpError` subclasses: code, resolution, file/line support,
      troubleshooting anchor. Fill gaps.
- [ ] **T1.2** Implement `toSarif()` on `BpError` (delegate to `src/report/` serializer).
- [ ] **T1.3** Audit SecurityError/PermissionError exit-code-9 overlap; document decision in
      spec addendum + `docs/troubleshooting.md`.
- [ ] **T1.4** Tests to 100% coverage on `src/errors.ts`, incl. exit-code mapping exhaustiveness.

## 2. Catch-block audit

- [ ] **T2.1** Enumerate every `catch` in `src/` (grep + manual review); produce
      `review/stage-03/catch-audit.md` table.
- [ ] **T2.2** Replace `any`/generic catches with `unknown` + `BpError` narrowing guard.
- [ ] **T2.3** Eliminate silent suppressions; add `warn`/`error` logging with context or rethrow.

## 3. Logging

- [ ] **T3.1** Sweep for ad-hoc console/stdout writes outside `src/cli/`; route through logger.
- [ ] **T3.2** Correlation IDs via `AsyncLocalStorage`; verify propagation across async
      boundaries (worker threads for plugins — document loss boundary if unfixable).
- [ ] **T3.3** Audit redaction config vs. actual sensitive fields (secrets, keys, tokens, env).
- [ ] **T3.4** Confirm logger injectable per Stage 2 `ILogger`; kill remaining singleton imports
      in engines.

## 4. Telemetry

- [ ] **T4.1** Verify OTel no-op when no exporter; measure startup delta.
- [ ] **T4.2** Add span per validation level in `ValidationPipeline`.
- [ ] **T4.3** Timeout test: spans closed with timeout status when validation level times out.
- [ ] **T4.4** Assert no file contents/secrets in span attributes (test with fixture).

## 5. Wrap-up

- [ ] **T5.1** Update `docs/troubleshooting.md` + `docs/errors.md` for any changes.
- [ ] **T5.2** `npm run ci` green; write `review/stage-03/gaps.md` (async correlation losses,
      redaction coverage, timeout-span behavior).
