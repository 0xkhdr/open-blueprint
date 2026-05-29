# Backend Feature Parity Matrix

**Generated:** 2026-05-28 · **Version:** open-blueprint v2.0

This matrix shows which IR layers each backend adapter reads and writes.

| Feature      | Claude | Cursor | Codex | PI | Kiro | Antigravity | Copilot | Gemini | OpenDev | Generic |
|--------------|--------|--------|-------|----|------|-------------|---------|--------|---------|---------|
| **Rules**    | ✅     | ✅     | ✅    | ✅ | ✅   | ✅          | ✅      | ✅     | ❌      | ✅      |
| **Skills**   | ✅     | ✅     | ✅    | ✅ | ✅   | ✅          | ✅      | ✅     | ✅      | ✅      |
| **Agents**   | ✅     | ✅     | ✅    | ✅ | ❌   | ❌          | ❌      | ❌     | ❌      | ✅      |
| **Hooks**    | ✅     | ❌     | ✅    | ✅ | ❌   | ❌          | ❌      | ❌     | ❌      | ✅      |
| **Settings** | ❌     | ❌     | ✅    | ✅ | ❌   | ❌          | ✅      | ❌     | ❌      | ❌      |
| **Commands** | ❌     | ❌     | ❌    | ❌ | ❌   | ❌          | ❌      | ❌     | ❌      | ❌      |
| **MCP**      | ✅     | ✅     | ❌    | ❌ | ❌   | ❌          | ❌      | ❌     | ❌      | ❌      |
| **AGENTS.md**| ✅     | ✅     | ✅    | ✅ | ✅   | ✅          | ✅      | ✅     | ✅      | ✅      |

## Feature Details

### Rules

- **Claude**: `.claude/rules/*.md` — full frontmatter (id, scope, severity, action, rationale, tags)
- **Cursor**: `.cursor/rules/*.md` — full frontmatter
- **Codex**: `codex-instructions.md` — embedded in single file, approval_mode mapped from severity
- **PI**: `pi-instructions.md` + individual rule files — full frontmatter
- **Kiro**: `.kiro/steering/*.md` — rules embedded as steering docs
- **Antigravity**: `.antigravity/rules/*.md` — full frontmatter
- **Copilot**: `.github/copilot/rules/*.md` — full frontmatter
- **Gemini**: `.gemini/rules/*.md` — full frontmatter
- **OpenDev**: ❌ Not supported (skills-only backend)
- **Generic**: `rules/*.md` — full frontmatter

### Skills

- All backends: write to their respective `skills/` subdirectory with frontmatter (name, description, when_to_use, tools_required)
- **OpenDev**: `.opendev/skills/*.md` — frontmatter only (name, description, when_to_use, tools_required)
- **Kiro**: `.kiro/skills/*.md`
- **Antigravity**: `.antigravity/skills/*.md`
- **Gemini**: `.gemini/skills/*.md`

### Agents (Personas)

- **Claude**: `.claude/agents/*.md` — full persona frontmatter
- **Cursor**: `.cursor/agents/*.md` — full persona frontmatter
- **Codex**: individual agent files in codex format
- **PI**: `.pi/agents/*.md` — full persona frontmatter
- **Kiro, Antigravity, Copilot, Gemini, OpenDev**: ❌ Not supported
- **Generic**: `agents/*.md` — full persona frontmatter

### Hooks

- **Claude**: `.claude/hooks/pre_tool_use.*`, `post_tool_use.*`
- **Cursor**: ❌ Not supported (hooks: [] always)
- **Codex**: hook files rendered
- **PI**: hook files rendered
- **Kiro, Antigravity, Copilot, Gemini, OpenDev**: ❌ Not supported
- **Generic**: `hooks/pre_tool_use.*`, `post_tool_use.*`

### Settings

- **Codex**: `approval_mode` propagated to rule frontmatter + codex.md
- **PI**: full settings rendered in `pi.config.ts`
- **Copilot**: `.github/copilot/settings.yaml` — approval_mode, model, cost controls

### MCP Servers

- **Claude**: `.claude/mcp.json` — full MCP server config
- **Cursor**: `.cursor/mcp.json` — full MCP server config
- All other backends: ❌ Not supported

### AGENTS.md

All 10 backends generate `AGENTS.md` at the project root (universal output for Codex/other tools).

## Round-Trip Fidelity

| Path | Rules | Skills | Agents | Hooks | MCP |
|------|-------|--------|--------|-------|-----|
| claude → cursor → claude | ✅ ≥98% | ✅ ≥98% | ✅ | ❌ (cursor drops) | ✅ |
| claude → codex → claude | ✅ ≥95% | ✅ ≥95% | ✅ | ✅ | ❌ |
| cursor → generic → cursor | ✅ ≥98% | ✅ ≥98% | ✅ | ❌ (cursor drops) | ❌ |

## Backend File Layout Summary

| Backend | Config Dir | Anchor File | Notes |
|---------|-----------|-------------|-------|
| Claude | `.claude/` | `CLAUDE.md` | Full-featured |
| Cursor | `.cursor/` | `.cursorrules` | No hooks |
| Codex | root | `codex-instructions.md` | Single-file format |
| PI | `.pi/` | `pi-instructions.md` | + TypeScript config |
| Kiro | `.kiro/` | `.kiro/agent.yaml` | Steering-doc approach |
| Antigravity | `.antigravity/` | `context.md` | Rules + skills only |
| Copilot | `.github/copilot/` | `instructions.md` | GitHub Copilot format |
| Gemini | `.gemini/` | `GEMINI.md` | Gemini CLI format |
| OpenDev | `.opendev/` | — | Skills-only |
| Generic | root | `BLUEPRINT.md` | Portable fallback |
