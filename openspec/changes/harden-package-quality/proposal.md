## Why

`@agentic/bp` ships to npm but lacks three structural package-quality layers that modern Node.js packages require: a proper `exports` map (consumers can import any internal path), publish lifecycle guards (no `prepublishOnly` means a stale `dist/` can be published), and branch coverage that meets its own declared threshold (74.82% < 75%, CI fails). These gaps expose consumers to breaking internal-path imports and silently allow low-quality publishes.

## What Changes

- Add `exports` map to `package.json` — single public entry + conditional ESM, restricts internal imports
- Add `types` field to `package.json` — TypeScript consumers get type discovery without guessing
- Add `sideEffects: false` to `package.json` — enables tree-shaking in bundlers
- Add `prepublishOnly` script — runs `ci` before every `npm publish`, blocks bad publishes
- Add `prepare` script — runs `build` on `npm install` in dev/linked setups
- Fix branch coverage failures — bring `src/utils/input.ts`, `src/utils/errors.ts`, `src/validator/rules/backend-rules.ts` above threshold
- Remove broad CLI coverage exclusions — `src/cli/ui/**` and `src/cli/commands/**` excluded wholesale, masking real gaps; replace with targeted per-file exclusions only where coverage is structurally impossible (e.g., process exit handlers)
- Raise branch threshold from 75% to 80% once current failures fixed

## Capabilities

### New Capabilities

- `package-exports-hardening`: Proper `exports` map, `types`, `sideEffects` fields in `package.json` — public API surface locked, internal paths blocked from consumers, TypeScript types auto-discovered
- `publish-lifecycle-guards`: `prepublishOnly` and `prepare` lifecycle scripts — publish gates enforce CI pass, dev installs auto-build
- `coverage-gap-remediation`: Tests for uncovered branches in `input.ts`, `errors.ts`, `backend-rules.ts`; remove broad CLI exclusions; raise branch threshold to 80%

### Modified Capabilities

## Impact

- `package.json` — modified (exports, types, sideEffects, scripts)
- `vitest.config.ts` — modified (coverage thresholds, exclusion list)
- `tests/unit/utils/` — new test files for `input.ts`, `errors.ts`
- `tests/unit/validator/rules/` — new/extended tests for `backend-rules.ts`
- Consumers importing internal paths (`@agentic/bp/dist/...`) — **BREAKING**: blocked by exports map; only `@agentic/bp` (CLI entrypoint) is public
