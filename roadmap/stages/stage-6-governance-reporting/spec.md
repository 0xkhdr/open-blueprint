# Stage 6 — Governance Reporting & Feedback Loop

Closes **GAP-6** (`roadmap/00-analysis.md`): governance claims (pack "coverage",
compliance posture) are static metadata with no measured reality. This stage makes bp
*prove* its value: per-rule compliance reports, machine-readable CI outputs mapped to
rules, and drift detection for installed governance content.

**Depends on Stages 1–2** (enforcement outcomes + pack lockfile). Stages 3/5 enrich it
(skills inventory, trust/outdated data) — degrade gracefully when absent.

## Goals

1. `bp report` command: human and machine-readable governance posture for the repo.
2. SARIF output where each enforcement violation is a result tied to a stable ruleId,
   so GitHub code scanning annotates PRs per rule (CI workflow already uploads SARIF —
   see `.github/workflows`; extend, don't duplicate).
3. Compliance view per framework: for each installed pack, measured
   pass / fail / manual counts replacing the static `coverage` claim.
4. Drift completion: pack content drift, manual-rule staleness, trust posture.

## Non-goals

- Dashboards, servers, history storage beyond a local JSON snapshot. Telemetry export
  changes (existing OTel stays as-is).

## Design

### 1. Report model (`src/report/model.ts`, new; Zod-schema'd)

```ts
GovernanceReport = {
  schema: "bp-report/1",
  generated_at: string, project: { name, root, backend },
  summary: { rules_total, rules_enforced, rules_manual,
             violations_hard, violations_soft, skills_total?, packs_installed },
  rules: Array<{ id, file, severity, enforcement: "auto"|"manual",
                 status: "pass"|"fail"|"manual"|"invalid",
                 pack?: { id, version }, detail?, evidence? }>,
  packs: Array<{ id, version, framework, source?, trust?,
                 measured: { pass, fail, manual },   // replaces static coverage
                 outdated?: boolean, integrity: "ok"|"modified"|"missing" }>,
  skills?: Array<{ name, risk?, source, valid: boolean }>,
}
```

Built by `src/report/build.ts` from: `validateEnforcement` outcomes (Stage 1 — refactor
it to also return structured outcomes, not only `ValidationError[]`; keep the error path
unchanged), pack lockfile + integrity check (Stage 2/5), skills validator inventory
(Stage 3, optional).

### 2. CLI (`src/cli/commands/report.ts`, new)

- `bp report` — terminal summary (cliui table per pack/framework; red hard-fails,
  yellow soft, dim manual) + top violations with file:line.
- `--json [file]` — full GovernanceReport.
- `--sarif [file]` — SARIF 2.1.0: one `rule` per bp rule id (helpUri → rationale text,
  properties: severity, pack, framework), one `result` per violation with physical
  location of the *violating evidence* when available, else the rule file. Reuse/extend
  any existing SARIF serialization (commit `1029fc6` added SARIF output — locate it,
  likely under verify/CI code, and share one serializer module `src/report/sarif.ts`).
- `--fail-on hard|soft|none` (default `hard`) so `bp report` works as a CI gate.
- `--framework gdpr` filter.

### 3. Compliance honesty

- Deprecate `metadata.coverage` display: `pack:info` and `bp report` show measured
  pass/fail/manual instead; if static coverage present, label it "declared (unverified)".
- `bp report` flags `trust: "unsigned-accepted"` packs (Stage 5) in the summary.

### 4. Drift completion (`src/validator/drift.ts` + pack-integrity)

- `PACK_DRIFTED`: installed content hash ≠ lockfile hash (modified in place).
- `PACK_OUTDATED` (Stage 5 index data, when configured).
- `RULE_MANUAL_STALE`: manual rule untouched while its scope-matched files changed
  significantly since last `bp report` snapshot — compare against
  `.bp/report-snapshot.json` (written by `bp report --snapshot`; check is info-level
  and skipped when no snapshot exists).

### 5. CI integration

- Extend the existing GitHub Actions workflow/recipes (`docs/recipes.md`,
  `docs/ci-integration.md`): `bp report --sarif report.sarif --fail-on hard` +
  `codeql-action/upload-sarif` step; PRs get per-rule annotations.
- Exit codes documented in `docs/troubleshooting.md` table.

### 6. Docs

New `docs/governance-reporting.md`: report anatomy, SARIF mapping table, snapshot/
staleness semantics, "measured vs declared coverage" rationale. Update README pitch to
reference measurable governance; update `docs/observability.md` cross-links.

## Acceptance criteria

1. Fixture repo with 1 passing, 1 hard-failing, 1 manual rule (one from an installed
   pack): `bp report` table shows correct statuses; `--json` validates against
   `bp-report/1` schema; exit non-zero with default `--fail-on hard`.
2. `--sarif` output passes SARIF 2.1.0 schema validation (add the JSON schema as a test
   fixture) and contains per-rule `rules[]` + located `results[]`.
3. Editing an installed pack rule file in place ⇒ report `integrity: "modified"` +
   `PACK_DRIFTED` in verify.
4. Report works without Stage 3/5 features present (fields absent, no crash).
5. `npm run ci` green.

## Test plan

- Unit: report builder from synthetic outcomes; SARIF serializer (schema-validated);
  fail-on threshold logic; snapshot staleness comparator.
- Integration: full fixture lifecycle — install pack, break a check, run report (text/
  json/sarif), assert exit codes; graceful-degradation matrix (no packs, no skills,
  no snapshot).
