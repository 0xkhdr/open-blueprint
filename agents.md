# Agent Reference

Authoritative reference for agent definitions, lifecycle, communication protocols, state management, error handling, and extension points across all supported backends.

---

## Agent Lifecycle

Agents in open-blueprint pass through four stages: **scaffold → activate → execute → teardown**.

### Scaffold

`bp init <backend>` detects the project topology and writes backend-specific governance files to the appropriate directory. No runtime code is added — the scaffold is declarative configuration only.

```bash
# Scaffold for Claude Code backend
bp init claude

# Scaffold for Cursor backend
bp init cursor
```

See [CLI Reference](docs/commands.md) for all `bp init` options.

### Activate

Activation occurs when the agent runtime (e.g., Claude Code, Cursor) reads the scaffold files on session start. For Claude Code this is `.claude/CLAUDE.md`; for Cursor this is `.cursorrules`. The agent picks up rules, skills, and hooks declared in those files.

### Execute

During execution, the agent invokes tools and skills as defined in the blueprint. Each tool invocation follows a standard call/response contract (see [Communication Protocols](#communication-protocols)). `bp verify` can be run at any point to confirm blueprint integrity:

```bash
bp verify --level all
```

### Teardown

Teardown happens when the agent session ends or `bp sync` detects a clean state. The `.bp-fingerprint.json` file is updated to reflect the post-session hash of all governed files.

---

## Communication Protocols

### Tool Invocation Format

Agents call tools using a name + parameters envelope. The agent runtime resolves the tool name against the registered skill set and invokes the handler:

```json
{
  "name": "bp_verify",
  "parameters": {
    "level": "semantic",
    "json": true
  }
}
```

Response schema:

```json
{
  "exitCode": 0,
  "summary": "All checks passed",
  "details": []
}
```

On non-zero exit, `details` contains an array of validation findings. See [Error Handling](#error-handling) for exit code semantics.

### Inter-Agent Delegation

One agent delegates to another by invoking a skill registered in the blueprint. For Claude Code, this is a skill invocation via `.claude/skills/<skill-name>/SKILL.md`. The parent agent passes context through the skill's input parameters; the sub-agent returns its result through the standard response schema.

```yaml
# .claude/skills/review/SKILL.md frontmatter
name: review
description: Delegate a code review to the review sub-agent
```

Sub-agent spawning via the Claude Code Agent tool follows the same envelope: the delegating agent supplies a `prompt` and optional `subagent_type`; the runtime returns the sub-agent's response as a single message.

---

## State Management

### `.bp-fingerprint.json`

`bp` tracks agent-relevant state in `.bp-fingerprint.json` at the repo root. This file records the SHA-256 hashes of all governed blueprint files, the backend in use, and the schema version.

Key fields:

```json
{
  "schema_version": "2.0",
  "backend": "claude",
  "governed_files": {
    ".claude/CLAUDE.md": "sha256:abc123...",
    ".claude/rules/01-style.md": "sha256:def456..."
  },
  "last_synced": "2026-05-28T10:00:00Z"
}
```

When `bp verify --level drift` runs, it recomputes hashes and diffs them against this file. Any mismatch triggers exit code 6 (`DRIFT_DETECTED`).

### Session Scope vs Persistent Scope

- **Session scope**: Values computed during a single `bp verify` or `bp init` run. Not persisted after the command exits.
- **Persistent scope**: Written to `.bp-fingerprint.json` and survives re-runs. Reset only by `bp sync --auto-apply`.

### `bp:preserve` Blocks

Sections of governed files that should survive a `bp init --force` re-run are wrapped in `bp:preserve` / `bp:end-preserve` markers. `bp` reads these markers before overwriting and re-injects the preserved content into the new scaffold.

```markdown
<!-- bp:preserve -->
## My Custom Rules

These rules are preserved across re-inits.
<!-- bp:end-preserve -->
```

Any content outside a `bp:preserve` block is treated as scaffold-owned and will be overwritten by `bp init --force`.

---

## Error Handling

### Exit Code Semantics

All `bp` commands exit with a code from the [exit code registry](docs/troubleshooting.md). Codes relevant to agent-triggered failures:

| Code | Name | Meaning |
|------|------|---------|
| `0` | `SUCCESS` | All checks passed |
| `2` | `INVALID_ARGS` | Missing or conflicting CLI arguments |
| `3` | `CONFIG_ERROR` | `.bp.json` schema validation failed |
| `4` | `STRUCTURAL_VALIDATION_FAILED` | Blueprint file structure invalid |
| `5` | `SEMANTIC_VALIDATION_FAILED` | Rules logically inconsistent |
| `6` | `DRIFT_DETECTED` | File hashes diverge from fingerprint |
| `10` | `HEALTH_ERROR` | `bp health` check(s) failed |

See [Diagnostics & Troubleshooting](docs/troubleshooting.md) for the full registry with resolution steps.

### Recovery Pattern

When an agent receives a non-zero exit from `bp verify`, the recommended pattern is:

1. Parse the JSON output (`bp verify --json`) to extract `details[].code` and `details[].message`.
2. Map the exit code to a recovery action using the table above.
3. For codes 4 and 5: invoke `bp verify --fix` to attempt auto-correction, then re-verify.
4. For code 6 (drift): invoke `bp sync --auto-apply`, then re-verify.
5. If exit code persists after auto-recovery, surface the error to the user with the full `details` array.

```bash
# Agent recovery script pattern
if ! bp verify --json > /tmp/bp-result.json; then
  exit_code=$?
  case $exit_code in
    4|5) bp verify --fix ;;
    6)   bp sync --auto-apply ;;
  esac
  bp verify  # final re-check
fi
```

---

## Extension Points

### Plugin API

Custom validators are written in TypeScript and registered via the Plugin API. A validator receives the `BlueprintIR` and returns an array of `ValidationFinding` objects.

See [Plugin Developer API](docs/plugin-api.md) for the full interface and a walkthrough example.

### Backend Adapters

Custom backend adapters translate `BlueprintIR` to and from a new target platform's file format. Implement the `BackendAdapter` interface exported from `@agentic/bp/adapters`.

See [Custom Backend Adapters](docs/backend-adapter.md) for the adapter contract and integration steps.

### Hook Scripts

The hooks layer (`.claude/hooks/`) provides shell or Node.js scripts that the agent runtime executes before or after specific events (e.g., `pre_tool_use`, `post_tool_use`). Hooks receive event context as JSON on stdin and can block execution by exiting non-zero.

```javascript
// .claude/hooks/pre_tool_use.js
const event = JSON.parse(process.stdin.read());
if (event.tool_name === "Write" && event.path.includes("/etc/")) {
  process.stderr.write("Write to /etc/ blocked by hook\n");
  process.exit(1);
}
```

`bp hook generate` scaffolds a hook template for the current backend. `bp hook validate <file>` lints hook scripts against the expected event schema.

---

## Backend Compatibility

The table below shows which agent feature layers are supported per backend. For the full matrix including individual IR features, see [Backend Feature Parity Matrix](docs/backend-parity.md).

| Feature | Claude | Cursor | Codex | PI | Kiro | Antigravity | Copilot | Gemini | OpenDev | Generic |
|---------|--------|--------|-------|----|------|-------------|---------|--------|---------|---------|
| **Agents layer** | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Skills layer** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Hooks layer** | ✅ | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Rules layer** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ✅ |
| **MCP layer** | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## See Also

- [CLI Reference](docs/commands.md) — all `bp` commands
- [Diagnostics & Troubleshooting](docs/troubleshooting.md) — exit codes 0–10 with resolution steps
- [Plugin Developer API](docs/plugin-api.md) — custom validators
- [Custom Backend Adapters](docs/backend-adapter.md) — new platform support
- [Backend Feature Parity Matrix](docs/backend-parity.md) — full feature matrix
