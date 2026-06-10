# Stage 3 Tasks — Skill Authoring & Skill Packs

Prereqs: Stages 1–2 merged. Keep `npm run ci` green per group.

## 1. IR & tool vocabulary

- [ ] 1.1 Extend `SkillSchema` in `src/translator/ir.ts`: optional `risk` enum, optional `id` (default slugified name). Existing tests pass.
- [ ] 1.2 Create `src/translator/tools.ts`: canonical tool vocabulary + per-backend alias maps; unit tests for resolution both directions.
- [ ] 1.3 Add optional `tools: string[]` to `BackendManifest` (`src/templater/selector.ts`); populate `templates/{claude,cursor,opendev,generic}/manifest.json`.

## 2. Skill validation layer

- [ ] 2.1 Create `src/validator/skills.ts` `validateSkills` with checks table from spec §2 (schema, collision, unknown tool, no-procedure, vague trigger, stale path).
- [ ] 2.2 Wire into semantic level in `src/validator/index.ts` (on by default in `bp verify`).
- [ ] 2.3 Unit tests per error type + integration fixture under `tests/fixtures/skills/`.

## 3. `bp skill` CLI

- [ ] 3.1 Create `src/cli/commands/skill.ts`; register in `src/cli/index.ts`.
- [ ] 3.2 `skill new <name>` scaffolder (flags: --description, --tools, --risk, --backend); collision refusal; output passes lint by construction.
- [ ] 3.3 `skill lint [glob]` (+`--json`), `skill list` (provenance-aware table).
- [ ] 3.4 `skill test <file>` — capability check + translator round-trip with fidelity warnings (`--backend`).
- [ ] 3.5 CLI tests incl. exit codes.

## 4. Skill packs

- [ ] 4.1 Refactor Stage 2 pack internals into shared `src/packs/` module (store, lockfile, materializer) without breaking `bp rule pack:*`.
- [ ] 4.2 Widen pack schema: `kind: rules|skills`, `skills` array with procedure body, superRefine kind/field consistency.
- [ ] 4.3 Skill materializer: `pack-<packId>-<skillId>.md` into skills dir, provenance frontmatter, generated-block markers, idempotent, remove with hash guard.
- [ ] 4.4 `bp skill pack:create|lint|install|remove|list` subcommands; tests for lifecycle + idempotency.

## 5. Translation fidelity

- [ ] 5.1 Round-trip adapter tests (claude, cursor, generic) for one fixture skill: parse→IR→render preserves all SkillSchema fields.
- [ ] 5.2 Ensure adapters emit explicit fidelity warnings for unsupported skill features (add warning channel to `render` if absent); test silent-drop is impossible.

## 6. Docs & wrap-up

- [ ] 6.1 Write `docs/skill-authoring.md` (format, validation table, tool matrix, pack flow); link from README.
- [ ] 6.2 Update `docs/commands.md`, `docs/concepts.md` layer 4, `docs/glossary.md`.
- [ ] 6.3 Confirm acceptance criteria 1–5; `npm run ci` green.
