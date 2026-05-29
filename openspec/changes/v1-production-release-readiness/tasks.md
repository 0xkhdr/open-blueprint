## 1. Lint Gate — Fix Biome Errors

- [x] 1.1 Run `npm run lint:fix` to auto-fix all 29 formatting violations in `src/`
- [x] 1.2 Locate the single `unexpected any` error (reported by Biome) and replace it with a concrete TypeScript type
- [x] 1.3 Run `npm run lint` and confirm exit code 0 with zero errors and zero warnings
- [x] 1.4 Run `npm run typecheck` and confirm it still passes after the type fix

## 2. Coverage Gate — Raise Branch Coverage to ≥75%

- [x] 2.1 Identify the exact uncovered branches in `src/backends/adapters/base/` using the HTML coverage report at `coverage/index.html`
- [x] 2.2 Add unit tests for `src/backends/adapters/base/` error/fallback paths (target: bring branch coverage from 38% to ≥60% in this module)
- [x] 2.3 Add unit tests for `src/validator/alerting.ts` branch paths (currently 14.28% branch coverage)
- [x] 2.4 Add unit tests for `src/backends/adapters/opendev.ts` uncovered blocks (currently 45% statement coverage)
- [x] 2.5 Run `npm run test:coverage` and confirm branches ≥ 75%, lines ≥ 88%, functions ≥ 89%, statements ≥ 87%

## 3. CHANGELOG — Correct Version History

- [x] 3.1 Open `CHANGELOG.md` and rename the `[2.0.0] — 2026-05-28` heading to `[1.0.0] — 2026-05-28` (this section describes the actual first-release feature set)
- [x] 3.2 Remove the stub `[1.0.0] — Initial release` section at the bottom of the file (superseded by the renamed section)
- [x] 3.3 Verify the `[Unreleased]` section at the top is correct and only contains changes not yet tagged
- [x] 3.4 Confirm no occurrence of `[2.0.0]` remains in `CHANGELOG.md`

## 4. Docs — Scrub v2.0 Version References

- [x] 4.1 In `docs/backend-parity.md` change `**Version:** open-blueprint v2.0` to `**Version:** open-blueprint v1.0`
- [x] 4.2 In `docs/backend-adapter.md` change `BlueprintIRSchema (v2.0)` heading to `BlueprintIRSchema (v1.0)`
- [x] 4.3 In `docs/supported-tools.md` change the `v2 schema` reference to `v1 schema`
- [x] 4.4 Run `grep -r "open-blueprint v2\|schema.*v2\b" docs/ README.md CHANGELOG.md` and confirm zero matches

## 5. Registry — Configure npm Publish

- [x] 5.1 Add `"publishConfig": { "access": "public" }` to `package.json`
- [x] 5.2 In `.releaserc.json`, add `"provenance": true` inside the `@semantic-release/npm` plugin config object
- [ ] 5.3 Manually verify (out-of-band) that the `NPM_TOKEN` GitHub Actions secret is set in repository settings with a valid npm automation token

## 6. Community Files — Add SECURITY.md and CODE_OF_CONDUCT.md

- [x] 6.1 Create `SECURITY.md` at repo root using GitHub's private advisory template: include a Supported Versions table (`1.0.0 — Supported`), and instructions to report via GitHub's "Report a vulnerability" button
- [x] 6.2 Create `CODE_OF_CONDUCT.md` at repo root using Contributor Covenant 2.1 with `0xkhdr@gmail.com` as the enforcement contact

## 7. Pre-Release Verification

- [x] 7.1 Run the full CI suite locally: `npm run typecheck && npm run lint && npm run test:coverage && npm run build`
- [x] 7.2 Run `node dist/cli/index.js --version` and confirm it outputs `1.0.0`
- [x] 7.3 Run `npm run test:e2e` and confirm all E2E tests pass
- [x] 7.4 Run `npm run sbom` to verify SBOM generation completes without error
- [x] 7.5 Run `git tag --list` and confirm no tags exist (clean first-release state)
- [x] 7.6 Run `grep -r "\[2\.0\.0\]" CHANGELOG.md docs/` and confirm zero matches
- [x] 7.7 Confirm `package.json` version field reads `1.0.0`
- [ ] 7.8 Open a PR with all changes and wait for all CI jobs (test, bun, e2e, security, docs-health, sast) to pass green

## 8. Release Execution

- [ ] 8.1 Merge the PR to `main` — semantic-release triggers automatically
- [ ] 8.2 Monitor the `Release` workflow run in GitHub Actions; confirm `Semantic Release` step completes without error
- [ ] 8.3 Verify `v1.0.0` tag is created on `main` in the GitHub repository
- [ ] 8.4 Verify `@agentic/bp@1.0.0` appears on `https://www.npmjs.com/package/@agentic/bp`
- [ ] 8.5 Verify the GitHub Release is published with the SBOM asset attached
- [ ] 8.6 Smoke-test: run `npx @agentic/bp@1.0.0 --version` from a clean directory and confirm output is `1.0.0`
