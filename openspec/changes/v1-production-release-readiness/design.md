## Context

`@agentic/bp` is a TypeScript CLI published as an ES module to npm. The release pipeline uses `semantic-release` driven by conventional commits, triggered on every push to `main`. Current blockers prevent the CI from completing: Biome lint fails with 29 errors, branch coverage sits at 74.31% against a 75% threshold, and the CHANGELOG/docs carry forward-looking "v2.0" references that contradict the inaugural v1.0.0 identity. No git tags exist yet; no prior npm publish has occurred. Release must produce exactly one tag: `v1.0.0`.

## Goals / Non-Goals

**Goals:**
- Zero lint errors (Biome check exits 0) before any release commit lands on `main`
- Branch coverage ≥ 75% (vitest threshold gate passes)
- CHANGELOG presents `[1.0.0]` as the first and only released version; `[Unreleased]` represents work that has not yet been tagged
- All public-facing docs use "v1.0.0" / "v1" nomenclature; no "v2.0" schema or package version strings
- `package.json` contains `publishConfig: { access: "public" }` so the scoped `@agentic/bp` package installs via `npx` without auth
- `SECURITY.md` and `CODE_OF_CONDUCT.md` present at repo root
- `.releaserc.json` includes `provenance: true` for npm attestation

**Non-Goals:**
- Achieving 90%+ branch coverage (target is exactly meeting the existing 75% threshold)
- Changing any public API surface, CLI commands, or output formats
- Planning for v2 or any subsequent release

## Decisions

### D1: Lint fix strategy — autofix then manual

Biome's `--write` flag auto-fixes all 29 errors (they are purely formatting violations plus one `any` type annotation). Run `npm run lint:fix` on the affected files, then manually type the single `any` usage. Alternatives: disabling lint rules (`// biome-ignore`) would hide real issues and ship suppressions into the public package history — rejected.

### D2: Coverage gap — targeted unit tests for uncovered branches

The shortfall is 0.69 percentage points (74.31% vs 75%). Highest-leverage uncovered paths per coverage report:
- `src/backends/adapters/base/` — 44.79% statement, 38.46% branch coverage
- `src/validator/alerting.ts` — 55.31% statement, 14.28% branch coverage  
- `src/backends/adapters/opendev.ts` — 45.16% statement
- `src/validator/drift.ts` — 71.13% statement

Adding branch tests for the adapter base classes and alerting thresholds will close the gap with the fewest new test lines. No production code changes needed.

### D3: CHANGELOG restructure — manual edit, not semantic-release rewrite

The `[2.0.0]` section was hand-authored ahead of any publish; semantic-release has no knowledge of it. Correct approach: rename `[2.0.0]` to `[1.0.0]` (it describes the actual current codebase), remove the stub `[1.0.0] — Initial release` entry at the bottom, and rename `[Unreleased]` to reflect post-tag work. semantic-release will prepend its own entry at the top on first run — the manually maintained sections below it become historical record. Alternative: delete all pre-written sections and let semantic-release generate from scratch — would lose the detailed changelogs already written; rejected.

### D4: Doc version scrub — sed-style targeted replacements

Three files reference "v2.0" or "open-blueprint v2.0": `docs/backend-adapter.md` (schema label), `docs/backend-parity.md` (header metadata), `docs/supported-tools.md` (schema label). Replace with "v1.0". No structural doc changes needed.

### D5: publishConfig — add to package.json, no .npmrc needed

Scoped npm packages default to `restricted` access. Adding `"publishConfig": { "access": "public" }` to `package.json` is the canonical solution recognized by both npm and semantic-release's `@semantic-release/npm` plugin. An `.npmrc` is an alternative but adds another file that could leak registry tokens if accidentally committed.

### D6: Provenance — add `provenance: true` to .releaserc.json

npm provenance links the published package to the exact GitHub Actions run that built it, providing sigstore-backed supply-chain transparency. No cost; requires no extra secrets; GitHub OIDC handles it automatically in the release workflow. Add `"provenance": true` inside the `@semantic-release/npm` plugin config object.

### D7: Community files — minimal but correct

`SECURITY.md`: GitHub-standard private vulnerability disclosure template pointing to `security@` or the GitHub private advisory feature. `CODE_OF_CONDUCT.md`: Contributor Covenant 2.1 (industry standard, zero maintenance overhead). Both go at repo root so GitHub surfaces them in the community health checklist.

## Risks / Trade-offs

- **[Risk] semantic-release first run bumps past 1.0.0** → Mitigation: verify commit history contains no `feat!` or `BREAKING CHANGE` footer commits; if any exist, semantic-release would emit 2.0.0. Audit commit log before triggering release workflow.
- **[Risk] Docker Scout scan fails on HIGH/CRITICAL CVE in base image** → Mitigation: the release workflow sets `continue-on-error: false` — a base image vuln blocks the release. Pin `node:22-alpine` to a digest or upgrade if Scout flags it.
- **[Risk] NPM_TOKEN secret absent from repo** → Mitigation: document in tasks as a pre-flight check; release workflow will fail at semantic-release step with clear auth error if missing.
- **[Risk] Biome autofix introduces whitespace-only commits that trip markdownlint** → Not applicable (lint:fix targets `.ts` source files only, not markdown).

## Migration Plan

No data migration. Deployment sequence:
1. Apply all code fixes on a feature branch (lint, coverage, changelog, docs, package.json, .releaserc.json, community files)
2. Open PR → CI must pass green end-to-end (typecheck, lint, test:coverage, build, e2e)
3. Merge to `main` → semantic-release triggers automatically, publishes `v1.0.0` to npm and creates GitHub Release

Rollback: no prior published version exists, so rollback means `npm deprecate @agentic/bp@1.0.0` + `npm unpublish` within the 72-hour window if a critical defect is found post-publish.

## Open Questions

- Does `NPM_TOKEN` exist in GitHub repository secrets? Must confirm before merging to `main`.
- Is Docker Scout scanning the final runner image or the builder stage? Confirm it scans the Alpine runner (smaller attack surface).
