## Why

`bp` currently supports 10 AI coding tool backends, but OpenSpec's ecosystem has grown to 28+ providers — leaving 18+ tools without native `bp` support. Teams using Windsurf, RooCode, Cline, Continue, Kilo Code, and others cannot scaffold, validate, or convert blueprints without manual file creation, defeating `bp`'s core purpose.

## What Changes

- **New backends registered (18 additions)**: amazon-q, auggie, bob, cline, codebuddy, continue, costrict, crush, factory, forgecode, iflow, junie, kilocode, kimi, lingma, opencode, qoder, qwen, roocode, trae, windsurf — bringing total from 10 to 28
- **Canonical backend registry**: Replace scattered per-file backend strings with a single `src/backends/registry.ts` exporting all 28 `BackendConfig` objects
- **Command syntax adapter**: Formalize the 4 syntax variants (`colon`, `hyphen`, `bare`, `skill`) into a `CommandSyntaxAdapter` that drives template rendering
- **Skill-only backends**: `kimi`, `trae`, `forgecode` generate skill files only; no command file generation for these
- **TOML command backends**: `gemini` and `qwen` generate `.toml` command files instead of `.md`
- **Global path backend**: `codex` writes commands to `$CODEX_HOME/prompts/` (global, not project-local)
- **`.prompt.md` backends**: `github-copilot` and `kiro` use `.prompt.md` extension with IDE-only warnings for copilot
- **Multi-backend `bp init`**: New `--tools <ids|all>` flag scaffolds multiple backends in one run
- **`bp convert` full matrix**: Conversion now works between any pair of all 28 backends
- **`bp doctor` expansion**: `--tool <backend>` and `--all` flag for per-backend diagnostics
- **`--json` output**: All CLI commands gain machine-readable JSON output flag
- **`.bp.json` schema v2**: `backend` (string) → `backends` (array) + `primary_backend` + `backend_configs` per-backend overrides
- **Backend-specific validation rules**: New rules for skill-only, TOML, global-path, and IDE-only backends
- **Multi-backend drift detection**: Drift checks run against all configured backends
- **IR expansion**: `BlueprintIR` gains `commands[]` and `skills[]` arrays with full invocation pattern metadata
- **Backend adapter implementations**: New translator adapters for all 18 new backends

## Capabilities

### New Capabilities

- `backend-registry`: Canonical registry of all 28 backend configs (id, paths, syntax, extensions, flags)
- `command-syntax-adapter`: Maps workflow IDs to correct slash command invocation strings per backend
- `multi-backend-init`: `bp init --tools <ids|all>` scaffolds multiple backends simultaneously
- `full-convert-matrix`: `bp convert` between any of 28 backend pairs with format/path translation
- `backend-doctor`: Per-backend and `--all` diagnostics with health reporting
- `skill-only-backends`: Backend type that generates only skill files, not command files
- `toml-command-backends`: Backend type that generates TOML command files
- `global-path-backends`: Backend type that writes commands to global (non-project) paths
- `multi-backend-config`: `.bp.json` v2 schema with `backends[]`, `primary_backend`, `backend_configs`
- `multi-backend-validation`: Backend-specific validation rules + multi-backend conflict detection
- `multi-backend-drift`: Drift detection across all configured backends
- `ir-commands-skills`: Expanded `BlueprintIR` with command and skill IR types + invocation patterns

### Modified Capabilities

- `backend-adapters`: 18 new adapter implementations added to translator; existing adapters updated to use registry config
- `cli-init`: `bp init` updated with `--tools` flag and multi-backend scaffolding
- `cli-convert`: `bp convert` updated with full 28-backend matrix and special-case handling
- `cli-doctor`: `bp doctor` updated with `--tool` and `--all` flags
- `cli-json-output`: `--json` flag added to all CLI commands

## Impact

- **`src/backends/registry.ts`**: New file — canonical backend registry
- **`src/translator/adapters/`**: 18 new adapter files; existing adapters refactored to use registry
- **`src/translator/ir.ts`**: `BlueprintIR` extended with `commands`, `skills`, metadata fields
- **`src/translator/index.ts`**: Updated to load all 28 adapters
- **`src/cli/commands/init.ts`**: `SUPPORTED_BACKENDS` expanded; `--tools` flag added
- **`src/cli/commands/convert.ts`**: Full 28-backend matrix; special handling for skill-only/TOML/global
- **`src/cli/commands/doctor.ts`**: `--tool` and `--all` flags; per-backend diagnostics
- **`src/validator/`**: New backend-specific validation rules; drift updated for multi-backend
- **`src/config/`**: `.bp.json` Zod schema v2; global config additions (`codex_home`, etc.)
- **`templates/backends/`**: New backend-specific template directories for all 28
- **`docs/supported-tools.md`**: New file with full backend compatibility matrix
- **Breaking**: `.bp.json` `backend` field superseded by `backends` + `primary_backend` (migration path provided)
