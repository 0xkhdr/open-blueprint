# Tasks — Stage 9: Documentation Revamp — Production Edition

## 1. Migration plan

- [ ] **T1.1** Full mapping table old-path → new-path for all 31 docs + ADRs + `docs/api/`;
      include homes for extras (recipes, workflows, errors, json-output, glossary).
- [ ] **T1.2** Grep source for all doc-path/anchor references (`troubleshooting.md#code-N`,
      `docs/commands.md`); write anchor-stability plan.

## 2. Restructure

- [ ] **T2.1** Create numbered tree; move/merge content per mapping.
- [ ] **T2.2** Split troubleshooting into canonical exit-code registry + getting-started
      troubleshooting; update or stub source-referenced anchors atomically.
- [ ] **T2.3** Add frontmatter to every file.
- [ ] **T2.4** Rewrite `docs/README.md` landing page with decision tree.
- [ ] **T2.5** Update stale content found in Stage 1 doc-drift audit.
- [ ] **T2.6** Write `docs/50-operations/04-security.md` (from Stage 5 output).

## 3. Consistency

- [ ] **T3.1** CLI reference vs `--help` checker using command-descriptor manifest; CI step.
- [ ] **T3.2** Cross-reference link pass; troubleshooting matrix per exit code.

## 4. AGENTS.md

- [ ] **T4.1** Full revamp (architecture map, change protocol, skill index, pitfalls,
      verification checklist).
- [ ] **T4.2** Regenerate condensed `CLAUDE.md` / `GEMINI.md`; fix `docs/commands.md` path
      references.

## 5. API reference

- [ ] **T5.1** JSDoc sweep on public functions (`@param`/`@returns`/`@throws`/`@example`).
- [ ] **T5.2** Add TypeDoc (devDependency), generate `40-extending/04-api-reference/`; npm
      script + CI.

## 6. Docs CI

- [ ] **T6.1** `scripts/validate-docs.ts` (links, frontmatter, code-block tags); wire into CI.

## 7. Wrap-up

- [ ] **T7.1** `npm run ci` green; write `review/stage-09/gaps.md` (orphan docs, structure
      intuitiveness, ADR coverage of Stages 2–9 decisions).
