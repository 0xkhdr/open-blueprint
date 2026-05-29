# JSON Output Reference

All `bp` CLI commands support `--json` for machine-readable output. When `--json` is passed, all spinner and color output is suppressed from stdout.

## bp init --json

```json
{
  "status": "ok",
  "backends": [
    {
      "backend": "claude",
      "filesWritten": [".claude/skills/example.md", "AGENTS.md"],
      "templatePack": "default"
    }
  ]
}
```

Error shape:

```json
{
  "status": "error",
  "error": "Unknown backend ID(s): unknowntool"
}
```

## bp verify --json

Success:

```json
{
  "status": "ok",
  "errors": [],
  "warnings": [],
  "filesChecked": 12
}
```

With errors:

```json
{
  "status": "error",
  "errors": [
    {
      "file": ".claude/rules/example.md",
      "type": "MISSING_FRONTMATTER",
      "severity": "error",
      "message": "Rule file is missing required frontmatter",
      "resolution": "Add frontmatter with scope, severity, and action fields"
    }
  ],
  "warnings": [],
  "filesChecked": 12
}
```

## bp convert --json

```json
{
  "status": "ok",
  "filesWritten": [".windsurf/workflows/skills/example.md", "AGENTS.md"]
}
```

## bp doctor --all --json

```json
{
  "backends": [
    {
      "id": "claude",
      "healthy": true,
      "skills": 3,
      "commands": 5,
      "warnings": []
    },
    {
      "id": "kimi",
      "healthy": false,
      "skills": 0,
      "commands": 0,
      "warnings": ["Skills directory missing: .kimi/skills"]
    }
  ]
}
```

## bp drift --json

```json
{
  "backends": [
    {
      "backend": "claude",
      "status": "in sync",
      "message": "Backend \"claude\" is in sync"
    },
    {
      "backend": "cursor",
      "status": "drifted",
      "message": "Backend \"cursor\" files have changed since last baseline"
    },
    {
      "backend": "windsurf",
      "status": "missing",
      "message": "Backend \"windsurf\" configured but not scaffolded — run bp init --tools windsurf"
    }
  ]
}
```

### Drift Status Values

| Status | Meaning |
|---|---|
| `in sync` | Backend files match baseline |
| `drifted` | Backend files changed since last `bp drift baseline` |
| `missing` | Backend is configured in `.bp.json` but files do not exist |
| `orphaned` | Backend files exist but backend is not configured in `.bp.json` |
