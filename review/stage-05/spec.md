# Spec — Stage 5: Security & Supply Chain Hardening

**Status:** Draft — revise with Stage 1–4 findings
**Date:** 2026-06-12

## 1. Goal

Harden a tool that writes into developer repos and verifies signed artifacts: strict input
validation, no path traversal, constant-time signature checks, safe templates, leak-free secret
scanning, valid SBOM.

## 2. Design

### Input validation
- Zod schema sweep: `strict()` (or `.passthrough()` with documented reason) on every external
  input schema (config, packs, lockfile, artifacts, IR, fingerprint files read from disk).
- Central path-containment helper in `src/utils/` (`resolveWithin(root, p)`): resolves and
  rejects escapes (`..`, absolute, symlink escape via `realpath`). Applied at every fs write and
  pack-extraction site. Throws `BpError` (security exit code).

### Crypto (`src/registry/signer.ts`)
- RSA verification uses `node:crypto` `verify`/`timingSafeEqual` — audit for any manual buffer
  comparison of signatures/digests; replace with constant-time.
- Malformed signature → structured `BpError` with resolution, never crash or silently pass
  (gap question: malformed-artifact behavior gets explicit tests).
- Trust keyring (`~/.bp/trust.json`): document revocation story; if absent, record as known
  limitation + proposed design in gaps (implementing revocation = scope decision, ask first).

### Templates
- Handlebars audit: no triple-stash `{{{ }}}` with user-controlled input; no
  `allowProtoPropertiesByDefault`; helpers can't reach prototype chain.
- CI grep check (extend `lint:custom`) for unsafe template patterns in `templates/` and
  template-compiling code.

### Secret scanning (`src/security/scan.ts`)
- Matched secret values never logged/reported verbatim — redacted form only (prefix + length).
- False-positive corpus tests (high-entropy non-secrets, example keys in docs).

### Supply chain
- `npm audit` triage: fix / upgrade / documented mitigation per finding.
- deps vs devDependencies review (OTel exporter/sdk currently in devDependencies — verify
  runtime optionality matches Stage 3 design).
- `npm run sbom` produces valid CycloneDX; validated in CI.
- New `docs/security.md` (threat model summary, reporting, hardening notes) — repo already has
  root `SECURITY.md`; docs page links it, no duplication.

## 3. Constraints

- Static analysis only — scanner/validator must not execute repo code.
- No new runtime deps; prefer `node:crypto`, `node:path`.

## 4. Exit criteria

- `npm audit` clean or mitigations documented in `review/stage-05/audit-triage.md`.
- Path traversal tests (unit + e2e attempt) passing.
- Template security check in CI. `npm run ci` green.
