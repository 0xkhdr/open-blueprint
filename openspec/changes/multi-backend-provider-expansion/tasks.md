## 1. Backend Registry

- [ ] 1.1 Create `src/backends/registry.ts` with `BackendConfig` interface and all 28 backend entries as `const BACKENDS`
- [ ] 1.2 Implement `getBackend(id)` helper that throws on unknown ID
- [ ] 1.3 Implement `listBackendIds()` helper returning all 28 IDs
- [ ] 1.4 Implement `getSkillOnlyBackends()` helper returning backends where `supportsCommands === false`
- [ ] 1.5 Write unit tests: all 28 IDs resolve, unknown ID throws, skill-only subset correct

## 2. Command Syntax Adapter

- [ ] 2.1 Create `src/backends/syntax.ts` with `CommandSyntaxAdapter` class
- [ ] 2.2 Implement `getInvocation(backendId, workflowId)` for all 4 syntax types (`colon`, `hyphen`, `bare`, `skill`)
- [ ] 2.3 Write unit tests for all 4 syntax variants and verify no import from `src/translator/adapters/`

## 3. Translator Adapter Base Classes

- [ ] 3.1 Create `src/translator/adapters/base/MarkdownAdapter.ts` with shared parse/render logic for standard `.md` backends
- [ ] 3.2 Create `src/translator/adapters/base/TomlCommandAdapter.ts` extending `MarkdownAdapter` with TOML command rendering
- [ ] 3.3 Create `src/translator/adapters/base/PromptMdAdapter.ts` extending `MarkdownAdapter` with `.prompt.md` extension handling
- [ ] 3.4 Create `src/translator/adapters/base/SkillOnlyAdapter.ts` with `renderCommand()` that throws and `renderSkill()` that includes usage examples

## 4. New Backend Adapter Implementations

- [ ] 4.1 Create `src/translator/adapters/amazon-q.ts` (extends `MarkdownAdapter`)
- [ ] 4.2 Create `src/translator/adapters/auggie.ts` (extends `MarkdownAdapter`)
- [ ] 4.3 Create `src/translator/adapters/bob.ts` (extends `MarkdownAdapter`)
- [ ] 4.4 Create `src/translator/adapters/cline.ts` (extends `MarkdownAdapter`, workflows path)
- [ ] 4.5 Create `src/translator/adapters/codebuddy.ts` (extends `MarkdownAdapter`, nested opsx path)
- [ ] 4.6 Create `src/translator/adapters/continue.ts` (extends `MarkdownAdapter`, `.prompt` extension)
- [ ] 4.7 Create `src/translator/adapters/costrict.ts` (extends `MarkdownAdapter`, deep nested path)
- [ ] 4.8 Create `src/translator/adapters/crush.ts` (extends `MarkdownAdapter`, nested opsx path)
- [ ] 4.9 Create `src/translator/adapters/factory.ts` (extends `MarkdownAdapter`)
- [ ] 4.10 Create `src/translator/adapters/forgecode.ts` (extends `SkillOnlyAdapter`)
- [ ] 4.11 Create `src/translator/adapters/iflow.ts` (extends `MarkdownAdapter`)
- [ ] 4.12 Create `src/translator/adapters/junie.ts` (extends `MarkdownAdapter`)
- [ ] 4.13 Create `src/translator/adapters/kilocode.ts` (extends `MarkdownAdapter`, workflows path)
- [ ] 4.14 Create `src/translator/adapters/kimi.ts` (extends `SkillOnlyAdapter`, skill syntax invocation)
- [ ] 4.15 Create `src/translator/adapters/lingma.ts` (extends `MarkdownAdapter`, nested opsx path)
- [ ] 4.16 Create `src/translator/adapters/opencode.ts` (extends `MarkdownAdapter`)
- [ ] 4.17 Create `src/translator/adapters/qoder.ts` (extends `MarkdownAdapter`, nested opsx path)
- [ ] 4.18 Create `src/translator/adapters/roocode.ts` (extends `MarkdownAdapter`)
- [ ] 4.19 Create `src/translator/adapters/trae.ts` (extends `SkillOnlyAdapter`, bare syntax invocation)
- [ ] 4.20 Create `src/translator/adapters/windsurf.ts` (extends `MarkdownAdapter`, workflows path)
- [ ] 4.21 Add `qwen` adapter to use `TomlCommandAdapter` base (update existing `qwen` if it exists, or create)

## 5. Update Translator Registry

- [ ] 5.1 Update `src/translator/index.ts` `parseBlueprint()` to import and register all 28 adapters
- [ ] 5.2 Update `src/translator/index.ts` `renderBlueprint()` (if separate) to register all 28 adapters
- [ ] 5.3 Write integration test: `parseBlueprint(root, id)` resolves without `Unknown backend` for all 28 IDs

## 6. IR Meta Extension

- [ ] 6.1 Add `target_backends?: string[]` to `MetaSchema` in `src/translator/ir.ts`
- [ ] 6.2 Update `MetaSchema` Zod type and TypeScript `Meta` type export
- [ ] 6.3 Verify existing adapter tests still pass (backwards-compatible field addition)

## 7. Config Schema v2

- [ ] 7.1 Add `backends?: string[]` and `primary_backend?: string` fields to `ProjectConfigSchema` in `src/config/project.ts`
- [ ] 7.2 Add `backend_configs?: Record<string, BackendConfigOverride>` field with `delivery_mode` and `workflows` subfields
- [ ] 7.3 Add Zod `.transform()` to normalize v1 `backend` → v2 `backends + primary_backend` at read time
- [ ] 7.4 Update `initProjectConfig()` to write v2 format
- [ ] 7.5 Add `codex_home` field to global config in `src/config/user.ts`
- [ ] 7.6 Write unit tests for v1→v2 transform and `primary_backend not in backends` validation

## 8. CLI — bp init

- [ ] 8.1 Replace hardcoded `SUPPORTED_BACKENDS` in `src/cli/commands/init.ts` with `listBackendIds()` from registry
- [ ] 8.2 Add `--tools <ids>` option to `bp init` (comma-separated, accepts `all`)
- [ ] 8.3 Add `--dry-run` flag to `bp init` that prints file list without writing
- [ ] 8.4 Implement multi-backend scaffolding loop: iterate resolved backend list, call render for each
- [ ] 8.5 Add codex `--confirm-global` flag and interactive TTY prompt for global path writes
- [ ] 8.6 Add github-copilot IDE-only warning emission
- [ ] 8.7 Write `.bp.json` in v2 format after multi-backend init
- [ ] 8.8 Write integration tests for `--tools claude,cursor`, `--tools all`, codex confirmation, copilot warning

## 9. CLI — bp convert

- [ ] 9.1 Replace hardcoded backend list in `src/cli/commands/convert.ts` with `listBackendIds()` from registry
- [ ] 9.2 Add skill-only target handling: call `SkillOnlyAdapter.renderSkill()` with usage examples, skip command files
- [ ] 9.3 Add skill-only source handling: read skill content and feed to target adapter
- [ ] 9.4 Add TOML target routing: ensure TOML adapter is selected for `gemini`/`qwen`
- [ ] 9.5 Add global path target routing: write to resolved `$CODEX_HOME` for `codex`
- [ ] 9.6 Add github-copilot target: ensure `.prompt.md` extension and emit IDE-only note
- [ ] 9.7 Write integration tests for: claude→windsurf, claude→kimi (skill-only), claude→gemini (TOML), claude→codex (global), forgecode→claude (skill-only source)

## 10. CLI — bp doctor

- [ ] 10.1 Add `--tool <backend-id>` option to `src/cli/commands/doctor.ts`
- [ ] 10.2 Add `--all` flag to diagnose all backends in `.bp.json`
- [ ] 10.3 Implement per-backend check function: skills dir exists, commands dir exists (if applicable), expected files present, extensions correct
- [ ] 10.4 Add codex global path check: `$CODEX_HOME/prompts/` exists and is writable
- [ ] 10.5 Add github-copilot always-warn rule
- [ ] 10.6 Write unit tests with temp directories: healthy backend, missing skills dir, codex missing global path

## 11. CLI — JSON Output

- [ ] 11.1 Add `--json` flag to `bp init` with structured output
- [ ] 11.2 Add `--json` flag to `bp verify` with `{status, errors, warnings}` shape
- [ ] 11.3 Add `--json` flag to `bp convert` with `{status, filesWritten}` shape
- [ ] 11.4 Add `--json` flag to `bp doctor` with `{backends: [{id, healthy, skills, commands, warnings}]}` shape
- [ ] 11.5 Add `--json` flag to `bp drift` with per-backend drift status array
- [ ] 11.6 Ensure `--json` suppresses all spinner/color output from stdout
- [ ] 11.7 Write tests verifying JSON output shape matches documented schema

## 12. Validator — Backend-Specific Rules

- [ ] 12.1 Create `src/validator/rules/backend-rules.ts` with `BackendValidationRule` interface
- [ ] 12.2 Implement `skill-only-no-commands` rule for `kimi`, `trae`, `forgecode`
- [ ] 12.3 Implement `toml-command-format` rule for `gemini`, `qwen` (TOML syntax check)
- [ ] 12.4 Implement `codex-global-path` rule (checks `$CODEX_HOME` existence and writability)
- [ ] 12.5 Implement `github-copilot-ide-only` warning rule
- [ ] 12.6 Implement `multi-backend-no-conflicts` rule (same rule ID, conflicting severity across backends)
- [ ] 12.7 Implement `backend-presence-check` rule (backend in config → files exist; files exist → backend in config)
- [ ] 12.8 Wire backend rules into validator engine run, gated by `appliesTo` matching `.bp.json` backends
- [ ] 12.9 Write unit tests for each rule

## 13. Drift — Multi-Backend

- [ ] 13.1 Update drift detection in `src/validator/` to iterate all `backends` from `.bp.json`
- [ ] 13.2 Add per-backend drift status reporting (`in sync`, `drifted`, `missing`, `orphaned`)
- [ ] 13.3 Add `missing` detection: backend in `backends` but no skill/command dirs
- [ ] 13.4 Add `orphaned` detection: backend dirs exist but not in `backends`
- [ ] 13.5 Write integration tests for each drift state per backend

## 14. Documentation

- [ ] 14.1 Create `docs/supported-tools.md` with full 28-backend table (paths, syntax, extensions, notes)
- [ ] 14.2 Add command syntax reference section to `docs/supported-tools.md`
- [ ] 14.3 Add multi-backend setup guide to `docs/supported-tools.md`
- [ ] 14.4 Add backend-specific limitations section (IDE-only, global paths, skill-only)
- [ ] 14.5 Create `docs/json-output.md` documenting JSON shape for all CLI commands
- [ ] 14.6 Update `README.md` with backend compatibility matrix
- [ ] 14.7 Add `bp migrate config` command description to docs

## 15. Migration Command

- [ ] 15.1 Create `bp migrate config` subcommand that reads `.bp.json` v1 and rewrites as v2
- [ ] 15.2 Add deprecation warning in `bp doctor` output when `backend` field (v1) is detected
- [ ] 15.3 Write unit test: `bp migrate config` on v1 file produces correct v2 output
