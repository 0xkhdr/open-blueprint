# Spec — Stage 9: Documentation Revamp — Production Edition

**Status:** Draft — content reflects final (post-Stage-7) architecture
**Date:** 2026-06-12

## 1. Goal

Restructure `docs/` (31 existing files) into the numbered hierarchical tree from PROMPT.md
(00-getting-started … 60-project), with frontmatter, validated links, canonical exit-code
registry, and a definitive `AGENTS.md`.

## 2. Design

### Migration, not rewrite
- Map every existing doc to its new home (e.g., `commands.md` → `20-reference/01-cli-commands.md`,
  `troubleshooting.md` → exit-code matrix split into `20-reference/04-exit-codes.md` +
  `00-getting-started/04-troubleshooting.md`); content updated where stale, preserved where good.
- **Anchor stability is a hard contract:** `{#code-N}` anchors are referenced from source
  (`BpError.resolution`). Plan: new canonical file carries the anchors; old
  `docs/troubleshooting.md` becomes a stub redirect **or** source links are updated atomically in
  the same commit — decision made at implementation with a grep of all source references; no
  window where links 404.
- Existing extra docs not in PROMPT tree (`recipes.md`, `workflows.md`, `errors.md`,
  `json-output.md`, `glossary.md`, `docs/api/`) get explicit homes — nothing dropped silently.

### Quality standards (every file)
- YAML frontmatter: title, category, order, last_updated, version.
- Language-tagged code blocks; cross-reference links; decision trees in getting-started;
  troubleshooting matrix (symptom → cause → resolution → example) per exit code.
- `docs/20-reference/01-cli-commands.md` consistency with `--help` enforced via the Stage 7
  command-descriptor manifest (generator or checker script).

### AGENTS.md revamp
- Architecture map (post-refactor interfaces), build/test/lint reference, change protocol
  (CI + docs sync + contract preservation), skill index (`.bp/skills/`), common pitfalls,
  verification checklist. `CLAUDE.md`/`GEMINI.md` condensed versions regenerated to match.

### Auto-generated API reference
- TypeDoc (devDependency — justification: doc-gen only, no runtime impact; flagged per PROMPT
  rule 6) generates `docs/40-extending/04-api-reference/` from JSDoc; public functions get
  `@param`/`@returns`/`@throws`/`@example` sweep.

### Docs CI
- `scripts/validate-docs.ts`: internal-link check, frontmatter completeness, code-block syntax
  sanity (language tag present; TS/JSON blocks parse). Wired into CI.

## 3. Constraints

- `{#code-N}` anchors never 404 from source at any commit.
- `docs/commands.md` path referenced by CLAUDE.md hard conventions — update those instruction
  files in same PR.

## 4. Exit criteria

- New tree complete; all files meet standards; AGENTS.md comprehensive; docs CI green;
  `npm run ci` green.
