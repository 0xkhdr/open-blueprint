# Documentation Style Guide

This guide defines authoring standards for all files in `docs/`. Follow these rules when adding or editing documentation. Objective rules are enforced by CI via markdownlint.

---

## Headings

- Use a single H1 (`#`) per file as the document title.
- Increment heading levels by one — never skip from H2 to H4.
- Heading text uses title case for H1 and sentence case for H2+.
- Do not use inline code (`` ` ``) inside heading text.

**Valid:**

```markdown
# Backend Adapter Guide

## Writing an adapter

### Required methods
```

**Invalid:**

```markdown
# Backend Adapter Guide

#### Required methods
```

---

## Code Examples

- Every fenced code block MUST declare a language tag.
- Use `bash` for shell commands, `typescript` for TS, `yaml` for config, `json` for JSON.
- CLI examples use the `bp` binary directly (not `npx @agentic/bp` unless showing first-install).
- YAML examples must be valid YAML — test with a parser before committing.
- Keep examples minimal: show exactly what the surrounding prose explains, nothing more.

**Valid:**

````markdown
```bash
bp verify --level semantic
```
````

**Invalid:**

<!-- markdownlint-disable MD040 -->
````markdown
```

bp verify --level semantic

```
````
<!-- markdownlint-enable MD040 -->

---

## Cross-Links

- Link to other docs using relative paths: `[Getting Started](getting-started.md)`.
- Always link to the semantic filename, never the old numeric prefix form (`01-getting-started.md`).
- Anchor links use the heading text lowercased with spaces replaced by hyphens: `#error-handling`.
- External URLs must use HTTPS. Do not embed bare URLs — always wrap in link syntax: `[text](https://example.com)`.
- Every cross-link is checked by the `docs-health` CI job; broken links block merge.

---

## Tone

- Address the reader as "you" (second person). Never "the user" or "one".
- Instructional steps use imperative voice: "Run `bp verify`", not "You should run" or "We recommend running".
- Avoid filler: "simply", "just", "basically", "actually", "easy".
- Prefer active voice: "bp writes the fingerprint" not "the fingerprint is written by bp".
- Keep paragraphs short — three sentences maximum before a break or list.
- Do not embed internal project-tracking language (phase names, sprint estimates, engineer-days) in user-facing docs.

---

## File Organization

- One topic per file. If a file exceeds ~300 lines, consider splitting by sub-topic.
- File names: kebab-case, no numeric prefixes, no spaces. Example: `backend-adapter.md`.
- Place files in `docs/` unless they are ADRs (`docs/adr/`) or API references (`docs/api/`).

---

## See Also

- [Contributing](contributing.md) — development setup and PR workflow
- [CLI Reference](commands.md) — all bp commands with options
