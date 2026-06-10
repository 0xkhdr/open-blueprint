# Stage 3 — Client-Created Skills: Authoring, Validation, Skill Packs

Closes **GAP-3** (`roadmap/00-analysis.md`): skills are governance layer 4 with an IR
schema and shipped templates, but there is no `bp skill` command — clients cannot create,
lint, test, or share skills, and skill files get only generic markdown validation.

**Depends on Stage 1** (validator integration patterns) and **Stage 2** (pack format,
store, materialization, lockfile — skills reuse all of it).

> Post-roadmap note: `bp adopt` (`src/cli/commands/adopt.ts`, refactor `2ed02a6`) already
> brings user-authored rules/skills/agents under the ownership manifest with `--status`
> classification. `bp skill` here should reuse that tracking/classification for skills, not
> duplicate it — author/lint/test on top of adopt's ownership model.

## Goals

1. `bp skill` command group: `new`, `lint`, `list`, `test`, plus skill packs via the
   Stage 2 pack machinery (`kind: skills`).
2. A dedicated skill validation layer so client skills "adhere to the validation run by
   open-blueprint": schema, tool-capability, collision, and quality checks integrated
   into `bp verify`.
3. Skills authored once translate to any backend through the existing IR/translator.

## Non-goals

- Executing skills (skills are procedures for the agent, not for bp).
- Remote distribution (Stage 5).

## Design

### 1. Skill file format (canonical, backend-neutral)

Markdown with frontmatter, mirroring shipped templates
(`templates/generic/skills/*.md.hbs`) and `SkillSchema` in `src/translator/ir.ts`:

```markdown
---
name: add-integration-test          # irIdentifier, unique per project
description: Add an integration test for an HTTP endpoint
when_to_use: When a new endpoint lacks integration coverage
tools_required: [read_file, write_file, run_tests]
disable_model_invocation: false
risk: low                           # NEW, optional: low|medium|high — maps to templates/_base risk tiers
---

## Procedure
1. Locate the route handler...
2. ...

<!-- bp:preserve -->
(team-specific notes survive regeneration)
<!-- /bp:preserve -->
```

IR change (`src/translator/ir.ts`): add to `SkillSchema`
`risk: z.enum(["low","medium","high"]).optional()` and
`id: irIdentifier.optional()` (defaults to slugified `name`). Keep backward compat.

### 2. Skill validation layer (`src/validator/skills.ts`, new)

`validateSkills(projectRoot, manifest): Promise<ValidationError[]>`, collected from
`manifest.file_patterns.skills`, run inside the existing `semantic` level (extend
`validateSemantic` call site in `src/validator/index.ts`) so it is on by default:

| Check | Type | Severity |
|---|---|---|
| Frontmatter parses + `SkillSchema` Zod-valid | `SKILL_SCHEMA_INVALID` | error |
| Duplicate skill name/id across files | `SKILL_NAME_COLLISION` | error |
| `tools_required` entries exist in backend capability list (see §3) | `SKILL_UNKNOWN_TOOL` | error if backend declares tools, info otherwise |
| Body has a `## Procedure` (or first) section with ≥1 numbered step | `SKILL_NO_PROCEDURE` | error |
| `when_to_use` non-empty and ≠ description verbatim | `SKILL_VAGUE_TRIGGER` | warning |
| Procedure references a file path that matches nothing in repo | `SKILL_STALE_PATH` | warning (paths extracted via conservative backtick-`path/with/slash` heuristic) |
| `description` > 512 chars or name not slug-safe | from schema | error |

### 3. Backend tool capability registry

Add optional `tools: string[]` (canonical tool vocabulary) to the backend manifest type
(`src/templater/selector.ts` `BackendManifest`) and populate `templates/*/manifest.json`
for at least claude, cursor, opendev, generic. Canonical vocabulary lives in
`src/translator/tools.ts` (new): `read_file, write_file, edit_file, run_command,
run_tests, search, web_fetch, mcp:*` with per-backend alias maps used by both the
validator (§2) and translator adapters (render native tool names).

### 4. CLI (`src/cli/commands/skill.ts`, new; register in `src/cli/index.ts`)

- `bp skill new <name>` — interactive-free scaffold into the active backend's skills dir
  (resolve via `resolveTemplatePack` + manifest like `rule.ts` does). Flags:
  `--description`, `--tools a,b`, `--risk`, `--backend`. Generates valid frontmatter +
  Procedure skeleton + preserve block. Refuses on name collision.
- `bp skill lint [glob]` — run §2 checks on matched files (default: backend skills dir);
  `--json`; exit non-zero on errors.
- `bp skill list` — table: name, risk, tools, source (`scaffolded | pack:<id> | manual`
  from provenance frontmatter), backend file path.
- `bp skill test <file>` — static dry-run: prints resolved tools (canonical → backend
  alias), validates against capability list, checks `SKILL_STALE_PATH` evidence, and
  renders the skill through the translator to the target backend(s) to prove
  round-trip (`--backend cursor` etc.), reporting any fidelity loss the adapter signals.

### 5. Skill packs (reuse Stage 2)

- Widen pack schema: `kind: z.enum(["rules","skills"])`; add
  `skills: z.array(SkillPackEntrySchema)` where entry = SkillSchema fields +
  `procedure` body string. `rules` required iff kind=rules, `skills` iff kind=skills
  (Zod `superRefine`).
- Store/lockfile/materializer from Stage 2 generalized: materialize into
  `manifest.file_patterns.skills` dir as `pack-<packId>-<skillId>.md` with provenance
  frontmatter and generated-block markers. `bp skill pack:create|lint|install|remove|list`
  subcommands delegate to the shared pack module (refactor Stage 2 internals into
  `src/packs/` shared module if cleaner; keep `bp rule pack:*` aliases working).
- Installed pack skills flow through §2 validation in `bp verify` — this is the
  "client skills under the umbrella, adhering to bp validation" requirement.

### 6. Translation

Verify (and fix where missing) that `SkillSchema`-shaped files round-trip through the
adapters listed in `src/translator/adapters/` for at least claude, cursor, generic:
parse → IR → render must preserve name/description/when_to_use/tools_required/procedure.
Add adapter tests using one fixture skill. Unsupported backend features must produce an
explicit fidelity warning (existing adapter warning channel; if none exists, return
warnings from `render`), never silent drops (fail-loud pillar).

### 7. Docs

- New `docs/skill-authoring.md`: format, lifecycle, validation table (§2), pack flow,
  canonical tool vocabulary + alias matrix. Link from README.
- Update `docs/commands.md` (`bp skill *`), `docs/concepts.md` layer-4 section,
  `docs/glossary.md` (Skill, Canonical tool, Skill pack).

## Acceptance criteria

1. `bp skill new deploy-check --tools read_file,run_command` creates a file that
   `bp skill lint` and `bp verify` pass; deleting `when_to_use` ⇒ `SKILL_SCHEMA_INVALID`
   error with line; duplicating the name in a second file ⇒ `SKILL_NAME_COLLISION`.
2. `tools_required: [teleport]` against claude manifest ⇒ `SKILL_UNKNOWN_TOOL` error.
3. A `kind: skills` pack installs via `bp skill pack:install`, materializes files,
   appears in lockfile, validates in `bp verify`, removes cleanly.
4. `bp skill test <file> --backend cursor` shows round-trip output or explicit fidelity
   warnings; never silently drops fields.
5. `npm run ci` green; new command registered + documented.

## Test plan

- Unit: skills validator (each error type), tool alias resolution, scaffold output
  schema-valid by construction, pack schema kind-refinement.
- Integration: `tests/fixtures/skills/` — lifecycle new→lint→verify→pack→install→
  remove; adapter round-trip fixtures for claude/cursor/generic.
