# 🩺 Diagnostics & Troubleshooting
Permalink: Diagnostics & Troubleshooting

This document lists common issues, diagnostics procedures, and a comprehensive decoder for all **open-blueprint (`bp`)** CLI exit codes.

---

## 🚦 Exit Code Decoder
Permalink: Exit Code Decoder

If `bp` terminates with a non-zero exit code in your CI/CD pipeline or local shell, check the table below to identify the cause:

| Code | Severity | Classification | Cause & Resolution |
|:---:|---|---|---|
| **0** | Info | **Success** | All checks passed, no errors. |
| **1** | Critical | **General / Unexpected Error** | Unhandled system exception or runtime failure. Check error log. |
| **2** | Error | **Structural Failure** | Malformed files or invalid YAML frontmatter. Run `bp verify --fix`. |
| **3** | Error | **Semantic Failure** | Undefined skill reference or invalid tool parameters. Check your rules scopes. |
| **4** | Error | **Logical Failure** | Circular skill dependency or rule contradiction. Check `bp rule graph`. |
| **5** | Warning | **Drift Detected** | Repository is out of sync with `.bp-fingerprint.json`. Run `bp sync`. |
| **6** | Error | **Unsupported Backend** | Requested backend is disabled or missing in `.bp.json`. Check configs. |
| **7** | Error | **Template Pack Missing** | Target template pack is not installed locally. Run `bp template install`. |
| **8** | Error | **Permission Denied** | Local file operations blocked due to inadequate OS permissions. Check file ownership. |
| **9** | Error | **Registry Unreachable** | Network error during pack installation or sync. Verify connection settings. |
| **10** | Critical | **Signature Verification** | Cryptographic signature of template pack was corrupted. Re-download pack. |

---

## 🥼 Running the Doctor Diagnostic
Permalink: Running the Doctor Diagnostic

If your coding agent is ignoring rules or skipping local boundaries, execute the diagnostic subcommand to scan environment configurations:

```bash
bp doctor --tool claude --verbose
```

**See it in action:**
```
You: bp doctor --tool claude --verbose
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
