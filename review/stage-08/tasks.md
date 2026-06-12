# Tasks — Stage 8: AI Agent Skills Ecosystem

## 1. Foundation

- [ ] **T1.1** Create `.bp/skills/` scaffold + skill template (`assets/skill-template.md`).
- [ ] **T1.2** Write `scripts/validate-skills.ts` (frontmatter, ≤200-token description,
      registry consistency); wire into CI.

## 2. Skills (one task each — 8 required sections per SKILL.md)

- [ ] **T2.1** `bp-architecture` — module map, layer rules, engine interactions.
- [ ] **T2.2** `bp-validator` — six-level pipeline, level registration, ValidationContext.
- [ ] **T2.3** `bp-adapter` — BackendAdapter contract, registry entry, round-trip testing.
- [ ] **T2.4** `bp-plugin-dev` — definePlugin, ValidationContext, worker isolation, API version.
- [ ] **T2.5** `bp-error-handling` — BpError hierarchy, exit codes, troubleshooting anchors,
      SARIF.
- [ ] **T2.6** `bp-security` — static-analysis-only rule, path containment, signing, redaction.
- [ ] **T2.7** `bp-testing` — mocking policy, contract/property tests, e2e-against-dist,
      fixtures.
- [ ] **T2.8** `bp-cli-command` — descriptor manifest, lazy command pattern, process.exit rule,
      docs/commands.md sync.
- [ ] **T2.9** `bp-config-schema` — Zod schemas, config versioning/migration, no-sync-fs.
- [ ] **T2.10** `bp-release` — semver, stable contracts, changelog, breaking-change detection.

## 3. Registry & integration

- [ ] **T3.1** Generate `.bp/skills/registry.json`; validate against directory.
- [ ] **T3.2** Cross-link skills (related-skills section per SKILL.md).
- [ ] **T3.3** Reference skills index from `AGENTS.md` (full revamp lands Stage 9).

## 4. Wrap-up

- [ ] **T4.1** `npm run ci` green (incl. skill validation).
- [ ] **T4.2** Write `review/stage-08/gaps.md` (coverage of speculative modules, skill
      composition, context-window cost of bodies).
