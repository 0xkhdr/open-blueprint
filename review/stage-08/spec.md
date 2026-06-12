# Spec — Stage 8: AI Agent Skills Ecosystem

**Status:** Draft — content depends on Stages 2–7 final architecture
**Date:** 2026-06-12

## 1. Goal

`.bp/skills/` ecosystem (Agent Skills open format, progressive disclosure) so any AI model can
work effectively on this repo: 10 core skills, machine-readable registry, CI-validated.

## 2. Design

### Layout (per skill)
```
.bp/skills/{skill-name}/
├── SKILL.md          # required: YAML frontmatter + instructions
├── scripts/          # optional
├── references/       # optional
└── assets/           # optional
```

### Frontmatter contract
```yaml
---
name: bp-validator
description: <third-person trigger, 2–3 sentences, specific keywords, ≤200 tokens>
version: 1.0.0
author: open-blueprint
tags: [validator, pipeline, quality]
---
```

### Ten core skills
`bp-architecture`, `bp-validator`, `bp-adapter`, `bp-plugin-dev`, `bp-error-handling`,
`bp-security`, `bp-testing`, `bp-cli-command`, `bp-config-schema`, `bp-release` — trigger
descriptions per PROMPT.md table. Each SKILL.md body contains the 8 required sections:
architecture context, stable contracts, hard conventions, common patterns, testing
requirements, documentation sync, exit criteria (+ frontmatter = 8).

### Content rules
- Skills describe the **post-Stage-2..7 architecture** (interfaces, registries, lazy CLI), not
  the pre-refactor one — hence Stage 8 ordering.
- Skills reference docs by path; Stage 9 restructures docs, so links use the **new** doc paths
  (coordinate: write skills against the Stage 9 target tree, verify in Stage 10).
- Progressive disclosure: frontmatter cheap, body loaded on demand; bodies target <1500 words;
  deep material goes to `references/`.
- Skills cross-reference each other (e.g., bp-validator → bp-testing) by name.

### Registry & validation
- `.bp/skills/registry.json`: machine-readable index (name, description, version, tags, path).
- CI check `scripts/validate-skills.ts`: frontmatter completeness, description ≤200 tokens
  (approximation: chars/4 — documented), registry ↔ directory consistency.
- Coverage question for gaps: skills for `dx/`/`ecosystem/`/`enterprise/`/`multiagent/` decided
  by Stage 1 speculative-audit verdicts (dead modules get no skills).

## 3. Constraints

- Skill files honest: no claimed capabilities the codebase lacks.
- `npm run ci` includes skill validation; green.

## 4. Exit criteria

- 10+ skills with valid SKILL.md; registry.json valid; CI validation wired; `npm run ci` green.
