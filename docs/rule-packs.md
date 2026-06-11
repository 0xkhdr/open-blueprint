# Rule Packs

> Author, validate, install, and remove portable rule collections — under the same `bp` validation umbrella as built-in content.

A **rule pack** is a single YAML or JSON file bundling related governance rules (compliance baselines, house security policies, team conventions). Packs install as ordinary backend rule files (e.g. `.claude/rules/*.md`), so `bp verify` — including enforcement of executable `check` conditions — governs them identically to scaffolded rules.

`bp` ships built-in compliance packs (`gdpr-baseline`, `soc2-type2`, `hipaa-security-rule`, `pcidss-v3-2-1`), and you can author your own.

---

## Format reference

A pack file ends in `.bp-pack.yaml`, `.bp-pack.yml`, or `.bp-pack.json` and conforms to the `bp-pack/1` schema:

```yaml
schema: "bp-pack/1"                # required, exactly this value
id: acme-internal-security        # ^[a-z0-9_-]+$, max 64 chars
name: ACME Internal Security
version: 1.2.0                    # strict semver
kind: rules                       # "rules" today; skill packs arrive later
framework: custom                 # gdpr | soc2 | hipaa | pci-dss | iso-27001 | custom
description: House security constraints for ACME repos
author: platform-team@acme.com
tags: [security, internal]        # max 16
rules:                            # 1–200 rules
  - id: no-raw-sql                # unique within the pack
    scope: "src/**/*.ts"          # glob the rule governs
    severity: hard                # hard = error on violation, soft = warning
    action: "Never build SQL via string concatenation"
    rationale: "SQLi prevention; use the query builder"
    check:                        # optional machine-evaluable condition
      type: content-absent
      glob: "src/**/*.ts"
      pattern: "execute\\(`|query\\(\\s*['\"]SELECT"
metadata:                         # optional
  compliance_standard: ACME-SEC-001
```

Rules use the same schema as BlueprintIR rules, including the optional [`check`](data-models.md#check) condition. Rules without a `check` are honest **manual** controls — `bp verify` reports them as `RULE_MANUAL` info, never as passing.

Validation is strict: every external pack passes through Zod before anything touches your project. Schema violations fail with `PACK_INVALID` listing each issue path; duplicate rule ids fail with `PACK_DUPLICATE_RULE`.

## Authoring walkthrough

```bash
# 1. Scaffold a commented template in .bp/packs/
bp rule pack:create acme-internal-security

# ...or harvest your existing hand-written rules into a pack
bp rule pack:create acme-internal-security --from-rules ".claude/rules/*.md"

# 2. Edit the YAML, then lint it
bp rule pack:lint .bp/packs/acme-internal-security.bp-pack.yaml

# 3. Install it — materializes one rule file per rule
bp rule pack:install acme-internal-security

# 4. Verify — pack rules are enforced like any other rule
bp verify --level enforcement
```

## Pack resolution

`pack:install <ref>` and `pack:info <ref>` resolve a reference in this order:

1. **Path** — the ref contains `/` or ends in a pack extension: load that file.
2. **Project pack** — a file in `.bp/packs/` whose `id` matches.
3. **Built-in** — one of the shipped compliance packs.

A project pack whose `id` collides with a built-in is rejected at install time (`PACK_ID_COLLISION`) unless you pass `--force`.

## Materialization

Installing renders one rule file per pack rule into the active backend's rules directory:

```
.claude/rules/pack-<packId>-<ruleId>.md
```

Each file carries:

- the rule frontmatter (`id`, `scope`, `severity`, `action`, `rationale`, `tags`, `check`, `enforcement`);
- **provenance** keys `pack_id` and `pack_version`;
- `<!-- bp-generated:begin/end -->` block markers, so re-installs are idempotent and your `<!-- bp:preserve -->` regions survive.

## Lockfile

Installs are recorded in `.bp/packs.lock.json` (`bp-pack-lock/1`):

```json
{
  "schema": "bp-pack-lock/1",
  "installed": [
    {
      "id": "acme-internal-security",
      "version": "1.2.0",
      "source": "project",
      "rules_count": 12,
      "installed_at": "2026-06-11T12:00:00.000Z",
      "content_hash": "<sha256 of the pack's canonical JSON>",
      "files": { ".claude/rules/pack-acme-internal-security-no-raw-sql.md": "<sha256>" }
    }
  ]
}
```

Per-file hashes cover the *governed* content only — text inside `bp:preserve` blocks is yours and never counts as tampering. `bp verify` (drift level) cross-checks the lockfile: missing files report `PACK_FILE_MISSING`, hand-edited files report `PACK_FILE_MODIFIED`. Both are drift-class warnings, so they fail the build under `--fail-on drift`.

Commit the lockfile to version control.

## FAQ

**What does re-installing do by default?**
Merge-by-rule-id: existing rule files are kept untouched; only files for new rules are written. A second install is a byte-equal no-op.

**What does `pack:install --force` do?**
Replaces the pack's *own* generated files with freshly rendered content (preserve blocks survive the merge). It never touches rules from other packs or hand-written rule files — those are reported and skipped.

**When does `pack:remove` refuse to run?**
When a generated file was edited outside preserve blocks (hash mismatch). Move your edits into a `<!-- bp:preserve -->` block or a separate hand-written rule, or pass `--force` to delete anyway.

**Can I edit a generated rule file?**
Put additions inside a `<!-- bp:preserve -->` … `<!-- bp:end-preserve -->` block; they survive re-installs and don't trip integrity checks. Any other edit is flagged as `PACK_FILE_MODIFIED`.

**How do I share packs across repos?**
Today: commit the pack file and install from a path or `.bp/packs/`. Remote fetch, publishing, and signature-gated installs are planned (Stage 5).
