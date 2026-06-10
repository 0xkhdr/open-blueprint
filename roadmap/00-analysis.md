# open-blueprint — Domain & Governance Analysis

> Generated 2026-06-11. Source of truth for the staged improvement roadmap in `roadmap/stages/`.
> Read this file first in any fresh implementation context.

## 1. What the tool is

**open-blueprint (`bp`)** is a zero-runtime-overhead CLI that prepares repositories for agentic AI
tools (Claude Code, Cursor, OpenDev, Gemini CLI, 31 backends total). It operates only at
development-time and CI-time:

```
Repository → Detector (Fingerprint) → Templater (Handlebars) → Blueprint files
                                                                    │
                                              Validator (4 layers) ─┤
                                              Translator (IR sync) ─┘
```

### The five governance pillars (docs/philosophy.md)

1. **Scaffolding-only, not invasive** — generates native configs; bp is uninstallable.
2. **Idempotent, not destructive** — block-level merging (`bp:preserve` blocks).
3. **Fail-loud, not silent** — line-precise errors with resolutions, exit codes 0–10.
4. **Backend-agnostic** — Zod-validated `BlueprintIR` translates across backends.
5. **Brownfield-first** — Detector fingerprints existing repos (lockfiles, topology).

### The five blueprint layers (governed artifacts)

| Layer | Artifact | Claude path | IR schema |
|---|---|---|---|
| 1 | Spatial Anchor | `CLAUDE.md` | `SpatialAnchorSchema` |
| 2 | Personas/Agents | `.claude/agents/*.md` | `PersonaSchema` |
| 3 | **Rules** | `.claude/rules/*.md` | `RuleSchema` (id, scope glob, severity hard/soft, action, rationale, tags) |
| 4 | **Skills** | `.claude/skills/*.md` | `SkillSchema` (name, description, when_to_use, tools_required, procedure) |
| 5 | Hooks | `.claude/hooks/*` | `HookSchema` |

IR v2.0 adds Settings, Commands, MCP Servers, plus enterprise cross-layer schemas
(Identity/RBAC, Audit, Compliance, Orchestration, Cost, Alerting) — see `src/translator/ir.ts`.

### The four validation layers (src/validator/)

1. **Structural** — frontmatter and Markdown syntax (`structural.ts`).
2. **Semantic** — scope globs resolve, tool references exist (`semantic.ts`).
3. **Logical** — Tarjan SCC cycles, glob-intersection conflicts, string-heuristic
   contradiction detection between rule `action` texts (`logical.ts`).
4. **Drift** — fingerprint delta vs. current repo state (`drift.ts`).

Plus a `governance` level that Zod-parses the IR layers (settings, commands, MCP, RBAC,
compliance, cost, alerting) via `layers.ts` / `layers-deep.ts` / `cross-layer.ts`.

## 2. The governance the tool *promises*

The README/docs position bp as delivering **enforceable, drift-proof governance**:
"enforce strict, drift-proof constraints with absolute confidence", compliance rule packs
(GDPR/SOC2/HIPAA/PCI-DSS/ISO-27001), CI gates with SARIF output, signed template packages,
a plugin API for "company governance policies".

## 3. The governance the tool *delivers today* — gap analysis

### GAP-1 (critical): rule actions are prose, never enforced

`Rule.action` is a free-text string like `require(auditLoggingEnabled && auditLogRetention >= 365)`.
**Nothing evaluates it.** Evidence:

- `src/validator/logical.ts` only does string-similarity contradiction checks between
  action texts (lines ~300–325).
- `src/rule-library/manager.ts#validateRules` only checks field presence.
- `bp rule test` (`src/cli/commands/rule.ts`) only resolves the scope glob and prints
  which files match — it never evaluates the action against those files.

Consequence: installing the GDPR pack adds 6 markdown rules an LLM *may* read, but
`bp verify` cannot fail a build because audit logging is missing. The core value
proposition ("absolute confidence") is unfulfilled. **Stage 1 fixes this.**

### GAP-2 (high): no client-authored rule packs

`BUILT_IN_PACKS` are hardcoded TypeScript constants in `src/rule-library/packs.ts`.
`bp rule pack:install` resolves only against built-ins. There is no on-disk pack format,
no `pack:create`, no install from path/URL, no schema (`RulePack` is a TS interface, not
a Zod schema → no runtime validation of external pack data). **Stage 2 fixes this.**

### GAP-3 (high): no skill authoring surface at all

Skills are layer 4 of the governance model, `SkillSchema` exists in IR, templates ship
two example skills — but there is **no `bp skill` command** (checked `src/cli/index.ts`
and `src/cli/commands/`). Clients cannot scaffold, lint, test, package, or share skills.
Skill files only get generic structural/semantic validation as markdown; nothing checks
`tools_required` against backend capability, procedure quality, or name collisions.
**Stage 3 fixes this.**

### GAP-4 (high): plugin API is documented but does not exist; sandbox is unsafe and broken

- `docs/plugin-api.md` documents `definePlugin`/`ValidationContext` imported from
  `@agentic/bp/plugin`. The `src/plugin/` directory is **empty**; package.json exports
  only `"."`. Plugins per the docs cannot be written.
- The actual loader (`src/plugins/loader.ts`) runs raw scripts in `node:vm` with a
  context exposing only `validate()` and `console` — no blueprint, no IR, no files.
  A plugin cannot inspect anything, so it cannot validate anything.
- **Timeout bug**: `script.runInContext(context)` is synchronous; the `Promise.race`
  timeout can never fire while it runs. Must pass `{ timeout }` to `runInContext`.
- **Security**: `node:vm` is explicitly not a security boundary (constructor-escape
  reaches host realm despite the denied globals in `sandbox.ts`). The docs imply
  sandboxed third-party validators; that claim is false today. **Stage 4 fixes this.**

### GAP-5 (medium): no real remote distribution or trust policy

`src/registry/client.ts` has no real remote fetch or publish: `list()` only enumerates
the template packs bundled on disk (`listBundledPacks`), with an in-memory mock map
behind it for unit tests. (Post-roadmap refactor `694fbbf` already removed the fake
`@bp-templates/*` listing, marketplace ratings, and the unaudited "verified" badge —
do not reintroduce them.) `signer.ts` implements RSA-2048 sign/verify + keyring loading,
but no real fetch, no pack publishing, no trust policy connecting signatures to
pack/skill installs. **Stage 5 fixes this.**

### GAP-6 (medium): no governance feedback loop

Packs declare `coverage` percentages as static metadata. There is no compliance report
("which GDPR rules pass/fail in this repo"), no per-rule pass/fail mapping into SARIF,
no drift detection on installed packs (pack updated upstream vs. installed version).
**Stage 6 fixes this.**

### Cross-cutting observations

- Docs frequently promise beyond implementation (plugin API, registry, "98% fidelity").
  Each stage must update docs to match shipped behavior — fail-loud applies to docs too.
- Codebase conventions to preserve: ESM + `.js` import suffixes, Zod for all external
  data, async fs only (enforced by `lint:no-sync-fs` for listed files), no `process.exit`
  outside `src/cli/index.ts`, Biome lint, Vitest + fast-check, pino logger,
  `BpError(message, exitCode, code, resolution)` error type, OTel spans via
  `startSpan` in `src/telemetry/tracer.ts`.
- `npm run ci` = typecheck + lint + custom lints + coverage. Every stage must keep it green.

### Post-roadmap codebase state (merged after this analysis was first written)

Two refactors landed on `main` after the roadmap was authored — account for them:

- **`2ed02a6` (ownership + honest naming).** Added an **ownership manifest** at
  `.bp/manifest.json` (`src/templater/manifest.ts`): records every rendered file's hash,
  source template, and origin. Added `bp adopt` (`src/cli/commands/adopt.ts`) — brings
  user-authored rules/skills/agents under tracking with `--status` classification — and
  `bp emit` (`src/cli/commands/emit.ts`, `src/translator/serialize.ts`). Added
  `src/utils/normalize.ts` (prose normalization before diffing). Renamed
  `detectSemanticDrift → detectBehavioralDrift` and `computeSimilarity → isOutputIdentical`
  (deprecated aliases kept) — **use the new names in any new code.**
  - Stage 3: reuse `bp adopt`'s tracking/classification for user-authored skills; do not
    duplicate it.
  - Stages 5/6: the pack **lockfile** is a distinct artifact from the ownership
    **`.bp/manifest.json`** — do not conflate or overwrite the manifest.
- **`694fbbf` (honesty refactor).** Removed marketplace ratings, the "verified" badge, the
  fake `@bp-templates/*` registry listing, synthetic drift/cost data. Do not reintroduce
  these. `docs/commands.md` was NOT updated for `bp adopt`/`bp emit` — any stage touching
  `docs/commands.md` should add those rows while it's there (DoD: docs match shipped CLI).

## 4. Strategy: how the stages compose

```
Stage 1  Executable rule conditions  ← makes governance real (enforcement engine)
Stage 2  Custom rule packs           ← clients author rules    (depends on 1's schema)
Stage 3  Skill authoring + packs     ← clients author skills   (reuses 2's pack format)
Stage 4  Plugin API v1 + sandbox fix ← escape hatch for checks the DSL can't express
Stage 5  Pack distribution + signing ← share packs/skills under bp trust umbrella
Stage 6  Governance reporting        ← prove the value (compliance reports, SARIF, drift)
```

Stages 1→2→3 are strictly ordered. Stage 4 is independent after 1. Stage 5 depends on
2 and 3. Stage 6 depends on 1 and 2 (richer with 5).

Each stage directory contains `spec.md` (complete design, schemas, file-level plan,
acceptance criteria) and `tasks.md` (ordered checklist). Implement one stage per fresh
context; specs are written to be self-sufficient given this analysis file.
