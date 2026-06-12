# Spec — Stage 6: API Surface & Plugin System Polish

**Status:** Draft — revise with Stage 2 (plugin surface trim) + Stage 5 findings
**Date:** 2026-06-12

## 1. Goal

Production-stable public API: `@agentic/bp/plugin` versioned and integration-tested, `exports`
map validated, config schemas migratable, sync-fs violation in config loading removed.

## 2. Design

### Plugin API
- `definePlugin` fully typed: inference for hook signatures, `ValidationContext` documented,
  no `any` in public surface.
- Plugin API version constant exported (e.g., `PLUGIN_API_VERSION`), independent of package
  version; compatibility matrix in `docs/plugin-api.md`; loader checks declared compatibility
  and fails loud with actionable BpError on mismatch.
- Integration test: real plugin fixture package consumed via the **built** `dist/plugin/index.js`
  subpath (not source import), loaded through worker-isolated runner; covers plugin-throws-
  during-validation path (must surface as validation error, not crash CLI).

### Exports map
- Validate `package.json` `exports` for `"."` and `"./plugin"`: import + types paths exist in
  `dist/` post-build. CI script `scripts/validate-exports.ts` (resolves each condition, asserts
  file exists, type-checks a consumer snippet).
- Note: top-level `"."` currently points at `dist/cli/index.js` — audit whether importing the CLI
  entry as a library makes sense; decision recorded (possible re-point to a lib entry is a
  breaking-change candidate → ask before changing).

### Config (`src/config/`)
- **Known violation:** `loadProjectConfig` uses `fs.existsSync` — refactor to async
  (`fs.access`/read-and-catch-ENOENT). Add the config files to the `lint:no-sync-fs` path list
  so regression is CI-caught.
- Zod error messages humanized: path + expected + received + doc link.
- Config schema versioning: `version` field, migration registry (`bp migrate` integration);
  unversioned legacy configs treated as v1 with logged upgrade hint.

### Docs sync
- `docs/plugin-api.md`, `docs/configuration.md`, `AGENTS.md` updated in same PR as surface
  changes.

## 3. Constraints

- `@agentic/bp/plugin` surface: additive changes only; removals need deprecation note + approval.
- No new runtime deps.

## 4. Exit criteria

- Plugin integration test green against built dist.
- `validate-exports` in CI. No sync fs in `src/config/`.
- `npm run ci` green.
