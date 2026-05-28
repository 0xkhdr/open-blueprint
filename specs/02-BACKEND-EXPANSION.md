# Domain: Backend Expansion
**Priority:** P0 · **Status:** ✅ ALREADY IMPLEMENTED — Verify + Polish · **Dependencies:** `01-IR-SCHEMA-FOUNDATION.md`
**Agent Boundary:** All 10 adapters exist. Your job is to verify completeness, fix bugs, ensure AGENTS.md generation, and add missing template packs.

---

## 1. Current State (Verified from Repo)

All 10 backend adapters exist in `src/translator/adapters/`:

| Adapter | File | Status | AGENTS.md |
|---------|------|--------|-----------|
| Claude | `claude.ts` | ✅ Complete | ✅ Yes |
| Cursor | `cursor.ts` | ✅ Complete | ✅ Yes |
| Codex | `codex.ts` | ✅ Complete | ✅ Yes |
| PI | `pi.ts` | ✅ Exists | ⚠️ Verify |
| Kiro | `kiro.ts` | ✅ Exists | ⚠️ Verify |
| Antigravity | `antigravity.ts` | ✅ Exists | ⚠️ Verify |
| Copilot | `copilot.ts` | ✅ Exists | ⚠️ Verify |
| Gemini | `gemini.ts` | ✅ Exists | ⚠️ Verify |
| OpenDev | `opendev.ts` | ✅ Exists | ⚠️ Verify |
| Generic | `generic.ts` | ✅ Exists | ⚠️ Verify |

---

## 2. Verification Tasks

### Task 2.1: Adapter Completeness Audit
For each adapter, verify:
- [ ] `parse()` correctly extracts ALL IR fields from native files
- [ ] `render()` correctly writes ALL IR fields to native files
- [ ] `generateAgentsMD(ir)` is called and output written as `AGENTS.md`
- [ ] Handles missing/optional IR fields gracefully (no crashes)
- [ ] File paths match backend manifest patterns

### Task 2.2: Codex Adapter Deep Check
The Codex adapter has approval mode mapping. Verify:
- [ ] `hard` severity → `read-only` approval mode in rendered output
- [ ] `soft` severity → `auto` approval mode
- [ ] Settings `approval_mode` propagated to rules when `severity === "hard"`
- [ ] `codex.md` generated with approval matrix

### Task 2.3: Round-Trip Tests
- [ ] `claude → cursor → claude` round-trip ≥ 98% fidelity
- [ ] `claude → codex → claude` round-trip ≥ 95% fidelity
- [ ] `cursor → generic → cursor` round-trip ≥ 98% fidelity
- [ ] Test on fixture repos: node-express, node-nextjs, python-fastapi

### Task 2.4: Template Pack Verification
Check `templates/` directory for each backend:
- [ ] `manifest.json` exists with correct `backend`, `version`, `supported_features`
- [ ] `file_patterns` defined for anchor, rules, skills, agents, hooks
- [ ] `max_file_sizes` defined
- [ ] Template `.hbs` files exist for all 5 layers
- [ ] Base partials in `templates/_base/partials/` referenced correctly

### Task 2.5: Feature Parity Matrix
Create/update `docs/backend-parity.md`:
```markdown
| Feature | Claude | Cursor | Codex | PI | Kiro | Antigravity | Copilot | Gemini | OpenDev | Generic |
|---------|--------|--------|-------|----|----|-------------|---------|--------|---------|---------|
| Rules | ✅ | ✅ | ✅ | ? | ? | ? | ? | ? | ? | ✅ |
| Skills | ✅ | ✅ | ✅ | ? | ? | ? | ? | ? | ? | ✅ |
| Agents | ✅ | ✅ | ✅ | ? | ? | ? | ? | ? | ? | ✅ |
| Hooks | ✅ | ❌ | ✅ | ? | ? | ? | ? | ? | ? | ✅ |
| Settings | ✅ | ✅ | ✅ | ? | ? | ? | ? | ? | ? | ✅ |
| Commands | ✅ | ✅ | ✅ | ? | ? | ? | ? | ? | ? | ✅ |
| MCP | ✅ | ✅ | ✅ | ? | ? | ? | ? | ? | ? | ✅ |
| AGENTS.md | ✅ | ✅ | ✅ | ? | ? | ? | ? | ? | ? | ✅ |
```

---

## 3. Bug Fixes (If Found)

### 3.1 Common Adapter Issues
- **Missing optional field handling**: Check if `ir.mcp_servers?.length` is used (not just `ir.mcp_servers`)
- **File path normalization**: Ensure `path.join()` used consistently (not string concatenation)
- **UTF-8 encoding**: All `fs.readFileSync` / `fs.writeFileSync` must specify `"utf-8"`

### 3.2 Cursor Adapter Specific
- [ ] Verify `hooks: []` is correct (Cursor doesn't support hooks)
- [ ] Check if `.cursorrules` file is also generated (Cursor's legacy format)

### 3.3 Copilot Adapter Specific
- [ ] Verify `.github/copilot/instructions.md` path
- [ ] Check if `copilot-instructions.md` root fallback is generated

---

## 4. Acceptance Criteria

- [ ] All 10 adapters pass parse/render tests
- [ ] All adapters generate `AGENTS.md`
- [ ] Round-trip fidelity ≥ 95% for all backends
- [ ] Feature parity matrix published
- [ ] `bp convert --from claude --to {backend}` works for all 10 backends
- [ ] `npm run typecheck` exits 0
- [ ] `bun test` passes with no regressions

---

## 5. Cross-References

| Concern | File | Status |
|---------|------|--------|
| IR schemas consumed | `01-IR-SCHEMA-FOUNDATION.md` | ✅ Complete |
| Risk tier in templates | `03-DETECTOR-ENHANCEMENT.md` | ✅ Complete |
| Template conditional logic | `05-TEMPLATER-ENHANCEMENT.md` | ⚠️ Not started |

---

*Domain Spec: Backend Expansion · VERIFY + POLISH · open-blueprint v2.0*
