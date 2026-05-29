# Diagnostics & Troubleshooting

Common issues, diagnostic procedures, and the complete `bp` exit code registry. All exit codes 0–10 are stable public API since v1.0.0.

---

## Exit Code Registry

### Code 0 — Success {#code-0}

**Name**: `SUCCESS`
**Description**: Command completed successfully with no errors.
**Example trigger**: `bp verify` with all checks passing.
**Resolution**: None required.

---

### Code 1 — Unexpected Error {#code-1}

**Name**: `UNEXPECTED_ERROR`
**Description**: An unhandled exception or unexpected runtime error occurred.
**Example trigger**: Disk I/O failure, corrupted template file, Node.js API error.
**Resolution**: Check stderr for stack trace. Run with `BP_LOG_LEVEL=debug` for full diagnostics. Report at <https://github.com/0xkhdr/open-blueprint/issues> if reproducible.

---

### Code 2 — Invalid CLI Arguments {#code-2}

**Name**: `INVALID_ARGS`
**Description**: Required arguments missing or mutually exclusive flags provided.
**Example trigger**: `bp convert` without `--from` or `--to` flags.
**Resolution**: Run `bp <command> --help` to see required options.

---

### Code 3 — Config Error {#code-3}

**Name**: `CONFIG_ERROR`
**Description**: Configuration file failed schema validation or could not be parsed.
**Example trigger**: `.bp.json` contains invalid JSON or unknown fields.
**Resolution**: Validate your `.bp.json` against the schema in [configuration.md](configuration.md). Run `bp health` to check config parse status.

---

### Code 4 — Structural Validation Failure {#code-4}

**Name**: `STRUCTURAL_VALIDATION_FAILED`
**Description**: Blueprint file structure is invalid: missing required sections, malformed front-matter, or missing required files.
**Example trigger**: `CLAUDE.md` missing `## Rules` section.
**Resolution**: Run `bp verify --level structural --fix` to attempt auto-correction, or consult [concepts.md](concepts.md) for required file structure.

---

### Code 5 — Semantic Validation Failure {#code-5}

**Name**: `SEMANTIC_VALIDATION_FAILED`
**Description**: Blueprint rules or constraints are logically inconsistent.
**Example trigger**: Two personas with conflicting `allowed_tools` for the same scope.
**Resolution**: Review semantic errors in output. Run `bp doctor` for guided diagnostics.

---

### Code 6 — Drift Detected {#code-6}

**Name**: `DRIFT_DETECTED`
**Description**: Blueprint files have been modified outside of `bp` — hash mismatch with `.bp-lock` snapshot.
**Example trigger**: Manual edit to `CLAUDE.md` after `bp init`.
**Resolution**: Run `bp sync --auto-apply` to resync, or `bp verify --level drift` to inspect what changed.

---

### Code 7 — Translation Error {#code-7}

**Name**: `TRANSLATION_ERROR`
**Description**: Adapter failed to parse source format or render target format.
**Example trigger**: `bp convert --from claude --to cursor` where source directory is missing expected files.
**Resolution**: Verify source directory contains valid blueprint files. Run `bp verify` on source before conversion.

---

### Code 8 — Network Error {#code-8}

**Name**: `NETWORK_ERROR`
**Description**: Registry or marketplace fetch failed after retry attempts.
**Example trigger**: `bp template install <pack>` when registry is unreachable.
**Resolution**: Check network connectivity. Retry with `BP_LOG_LEVEL=debug` to see HTTP response details. Use `--offline` flag if available for local-only operation.

---

### Code 9 — Permission Denied {#code-9}

**Name**: `PERMISSION_ERROR`
**Description**: Path traversal attempt blocked, non-HTTPS URL rejected, or write to disallowed directory.
**Example trigger**: `bp init --output ../../etc/passwd` (path traversal).
**Resolution**: Use paths within the current project directory. Ensure registry URLs use `https://`.

---

### Code 10 — Health Check Failure {#code-10}

**Name**: `HEALTH_ERROR`
**Description**: One or more `bp health` checks failed.
**Example trigger**: `bp health` when config file is unparseable or template registry is unreachable.
**Resolution**: Run `bp health --json` for machine-readable check details. Address each failing check individually.

---

## Running the Doctor Diagnostic

If your coding agent is ignoring rules or skipping local boundaries, run the diagnostic subcommand to scan environment configurations:

```bash
bp doctor --tool claude --verbose
```

Example output:

```text
bp:  Running diagnostics...
     ✓ CLAUDE.md found at repo root
     ✓ .claude/ directory readable
     ✓ Backend "claude" supported
     ⚠ Hook script .claude/hooks/pre_tool_use.js contains fetch() call
     ⚠ Rule 03-style.md has zero-match scope: "src/styles/**/*.css"

     Recommendations:
     1. Remove fetch() from hook or whitelist in .bp.json
     2. Update scope to "src/styles/**/*.ts" or delete rule if migrated
```

---

## Common Issues

### "Cost estimates seem high or low"

**Cause**: Cost factors based on project complexity (languages, APIs, auth).
**Fix**: Adjust `cost_per_token_usd` based on real usage:

```bash
bp doctor --cost --actual-usage
```

### "No anomalies detected but I see cost spikes"

**Cause**: Not enough baseline samples (minimum 10 recommended).
**Fix**: Increase `min_baseline_samples` and collect 1–2 weeks of data.

### "Slack webhook returns 403"

**Cause**: Invalid webhook URL or expired token.
**Fix**: Regenerate webhook in Slack app, then test:

```bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"blocks":[{"type":"section","text":{"type":"plain_text","text":"Test"}}]}' \
  YOUR_WEBHOOK_URL
```

---

## See Also

- [Observability & Cost Governance](observability.md) — telemetry, budgets, alerting
- [CLI Reference](commands.md) — all `bp` commands with options
- [Agent Reference](../agents.md) — error handling and recovery patterns
