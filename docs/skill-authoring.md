# Skill Authoring

Stage 3 (GAP-3) makes skills — governance layer 4 — a first-class, client-authored
artifact. Skills are written once in a canonical, backend-neutral format, validated by the
same engine `bp verify` runs, translated to any backend through the IR, and shared as
skill packs through the Stage 2 pack machinery.

---

## The Canonical Skill Format

A skill is a markdown file with YAML frontmatter carrying the `SkillSchema` fields; the
body is the procedure the agent follows.

```markdown
---
name: add-integration-test          # slug, unique per project
description: Add an integration test for an HTTP endpoint
when_to_use: When a new endpoint lacks integration coverage
tools_required: [read_file, write_file, run_tests]
disable_model_invocation: false
risk: low                           # optional: low | medium | high
id: add-integration-test            # optional; defaults to the slugified name
---

## Procedure

1. Locate the route handler for the endpoint.
2. Write a request/response test next to the existing integration tests.
3. Run the test suite and confirm the new test passes.

<!-- bp:preserve -->
Team-specific notes survive regeneration.
<!-- /bp:preserve -->
```

Notes:

* `name` must be slug-safe (`[a-z0-9_-]`, max 64). The optional `id` overrides the file
  identity used for collisions and pack materialization.
* `risk` maps to the `templates/_base` risk tiers.
* Provenance keys may also appear: `bp_source: scaffolded` (from `bp skill new`) or
  `pack_id` / `pack_version` (from `bp skill pack:install`). `bp skill list` reports the
  source as `scaffolded`, `pack:<id>`, or `manual`.

---

## Lifecycle

```bash
bp skill new deploy-check --tools read_file,run_command --risk low
bp skill lint                          # validate all skills (or pass a glob)
bp skill list                          # name, risk, tools, provenance
bp skill test .claude/skills/deploy-check.md --backend cursor
bp verify                              # skill checks run at the semantic level
```

`bp skill new` scaffolds directly into the active backend's skills directory (resolved
from `.bp.json` / user config, or `--backend`), refuses name collisions, and produces a
file that passes `bp skill lint` by construction.

`bp skill test` is a static dry-run: it prints the canonical → backend tool resolution,
runs the validation table below against the target backend, and round-trips the skill
through the translator (render → parse) to prove no field is lost. Any fidelity loss is
reported explicitly — silent drops are impossible (fail-loud pillar).

---

## Validation

Skill validation runs inside the `semantic` level of `bp verify` (on by default) and
backs `bp skill lint`. Checks:

| Check | Type | Severity |
| :--- | :--- | :--- |
| Frontmatter parses and satisfies `SkillSchema` (slug name, required fields) | `SKILL_SCHEMA_INVALID` | error |
| Duplicate skill name/id across files | `SKILL_NAME_COLLISION` | error |
| `tools_required` entry outside the vocabulary or the backend capability list | `SKILL_UNKNOWN_TOOL` | error if the backend declares `tools`, info otherwise |
| Body lacks a `## Procedure` (or any) section with ≥1 numbered step | `SKILL_NO_PROCEDURE` | error |
| `when_to_use` empty or repeating `description` verbatim | `SKILL_VAGUE_TRIGGER` | warning |
| Procedure references a backticked `path/with/slash` that doesn't exist | `SKILL_STALE_PATH` | warning |

`SKILL_*` errors exit with code 5 (`SEMANTIC_FAILURE`).

---

## Canonical Tool Vocabulary

Skills declare tools in a backend-neutral vocabulary (`src/translator/tools.ts`). Each
backend manifest lists which canonical tools it supports (`tools` in
`templates/<backend>/manifest.json`); the validator and the translator share the same
alias maps, so capability checks and rendered output can never disagree.
`mcp:<tool>` references pass through untranslated.

| Canonical | claude | cursor | opendev | generic |
| :--- | :--- | :--- | :--- | :--- |
| `read_file` | `read` | `read_file` | `file_read` | `read_file` |
| `write_file` | `write` | `edit_file` | `file_write` | `write_file` |
| `edit_file` | `edit` | `edit_file` | `file_write` | `edit_file` |
| `run_command` | `bash` | `run_terminal_cmd` | `terminal` | `run_command` |
| `run_tests` | `bash` | `run_terminal_cmd` | `terminal` | `run_tests` |
| `search` | `grep` | `codebase_search` | `search` | `search` |
| `web_fetch` | `web_fetch` | — | — | `web_fetch` |

A `—` means the backend has no native equivalent: translation falls back to the
canonical name and `bp skill test` reports the gap.

---

## Skill Packs

Skill packs reuse the Stage 2 pack format (`bp-pack/1`) with `kind: skills`: full skill
entries (procedure body included) instead of rules. Store resolution, the lockfile
(`.bp/packs.lock.json`), idempotent materialization, hash-guarded removal, and the
drift-level integrity check are all shared with rule packs.

```bash
bp skill pack:create my-skills         # scaffold .bp/packs/my-skills.bp-pack.yaml
bp skill pack:lint .bp/packs/my-skills.bp-pack.yaml
bp skill pack:install my-skills        # materializes pack-<packId>-<skillId>.md
bp skill pack:list
bp skill pack:remove my-skills
```

Materialized files land in the backend's skills directory with provenance frontmatter
and bp-generated block markers, and flow through the validation table above on every
`bp verify` — installed pack skills sit under the same governance umbrella as
hand-written ones.

```yaml
schema: bp-pack/1
id: my-skills
name: My Skills
version: 0.1.0
kind: skills
framework: custom
description: What this pack teaches the agent
author: your-team@example.com
tags: []
skills:
  - name: deploy-check
    description: Verify a deployment is healthy
    when_to_use: After every production deploy
    tools_required: [read_file, run_command]
    risk: low
    procedure: |
      ## Procedure
      1. Check the health endpoint.
      2. Tail the error logs.
```

A pack must match its kind: `kind: rules` requires `rules` (and no `skills`),
`kind: skills` requires `skills` (and no `rules`). `bp rule pack:install` and
`bp skill pack:install` each refuse the other kind with a pointer to the right command.

---

## Translation

Skills round-trip through the backend adapters (`parse → IR → render`) preserving every
`SkillSchema` field for at least claude, cursor, and generic. `bp skill test
--backend <b>` proves the round-trip for your file; unsupported backend features
surface as explicit fidelity warnings, never silent drops.

## See Also

* [Rule Packs](rule-packs.md) — the shared pack format and lifecycle
* [CLI Reference](commands.md) — `bp skill` options
* [Concepts](concepts.md) — the 5 governance layers
