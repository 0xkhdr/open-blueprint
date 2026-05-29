## Context

`bp` currently supports 10 backends (claude, cursor, opendev, generic, codex, pi, kiro, antigravity, copilot, gemini). Backend knowledge is scattered: adapter class files in `src/translator/adapters/`, a hardcoded `SUPPORTED_BACKENDS` array in `src/cli/commands/init.ts`, and per-adapter logic duplicating path construction. The `BlueprintIR` in `src/translator/ir.ts` models blueprint content layers but has no representation of command file metadata or invocation syntax. `.bp.json` stores a single `backend` string.

Adding 18 new backends without a registry would multiply this fragmentation: 18 new adapter files with duplicated path logic, 18 insertions into scattered string arrays, no shared validation rules, and no way to express skill-only or TOML-format semantics without one-off conditionals.

## Goals / Non-Goals

**Goals:**
- Single source of truth for all backend configs (`src/backends/registry.ts`)
- 18 new translator adapters covering all remaining OpenSpec-supported tools
- `bp init --tools <ids|all>` for multi-backend scaffolding
- `bp convert` between any pair of 28 backends
- `bp doctor --tool <id> / --all` for per-backend health checks
- `.bp.json` v2 schema: `backends[]` + `primary_backend` + `backend_configs`
- Backend-specific validator rules (skill-only, TOML, global-path, IDE-only)
- `--json` output on all CLI commands
- Backwards-compatible migration path for existing `.bp.json` `backend` field

**Non-Goals:**
- Live sync or auto-detection of which tool the user is currently running
- Per-backend CLAUDE.md / cursorrules content generation (out of scope for this change)
- Changing how the IR models blueprint layers (spatial anchor, personas, rules, etc.)
- Template pack marketplace (separate initiative)

## Decisions

### Decision 1: Canonical Backend Registry as a Plain TypeScript `const` Array

**Choice:** `src/backends/registry.ts` exports a `const BACKENDS` array of `BackendConfig` objects with `as const`, plus typed lookup helpers (`getBackend(id)`, `listBackendIds()`).

**Alternatives considered:**
- JSON file: loses TypeScript type inference and requires a parse step
- Class-based registry with registration: adds complexity; all 28 backends are known at build time
- Keeping per-adapter metadata in each adapter class: perpetuates fragmentation, makes CLI commands re-import every adapter just to enumerate supported IDs

**Rationale:** Static `as const` array gives full type inference, zero runtime overhead, and a single import for any code that needs backend metadata. CLI commands, validator, and templater all consume `registry.ts` without importing adapter implementations.

---

### Decision 2: Four-Group Adapter Architecture

Group backends by rendering behavior rather than writing 28 independent adapter classes:

| Group | Backends | Distinguishing trait |
|---|---|---|
| `MarkdownAdapter` (base) | 23 backends | `.md` files, standard paths |
| `TomlCommandAdapter` | gemini, qwen | TOML command files |
| `PromptMdAdapter` | github-copilot, kiro | `.prompt.md` extension |
| `SkillOnlyAdapter` | kimi, trae, forgecode | No command files; usage in SKILL.md |

Each new adapter extends the appropriate base and overrides only `getCommandPath()`, `renderCommand()`, and `getSkillPath()`. The `CodexAdapter` (already exists) is a special-case of `MarkdownAdapter` that resolves `$CODEX_HOME`.

**Rationale:** 18 new backends × duplicated render logic = fragile. The 4-group taxonomy matches the actual behavioral differences exactly. New backends added in future only need to pick a group and supply registry config.

---

### Decision 3: `CommandSyntaxAdapter` Decoupled from Adapter Classes

A standalone `CommandSyntaxAdapter` in `src/backends/syntax.ts` maps `(backendId, workflowId) → invocation string`. It reads from `registry.ts` only and has no dependency on translator adapters.

**Rationale:** Invocation syntax is needed by templater (to inject `commandPrefix` into Handlebars), by validator (to check command file frontmatter), and by the CLI `doctor` command — none of which need full parse/render adapters. Keeping it separate avoids circular deps.

---

### Decision 4: `.bp.json` v2 Schema — Additive, Not Replacing

`backends` (array) is added alongside `backend` (string). During read, if `backend` is present and `backends` is absent, `backends` defaults to `[backend]` and `primary_backend` defaults to `backend`. `backend` remains valid for write only during a migration window.

**Alternatives considered:**
- Hard rename `backend` → `backends`: breaks all existing `.bp.json` files with no warning
- Keep `backend` and make `backends` an alias: confusing to have two sources of truth long-term

**Rationale:** Additive schema change with a Zod `.transform()` that normalizes v1 → v2 shape at read time. Migration is transparent; users are only nudged to update via `bp doctor` warning.

---

### Decision 5: Multi-Backend `bp init` Writes in Parallel

`bp init --tools all` iterates the 28 backends and for each calls the existing `renderBlueprint()` pipeline. Files are written concurrently with `Promise.all`. The `.bp.json` is written once at the end with `backends: [all 28 ids]`.

**Rationale:** File I/O is the bottleneck; rendering is already fast. Concurrent writes reduce wall time for `--tools all` from ~28× serial to near-instant. No ordering dependency between backend outputs.

---

### Decision 6: `bp doctor` Backend Checks are Stateless Filesystem Probes

Each check function receives `(backendConfig, projectRoot)` and returns `{ healthy, skillCount, commandCount, warnings }`. No network, no parsing the IR — just `fs.existsSync` + `glob` counts.

**Rationale:** Doctor is a diagnostic tool; it should work even when the project is partially initialized or the IR is invalid. Stateless probes are also easily unit-testable with temp directories.

---

### Decision 7: IR `meta.source_backend` / `meta.target_backend` Already Exist; Extend, Don't Replace

The existing `MetaSchema` in `ir.ts` has `source_backend` and `target_backend` strings. These are extended to add `target_backends: string[]` (array, for multi-backend export) while keeping the singular fields for backwards compatibility with existing adapters.

No new top-level `commands[]` or `skills[]` arrays are added to `BlueprintIR` — the existing `commands` and `skills` arrays already exist for blueprint layer content. The command file invocation patterns are expressed via the `CommandSyntaxAdapter` at render time, not stored in IR.

**Rationale:** The IR models what a blueprint *means*, not how each tool represents it on disk. Adding per-backend file path metadata to the IR would couple the neutral representation to tooling details. Invocation patterns belong in the registry and syntax adapter.

## Risks / Trade-offs

**18 new adapter files with incomplete parse logic** → Mitigation: New adapters start with minimal `parse()` (reads whatever files exist, ignores missing) and complete `render()`. Partial parse is acceptable; `bp convert --from <new-backend>` will warn if source is sparse.

**`--tools all` generates hundreds of files in one repo** → Mitigation: Add a `--dry-run` flag that prints the file list without writing. Teams using selective backends are unaffected; `--tools all` is an explicit opt-in.

**`.bp.json` v1→v2 migration confusion** → Mitigation: `bp doctor` emits a `[WARN] backend field is deprecated; run bp migrate config` message. `bp migrate config` rewrites `.bp.json` v1 → v2 automatically.

**TOML rendering for gemini/qwen** → The existing `GeminiAdapter` already handles TOML. New `qwen` adapter follows same pattern. Risk: Gemini's TOML schema may evolve. Mitigation: Adapter is isolated; update one file.

**codex global path writes outside project root** → `bp init codex` writes to `$CODEX_HOME/prompts/` which may require user permissions or be unexpected. Mitigation: Log the resolved path before writing; require `--confirm-global` flag when `codex` is in the tools list.

**`bp convert` matrix combinatorial complexity (28×28 = 784 pairs)** → Most pairs share the same IR round-trip path; only 3 special cases (skill-only target, TOML target, global-path target) need extra handling. Mitigation: Encode special cases in registry flags (`isSkillOnly`, `usesToml`, `isGlobal`); convert pipeline checks flags, not backend IDs.

## Migration Plan

1. Deploy `src/backends/registry.ts` with all 28 backends (no breaking changes — additive)
2. Update `src/cli/commands/init.ts` to import `SUPPORTED_BACKENDS` from registry (replaces hardcoded array)
3. Add 18 new adapter files; register in `src/translator/index.ts`
4. Update `src/config/project.ts` Zod schema with v2 fields + v1 transform
5. Add `--tools` flag to `bp init`; keep positional `bp init <backend>` working
6. Update `bp convert`, `bp doctor` with new flags
7. Add validator rules and drift multi-backend support
8. Ship `docs/supported-tools.md`

Rollback: Any step is independently revertable. The registry is additive. CLI flag additions are backwards-compatible. Schema transform is read-only until `bp migrate config` is run.

## Open Questions

- **codex `--confirm-global` UX**: Should this be a flag, an interactive prompt, or just a logged warning? Likely interactive prompt in TTY, flag in CI.
- **`bp init --tools all` default exclusions**: Should skill-only backends (kimi, trae, forgecode) be included when `--tools all` is specified, or excluded by default given they produce no commands?
- **Snapshot test format**: Should IR round-trip snapshots use Jest inline snapshots or separate `.snap` files? Separate files preferred for 28-backend volume.
