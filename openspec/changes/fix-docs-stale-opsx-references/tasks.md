## 1. Fix README.md Supported Backends Table

- [x] 1.1 Replace `/opsx:<workflow>` with `/bp:<workflow>` in the Command Syntax column for colon-style backends (claude, codex, amazon-q, roocode, opencode, and any others listed)
- [x] 1.2 Replace `/opsx-<workflow>` with `/bp-<workflow>` for hyphen-style backends (cursor, cline, continue, github-copilot, kiro, kilocode, windsurf)
- [x] 1.3 Replace `/openspec-<workflow>` with `bp-<workflow>` (bare) for bare-style backends (gemini, qwen)
- [x] 1.4 Replace `/skill:openspec-<workflow>` with `/skill:bp-<workflow>` for skill-only backends (kimi, trae, forgecode)

## 2. Fix supported-tools.md Command Syntax Reference Table

- [x] 2.1 Update the colon row: Pattern → `/bp:<workflow>`, Example → `/bp:verify`
- [x] 2.2 Update the hyphen row: Pattern → `/bp-<workflow>`, Example → `/bp-verify`
- [x] 2.3 Update the bare row: Pattern → `bp-<workflow>`, Example → `bp-verify`
- [x] 2.4 Update the skill row: Pattern → `/skill:bp-<workflow>`, Example → `/skill:bp-verify`

## 3. Fix supported-tools.md Skill-Only Backends Prose

- [x] 3.1 Update Kimi description: replace `/skill:openspec-<workflow>` → `/skill:bp-<workflow>`
- [x] 3.2 Update Trae description: replace `/openspec-<workflow>` → `bp-<workflow>`
- [x] 3.3 Update Forge Code description: replace `/skill:openspec-<workflow>` → `/skill:bp-<workflow>`

## 4. Fix Backend Compatibility Matrix — opsx-Nested Path Backends

- [x] 4.1 `codebuddy` row: Skills Path → `.codebuddy/skills`, Commands Path → `.codebuddy/commands`, Notes → (empty)
- [x] 4.2 `costrict` row: Skills Path → `.costrict/skills`, Commands Path → `.costrict/commands`, Notes → (empty or `Deep nested config`)
- [x] 4.3 `crush` row: Skills Path → `.crush/skills`, Commands Path → `.crush/commands`, Notes → (empty)
- [x] 4.4 `lingma` row: Skills Path → `.lingma/skills`, Commands Path → `.lingma/commands`, Notes → (empty)
- [x] 4.5 `qoder` row: Skills Path → `.qoder/skills`, Commands Path → `.qoder/commands`, Notes → (empty)

## 5. Verify No Remaining Stale References

- [x] 5.1 Run `grep -rn "opsx\|openspec" README.md docs/` and confirm zero matches (excluding node_modules)
- [x] 5.2 Review all changed lines to ensure no `bp`-prefixed examples accidentally broke surrounding prose context
