# Supported Tools

`bp` supports 31 AI coding backends. This document covers paths, syntax, extensions, and limitations for each.

## Backend Compatibility Matrix

| ID | Name | Skills Path | Commands Path | Syntax | Extension | Notes |
|---|---|---|---|---|---|---|
| `claude` | Claude Code | `.claude/skills` | `.claude/commands` | `:` | `.md` | |
| `cursor` | Cursor | `.cursor/skills` | `.cursor/commands` | `-` | `.md` | |
| `codex` | OpenAI Codex CLI | `.codex/skills` | `$CODEX_HOME/prompts` | `:` | `.md` | Global path |
| `github-copilot` | GitHub Copilot | `.github/copilot/skills` | `.github/copilot/commands` | `-` | `.prompt.md` | IDE-only |
| `kiro` | Kiro | `.kiro/skills` | `.kiro/commands` | `-` | `.prompt.md` | |
| `gemini` | Gemini CLI | `.gemini/skills` | `.gemini/commands` | `bare` | `.toml` | TOML format |
| `opendev` | OpenDev | `.opendev/skills` | `.opendev/commands` | `:` | `.md` | |
| `generic` | Generic | `.generic/skills` | `.generic/commands` | `:` | `.md` | |
| `pi` | Pi | `.pi/skills` | `.pi/commands` | `:` | `.md` | |
| `antigravity` | Antigravity | `.antigravity/skills` | `.antigravity/commands` | `:` | `.md` | |
| `amazon-q` | Amazon Q Developer | `.amazonq/skills` | `.amazonq/commands` | `:` | `.md` | |
| `auggie` | Auggie | `.auggie/skills` | `.auggie/commands` | `:` | `.md` | |
| `bob` | Bob | `.bob/skills` | `.bob/commands` | `:` | `.md` | |
| `cline` | Cline | `.cline/workflows/skills` | `.cline/workflows/commands` | `-` | `.md` | Workflows path |
| `codebuddy` | CodeBuddy | `.codebuddy/.opsx/skills` | `.codebuddy/.opsx/commands` | `:` | `.md` | Nested .opsx path |
| `continue` | Continue | `.continue/skills` | `.continue/commands` | `-` | `.prompt` | |
| `costrict` | Costrict | `.costrict/config/opsx/skills` | `.costrict/config/opsx/commands` | `bare` | `.md` | Nested config path |
| `crush` | Crush | `.crush/.opsx/skills` | `.crush/.opsx/commands` | `:` | `.md` | Nested .opsx path |
| `factory` | Factory | `.factory/skills` | `.factory/commands` | `:` | `.md` | |
| `forgecode` | Forge Code | `.forgecode/skills` | — | `skill` | — | Skill-only |
| `iflow` | iFlow | `.iflow/skills` | `.iflow/commands` | `:` | `.md` | |
| `junie` | Junie | `.junie/skills` | `.junie/commands` | `:` | `.md` | |
| `kilocode` | Kilo Code | `.kilocode/workflows/skills` | `.kilocode/workflows/commands` | `-` | `.md` | Workflows path |
| `kimi` | Kimi | `.kimi/skills` | — | `skill` | — | Skill-only |
| `lingma` | Lingma | `.lingma/.opsx/skills` | `.lingma/.opsx/commands` | `:` | `.md` | Nested .opsx path |
| `opencode` | OpenCode | `.opencode/skills` | `.opencode/commands` | `:` | `.md` | |
| `qoder` | Qoder | `.qoder/.opsx/skills` | `.qoder/.opsx/commands` | `:` | `.md` | Nested .opsx path |
| `qwen` | Qwen | `.qwen/skills` | `.qwen/commands` | `bare` | `.toml` | TOML format |
| `roocode` | Roo Code | `.roocode/skills` | `.roocode/commands` | `:` | `.md` | |
| `trae` | Trae | `.trae/skills` | — | `bare` | — | Skill-only |
| `windsurf` | Windsurf | `.windsurf/workflows/skills` | `.windsurf/workflows/commands` | `-` | `.md` | Workflows path |

## Command Syntax Reference

Each backend uses one of four command invocation syntaxes:

| Syntax | Pattern | Example | Backends |
|---|---|---|---|
| `colon` | `/bp:<workflow>` | `/bp:verify` | claude, codex, amazon-q, auggie, bob, codebuddy, crush, factory, iflow, junie, lingma, opencode, qoder, roocode, opendev, generic, pi, antigravity |
| `hyphen` | `/bp-<workflow>` | `/bp-verify` | cursor, cline, continue, github-copilot, kiro, kilocode, windsurf |
| `bare` | `bp-<workflow>` | `bp-verify` | gemini, qwen, costrict, trae |
| `skill` | `/skill:bp-<workflow>` | `/skill:bp-verify` | kimi, forgecode |

## Multi-Backend Setup Guide

### Single backend

```bash
bp init --tools claude
```

### Multiple backends

```bash
bp init --tools claude,cursor,windsurf
```

### All backends

```bash
bp init --tools all
```

The resulting `.bp.json` uses the v1 schema:

```json
{
  "backends": ["claude", "cursor", "windsurf"],
  "primary_backend": "claude",
  "exclude": ["legacy/", "vendor/", "dist/"],
  "plugins": []
}
```

### Per-backend overrides

```json
{
  "backends": ["claude", "cursor"],
  "primary_backend": "claude",
  "backend_configs": {
    "cursor": {
      "delivery_mode": "skills_only",
      "workflows": ["propose", "apply"]
    }
  }
}
```

## Backend-Specific Limitations

### IDE-Only Backends

**GitHub Copilot** (`github-copilot`): Generated command files require the Copilot IDE extension (VS Code, JetBrains, or Visual Studio). They are **not** available in Copilot CLI. `bp doctor` will always emit a warning for this backend.

### Global Path Backends

**Codex** (`codex`): Command files are written to `$CODEX_HOME/prompts/` (global, outside the project). If `$CODEX_HOME` is unset, the fallback is `~/.codex/prompts/`. Skill files remain project-local in `.codex/skills/`. `bp init --tools codex` requires explicit confirmation (`--confirm-global` in CI).

### Skill-Only Backends

The following backends **do not support command files** — only skill files are generated:

- **Kimi** (`kimi`): Skill invocation syntax `/skill:bp-<workflow>`
- **Trae** (`trae`): Bare invocation syntax `bp-<workflow>`
- **Forge Code** (`forgecode`): Skill invocation syntax `/skill:bp-<workflow>`

Running `bp verify` will report an error if command directories are found for these backends.

### TOML Command Backends

**Gemini** (`gemini`) and **Qwen** (`qwen`) generate command files in TOML format (`.toml` extension) instead of Markdown. `bp verify` validates TOML syntax for these backends.
