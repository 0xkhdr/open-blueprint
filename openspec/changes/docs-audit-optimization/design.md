## Context

`open-blueprint` currently ships 25+ documentation files across `docs/`, `docs/adr/`, and `docs/api/`. The suite has accumulated three overlapping navigation indices (`README.md`, `docs/README.md`, `docs/00-README.md`), split troubleshooting content across two files, a 455-line observability document that embeds internal phase-tracking language ("Phase 4 | 10 engineer-days"), and no `agents.md` despite advertising multi-backend agent governance as the core value proposition. Numeric filename prefixes (`00-` through `19-`) create a renaming cascade whenever a doc is inserted or reordered. ADR and API sub-directories are not reachable from any navigation index.

## Goals / Non-Goals

**Goals:**
- Single authoritative navigation index (root `README.md` only)
- Semantic filenames in `docs/` — no numeric prefixes, human-readable slugs
- Progressive disclosure structure: quickstart → guides → references → advanced
- Merge redundant troubleshooting and error-code docs into one file
- Add `agents.md` at repo root with full agent lifecycle coverage
- Add `docs/style-guide.md` to enforce consistency going forward
- Add `CHANGELOG.md` at repo root
- Surface ADRs and API docs in the main navigation
- CI documentation health job: markdown lint + link validation

**Non-Goals:**
- No changes to source code, CLI behavior, or API contracts
- No changes to `docs/adr/` content (ADRs are immutable decision records)
- No migration of inline JSDoc or typedoc annotations

## Decisions

### Decision 1: Root README.md as sole navigation entry point

**Chosen:** Expand root `README.md` into the single authoritative index. Delete `docs/README.md` and `docs/00-README.md` after migrating their unique content.

**Alternatives considered:**
- Keep `docs/README.md` as secondary index — adds a second maintenance surface with no benefit.
- Create a new `docs/index.md` — third index, same problem.

**Rationale:** GitHub renders root `README.md` automatically. All external links already point there. One source of truth eliminates drift.

---

### Decision 2: Semantic filenames replacing numeric prefixes

**Chosen:** Rename `docs/01-getting-started.md` → `docs/getting-started.md`, etc. Update all internal cross-links at rename time.

**Alternatives considered:**
- Keep numeric prefixes but renumber consistently — still requires cascade renames when inserting docs.
- Use a `docs/index.md` to impose order without filename changes — docs remain unsorted in filesystem; contributors still guess at order.

**Rationale:** Semantic names are stable identifiers. Insertion of a new doc requires zero renames of existing files. GitHub and external tools link by filename, not alphabetical order.

---

### Decision 3: Merge troubleshooting + exit code docs

**Chosen:** Merge `docs/10-troubleshooting.md` (51 lines) and `docs/18-errors.md` (102 lines) into `docs/troubleshooting.md`. Exit codes remain the single table; symptom-based troubleshooting entries are deduplicated.

**Alternatives considered:**
- Keep both files, add cross-links — reader still must visit two files for a complete picture.

**Rationale:** Both files answer the same reader question ("why did bp fail?"). Split adds cognitive overhead with no informational benefit.

---

### Decision 4: Rewrite observability doc — strip internal tracking metadata

**Chosen:** Rewrite `docs/06-observability.md` to remove "Phase 4 | Implementation complete | 10 engineer-days" header block and all project-management language. Target ~150 lines of pure reference content.

**Rationale:** User-facing docs must not embed internal sprint velocity data. The existing header actively confuses external contributors about the doc's status and audience.

---

### Decision 5: CI health check using markdownlint + lychee

**Chosen:** Add a `docs-health` GitHub Actions job running `markdownlint-cli2` (lint) and `lychee` (link check, `--offline` for internal links, external links checked on schedule only).

**Alternatives considered:**
- `markdown-link-check` — slower, no caching, abandoned upstream.
- `remark-validate-links` — Node-only, heavier setup.

**Rationale:** `lychee` is fast (Rust), supports caching, and separates internal vs external validation. `markdownlint-cli2` is the actively maintained successor to `markdownlint`.

## Risks / Trade-offs

- **Broken external bookmarks after file renames** → Add `docs/redirects.md` noting old → new filenames; add a note in `CHANGELOG.md` v-next section. Cannot enforce HTTP redirects for a static doc suite, but changelog note and search engine recrawl mitigate long-term.
- **Link rot in existing ADRs that reference old doc filenames** → Scan all `docs/adr/*.md` files for internal links as part of the rename step; update in the same commit.
- **CI link check false positives on localhost/relative links** → Configure lychee `exclude` list for local anchors and `localhost` patterns in `.lychee.toml`.
- **Style guide adds friction for contributors** → Keep style guide short (< 2 pages); enforce only objective rules (heading depth, code fence language tags, no raw URLs) via markdownlint rather than subjective prose style.

## Migration Plan

1. Create `docs/style-guide.md` and `CHANGELOG.md` (additive, no risk).
2. Create `agents.md` at repo root (additive).
3. Write merged `docs/troubleshooting.md`; verify no content loss vs originals.
4. Rewrite `docs/observability.md` (semantic rename + content trim).
5. Rename all remaining `docs/NN-*.md` files to semantic slugs.
6. Update all internal cross-links (grep `\d\d-` across `docs/`).
7. Delete `docs/README.md` and `docs/00-README.md` after content verified merged into root `README.md`.
8. Update root `README.md` navigation to reflect new filenames and surface ADRs and API docs.
9. Add `.lychee.toml`, `.markdownlint.yaml`, and `docs-health` CI job.
10. Run full link check locally before merging.

**Rollback:** All changes are file-level; git revert restores any rename or edit atomically.

## Open Questions

- Should `docs/api/` docs be auto-generated from JSDoc at build time, or remain hand-maintained? (Decide before renaming to avoid rework.)
- Does `CHANGELOG.md` follow Keep-a-Changelog format or a custom format? (Recommend Keep-a-Changelog; confirm with maintainer.)
