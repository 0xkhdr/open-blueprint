# Tasks — Stage 5: Security & Supply Chain Hardening

## 1. Input validation

- [ ] **T1.1** Inventory all Zod schemas; table: schema, strict?, external input?, action.
- [ ] **T1.2** Apply `strict()` where safe; document any `passthrough` retained.
- [ ] **T1.3** Implement `resolveWithin()` path-containment helper + unit tests (.., absolute,
      symlink escape).
- [ ] **T1.4** Apply at all fs-write/extraction sites (templater writer, pack install, registry
      client, config writes).

## 2. Crypto

- [ ] **T2.1** Audit `src/registry/signer.ts` for non-constant-time comparisons; fix with
      `timingSafeEqual`/`crypto.verify`.
- [ ] **T2.2** Malformed-signature tests: truncated, wrong-key, corrupted base64, empty —
      structured BpError each.
- [ ] **T2.3** Document trust keyring revocation status in gaps; propose design if missing.

## 3. Templates

- [ ] **T3.1** Grep templates + engine for `{{{`, `SafeString`, proto options; fix unescaped
      user-input interpolation.
- [ ] **T3.2** Add `lint:template-security` script to `lint:custom` chain.

## 4. Secret scanning

- [ ] **T4.1** Verify scan output/logs redact matched values; fix any leaks.
- [ ] **T4.2** Add false-positive corpus tests.

## 5. Supply chain

- [ ] **T5.1** `npm audit` — triage table in `review/stage-05/audit-triage.md`.
- [ ] **T5.2** Review dependencies vs devDependencies; pin critical security deps; verify OTel
      packages' placement matches optional-telemetry design.
- [ ] **T5.3** Validate `npm run sbom` CycloneDX output; add CI validation step.
- [ ] **T5.4** Write `docs/security.md` linking root `SECURITY.md`.

## 6. Wrap-up

- [ ] **T6.1** `npm run ci` green; write `review/stage-05/gaps.md` (eval-like template patterns,
      keyring revocation, malformed-artifact behavior).
