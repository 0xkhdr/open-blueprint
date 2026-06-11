# Governance Reporting

`bp report` turns governance claims into measurements. Instead of trusting a pack's
static `coverage` metadata, the report evaluates every rule against the repository and
publishes what actually passed, failed, or needs a human — per rule, per pack, per
compliance framework.

```bash
bp report                          # terminal summary
bp report --json report.json       # full bp-report/1 document
bp report --sarif report.sarif     # SARIF 2.1.0 for GitHub code scanning
bp report --fail-on hard           # CI gate (default)
bp report --framework gdpr        # one framework only
bp report --snapshot               # record the manual-rule staleness baseline
```

---

## Report Anatomy (`bp-report/1`)

The `--json` output is a single document validated by the `bp-report/1` Zod schema
(`src/report/model.ts`):

| Section | Contents |
|---|---|
| `project` | `name`, `root`, `backend` |
| `summary` | `rules_total`, `rules_enforced`, `rules_manual`, `violations_hard`, `violations_soft`, `skills_total?`, `packs_installed`, `packs_unsigned?` |
| `rules[]` | Per rule: `id`, `file`, `severity` (`hard`/`soft`), `enforcement` (`auto`/`manual`), `status` (`pass`/`fail`/`manual`/`invalid`), `pack?`, `detail?`, `evidence?`, `stale?` |
| `packs[]` | Per installed pack: `id`, `version`, `framework?`, `source`, `trust?`, `measured` (`pass`/`fail`/`manual` counts), `declared_coverage?`, `outdated?`, `integrity` (`ok`/`modified`/`missing`) |
| `skills[]?` | Per skill: `name`, `risk?`, `source`, `valid` |

Rule statuses:

- **pass / fail** — the rule's declarative `check` was evaluated (Stage 1 enforcement).
- **manual** — no check, or the check is unsupported in this ecosystem. Manual rules
  never affect the exit code, but they are counted honestly — never as passing.
- **invalid** — the check exists but is malformed. Treated as a *hard* violation: the
  rule claims enforcement it cannot deliver.

Optional sections degrade gracefully: no installed packs ⇒ `packs: []`; a backend
without skills ⇒ no `skills` field; no snapshot ⇒ no staleness flags. The report never
crashes because a stage's data is absent.

## Measured vs Declared Coverage

A pack may declare `metadata.coverage: 80` — that is an authoring-time claim bp cannot
verify. Stage 6 stops presenting it as fact:

- `bp report` and `bp rule pack:info` show **measured** pass/fail/manual counts
  computed from real enforcement outcomes.
- When static coverage is present it is labeled **"declared (unverified)"** and shown
  beside the measurement, never instead of it.

## SARIF Mapping

`bp report --sarif` emits SARIF 2.1.0 (shared serializer: `src/report/sarif.ts`, also
used by `bp verify --format sarif`). GitHub code scanning then annotates PRs per rule.

| bp concept | SARIF |
|---|---|
| Rule id | `runs[0].tool.driver.rules[].id` (one entry per rule, including passing/manual) |
| Rule severity / enforcement / pack / framework | `rules[].properties` |
| Rule detail | `rules[].fullDescription.text` |
| Hard violation, invalid check | `results[]` with `level: error` |
| Soft violation | `results[]` with `level: warning` |
| Violation location | `results[].locations` — the violating evidence (`file:line`) when the check produced any, else the rule file itself |

Passing and manual rules appear in `rules[]` only, so scanners know the full rule
universe without noise results.

## Pack Integrity & Drift

Every installed pack is checked against `.bp/packs.lock.json`:

- `integrity: "modified"` — a generated rule file was edited outside
  `<!-- bp:preserve -->` blocks (per-file finding: `PACK_FILE_MODIFIED`).
- `integrity: "missing"` — a generated file was deleted (`PACK_FILE_MISSING`).
- Either case also raises one aggregate **`PACK_DRIFTED`** warning per pack in
  `bp verify` (drift level), so `bp verify --fail-on drift` gates on it.
- `outdated: true` — a configured signed registry index advertises a newer version
  (`PACK_OUTDATED`, info; skipped silently when offline/unconfigured).
- `trust: "unsigned-accepted"` packs are counted in `summary.packs_unsigned` and
  flagged in the terminal summary.

## Snapshot & Manual-Rule Staleness

Automated checks re-measure every run; manual rules can silently rot. The snapshot
gives them a baseline:

1. `bp report --snapshot` writes `.bp/report-snapshot.json`: for each manual rule, a
   normalized hash of the rule text plus content hashes of its scope-matched files
   (capped at 500 files per rule).
2. Later `bp report` runs compare the repo against that baseline. A manual rule is
   flagged `stale: true` (info-level, never affects exit codes) when **both**:
   - the rule text is unchanged (whitespace/case-insensitive), and
   - ≥ 25 % of its scoped files were added, removed, or modified.
3. Updating the rule file (or taking a fresh `--snapshot`) clears the flag.

No snapshot file ⇒ the check is skipped entirely. A corrupt snapshot is ignored, not
fatal.

## Exit Codes

| Condition | `--fail-on hard` (default) | `--fail-on soft` | `--fail-on none` |
|---|---|---|---|
| No violations | 0 | 0 | 0 |
| Soft violations only | 0 | 4 | 0 |
| Hard violation or invalid check | 4 | 4 | 0 |
| Report could not be generated | 1 | 1 | 1 |

See the [exit code registry](troubleshooting.md#exit-code-registry).

## CI Recipe

```yaml
report:
  runs-on: ubuntu-latest
  permissions:
    security-events: write
    contents: read
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with: { node-version: "22.x", cache: npm }
    - run: npm ci && npm run build
    - name: Governance report (gates on hard violations)
      run: node dist/cli/index.js report --sarif report.sarif --fail-on hard
    - name: Upload SARIF
      if: always()
      uses: github/codeql-action/upload-sarif@v3
      with:
        sarif_file: report.sarif
        category: bp-report
```

## See Also

- [Commands Reference](commands.md#bp-report)
- [CI Integration](ci-integration.md)
- [Rule Packs](rule-packs.md) · [Pack Distribution](pack-distribution.md)
- [Observability](observability.md) — runtime telemetry; the report is the static
  governance complement
