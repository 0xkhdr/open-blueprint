## 1. Package Exports Hardening

- [x] 1.1 Add `exports` field to `package.json` with single `"."` entry using conditional `types` and `import` keys pointing to `./dist/cli/index.d.ts` and `./dist/cli/index.js`
- [x] 1.2 Add `"types": "./dist/cli/index.d.ts"` field to `package.json`
- [x] 1.3 Add `"sideEffects": false` field to `package.json`
- [x] 1.4 Verify Node.js rejects an internal path import (e.g., `import "@agentic/bp/dist/validator/index.js"` throws `ERR_PACKAGE_PATH_NOT_EXPORTED`)

## 2. Publish Lifecycle Guards

- [x] 2.1 Add `"prepublishOnly": "npm run ci"` to `scripts` in `package.json`
- [x] 2.2 Add `"prepare": "npm run build"` to `scripts` in `package.json`
- [x] 2.3 Confirm `npm pack --dry-run` succeeds and lists only `dist/` and `templates/` files

## 3. Coverage: input.ts Unit Tests

- [x] 3.1 Create `tests/unit/utils/input.test.ts`
- [x] 3.2 Write test: valid string ≤256 chars with no disallowed chars → returns string
- [x] 3.3 Write test: string of exactly 257 chars → throws `InputValidationError` with correct message
- [x] 3.4 Write test: string containing a null byte (`\x00`) → throws `InputValidationError`
- [x] 3.5 Write test: string containing a control character (e.g., `\x1F`) → throws `InputValidationError`
- [x] 3.6 Confirm `input.ts` line coverage reaches ≥95% after tests

## 4. Coverage: errors.ts Unit Tests

- [x] 4.1 Create or extend `tests/unit/utils/errors.test.ts`
- [x] 4.2 Write test: `normalizeError(new Error("x"))` → returns same `Error` instance
- [x] 4.3 Write test: `normalizeError("msg")` → returns `Error` with message `"msg"`
- [x] 4.4 Write test: `normalizeError(42)` → returns `Error` with message `"42"`
- [x] 4.5 Write test: `normalizeError(null)` → returns `Error` with message `"null"`
- [x] 4.6 Write test: `normalizeError({ foo: 1 })` → returns `Error` with message `"[object Object]"`
- [x] 4.7 Confirm `errors.ts` line coverage reaches ≥95% after tests

## 5. Coverage: backend-rules.ts Unit Tests

- [x] 5.1 Create `tests/unit/validator/rules/backend-rules.test.ts`
- [x] 5.2 Write fixture helper: creates a tmp dir structure for a given backend (skills dir + optional commands dir)
- [x] 5.3 Write test: `skill-only-no-commands` rule → commands dir present → returns `SKILL_ONLY_BACKEND_HAS_COMMANDS` error for each skill-only backend (kimi, trae, forgecode)
- [x] 5.4 Write test: `skill-only-no-commands` rule → commands dir absent → returns empty array
- [x] 5.5 Write test: `skill-only-no-commands` rule → unknown backend id in list → skips without throwing
- [x] 5.6 Write tests for remaining exported rules in `BACKEND_RULES` covering their primary success and failure branches (one test pair per rule)
- [x] 5.7 Confirm `backend-rules.ts` branch coverage reaches ≥75% after tests

## 6. Coverage Config: Remove Broad Exclusions

- [x] 6.1 Remove `"src/cli/ui/**"` and `"src/cli/commands/**"` from `coverage.exclude` in `vitest.config.ts`
- [x] 6.2 Run `npm run test:coverage` and identify any CLI files that drop overall branch coverage below 80%
- [x] 6.3 For each `process.exit()` call in `src/cli/index.ts` that cannot be exercised in tests, add `/* v8 ignore next */` inline comment
- [x] 6.4 For other truly unreachable branches in CLI commands, add targeted per-line `/* v8 ignore next */` comments (document why each is unreachable in an adjacent comment)

## 7. Coverage Threshold Lift

- [x] 7.1 Update `vitest.config.ts` `coverage.thresholds.branches` from `75` to `80`
- [x] 7.2 Update `coverage.thresholds.lines` from `88` to `90`
- [x] 7.3 Update `coverage.thresholds.functions` from `89` to `90`
- [x] 7.4 Update `coverage.thresholds.statements` from `87` to `90`
- [x] 7.5 Run `npm run ci` and confirm full pass (zero failures)
