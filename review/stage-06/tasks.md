# Tasks — Stage 6: API Surface & Plugin System Polish

## 1. Plugin API

- [ ] **T1.1** Audit `src/plugin/index.ts`: full typing on `definePlugin`, no `any`, JSDoc on
      every export.
- [ ] **T1.2** Add `PLUGIN_API_VERSION` + loader compatibility check + BpError on mismatch.
- [ ] **T1.3** Compatibility matrix in `docs/plugin-api.md`.
- [ ] **T1.4** Integration test: fixture plugin loaded via built `dist/plugin` subpath through
      worker runner.
- [ ] **T1.5** Test plugin-throws-during-validation → surfaced as validation failure, CLI exits
      with correct code.

## 2. Exports map

- [ ] **T2.1** Write `scripts/validate-exports.ts`; wire into CI.
- [ ] **T2.2** Audit `"."` export pointing at CLI entry; record decision (change = approval
      gate).

## 3. Config

- [ ] **T3.1** Refactor `loadProjectConfig` off `fs.existsSync` → async-only.
- [ ] **T3.2** Add `src/config/*.ts` to `lint:no-sync-fs` file list.
- [ ] **T3.3** Humanize Zod config errors (path, expected, received, doc link); tests.
- [ ] **T3.4** Config `version` field + migration registry + legacy-config handling; tests.

## 4. Docs

- [ ] **T4.1** Sync `docs/plugin-api.md`, `docs/configuration.md`, `AGENTS.md`.

## 5. Wrap-up

- [ ] **T5.1** `npm run ci` green; write `review/stage-06/gaps.md` (API size, config migration
      paths, plugin failure modes).
