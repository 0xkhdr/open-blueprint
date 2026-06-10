# Stage 4 Tasks — Plugin API v1

Prereq: Stage 1 merged. Keep `npm run ci` green per group.

## 1. Public API

- [ ] 1.1 Create `src/plugin/index.ts`: `definePlugin` (Zod-validated), `BpPlugin`, `PluginValidator`, `ValidationContext`, `BlueprintFileInfo` types (spec §1).
- [ ] 1.2 Add `exports["./plugin"]` (+ types) to package.json; confirm `tsc` emits d.ts and an external consumer import type-checks (add a small test importing the built subpath).
- [ ] 1.3 Unit tests: definePlugin rejects bad name/version/level/duplicate validator ids.

## 2. Config & discovery

- [ ] 2.1 Extend project config schema (`src/config/project.ts`) with `plugins` array (path, mode); Zod entry schema.
- [ ] 2.2 Path containment guard (no `..`/outside-root) ⇒ `PLUGIN_PATH_ESCAPE`; unit tests.

## 3. Execution engines

- [ ] 3.1 Create `src/plugins/worker-entry.ts`: receive payload, dynamic-import plugin, run validators per level, post diagnostics; serialize errors safely.
- [ ] 3.2 Create `src/plugins/worker-host.ts`: spawn worker with `resourceLimits`, structured-clone payload, hard timeout via `worker.terminate()` (`BP_PLUGIN_TIMEOUT_MS`, default 10000), map to `PluginTimeoutError`/`PluginLoadError`.
- [ ] 3.3 Implement `inline` mode (direct import, same API), deep-freeze shared context objects.
- [ ] 3.4 Rewrite `src/plugins/loader.ts` to route both modes; delete `src/plugins/sandbox.ts` and vm usage; update `src/errors.ts` only if signatures change.
- [ ] 3.5 Tests: timeout kill (infinite loop fixture), crash isolation, mode parity, payload immutability.

## 4. Validator integration

- [ ] 4.1 Rework plugin invocation in `src/validator/index.ts`: build `ValidationContext` after IR parse + file collection; run plugin validators grouped by level; merge diagnostics with `PLUGIN_<name>_<id>` types.
- [ ] 4.2 `PLUGIN_CRASHED` single-error containment per plugin; `--no-plugins` flag on verify.
- [ ] 4.3 Integration test: fixture repo + `.bp.json` plugins; verify output includes plugin diagnostics at correct level.

## 5. DX commands

- [ ] 5.1 `bp dev plugin:scaffold <name>` emitting runnable rationale-on-hard-rules example.
- [ ] 5.2 `bp dev plugin:test <path>` run-against-repo with exit codes; tests for both.

## 6. Docs & wrap-up

- [ ] 6.1 Rewrite `docs/plugin-api.md`: real API, modes, limits, plain-language trust/security section (no sandbox-security claims anywhere — grep docs for "sandbox").
- [ ] 6.2 Update `docs/commands.md` (dev plugin:*, verify --no-plugins), `docs/configuration.md` (plugins key).
- [ ] 6.3 Confirm acceptance criteria 1–7; `npm run ci` green.
