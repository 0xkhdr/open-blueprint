# Stage 1 — Audit Findings

Date: 2026-06-12. All data measured, not asserted. Read-only stage: the only `src/`-adjacent
change is the `check:circular` script fix in `package.json` (authorized by T1.3).

## 1. Circular dependencies (T1.1–T1.4)

**The pre-existing `check:circular` script was vacuous.** `madge --circular --ts-config
tsconfig.json src/` reported `Processed 0 files` and `✔ No circular dependency found!` —
a false green. Root cause: without `--extensions ts`, madge only scans `.js` files; `src/`
contains none. Fixed in `package.json` by adding `--extensions ts` (T1.3). The corrected run
processes all 201 files and finds **14 file-level circular dependencies**:

| # | Cycle | Kind | Severity | Proposed resolution (Stage 2) |
|---|---|---|---|---|
| C1 | `validator/structural.ts ↔ security/scan.ts` | type-only (`import type { ValidationError }` in scan.ts; structural.ts imports `scanForSecrets` value) | should-fix | move `ValidationError` to a shared types module; breaks cycle and layering violation V1 |
| C2 | `registry/signer.ts ↔ registry/trust.ts` | **runtime** (`keysDir` value ← trust; `generateKeyPair` value ← signer) | should-fix | extract `keysDir` into `registry/paths.ts` (or trust stops importing signer) — only runtime-value cycle in the codebase |
| C3–C14 | `translator/index.ts ↔ translator/adapters/*.ts` (12 cycles: amazon-q→MarkdownAdapter, antigravity, claude, codex, copilot, cursor, forgecode→SkillOnlyAdapter, gemini, generic, kiro, opendev, pi) | type-only (every adapter does `import type { BlueprintAdapter } from "../index.js"`; index imports adapter values) | should-fix | move the `BlueprintAdapter` interface out of `translator/index.ts` into `translator/adapter.ts`; all 12 cycles disappear with one mechanical change |

Verified each cycle's import kind by inspection: only C2 involves runtime values in both
directions. Type-only cycles are erased by `tsc` and pose no initialization hazard, but they
mask real cycles in tooling and should go.

**Baseline circular-dep count: 14** (recorded in `baseline-metrics.md`).

## 2. SRP / cohesion review of the 27 modules (T2.4)

- **`constants.ts` (33 LOC)** — exit-code table only. Single responsibility holds.
- **`errors.ts` (115 LOC)** — `BpError` hierarchy mapped to exit codes. Holds.
- **`logger.ts` (65 LOC)** — leveled logger. Holds.
- **`types/`** — one ambient declaration (`cliui.d.ts`). Holds; near-empty, fine.
- **`utils/`** — 7 files (errors, fs, input, normalize, paths, pkg, retry). Cohesive grab-bag
  of true utilities; no business logic observed. Holds.
- **`config/`** — project + user config loading. Holds.
- **`telemetry/`** — single `tracer.ts`. Holds.
- **`observability/`** — dashboard, semantic-drift, telemetry-detect. Mixed concerns:
  "semantic drift" overlaps validator's drift level; flag for Stage 2 boundary review. Also
  source of violation V8 (imports translator).
- **`security/`** — audit, governance, hook-validator, path-traversal, sandbox, scan. Cohesive
  as a topic but it sits at L1 while importing L2/L3 (V1–V3); it behaves more like a service
  layer than infrastructure. Stage 2 should either re-layer it or invert its deps.
- **`detector/`** — fingerprinting split by concern (languages, frameworks, tooling, security,
  enterprise-signals, workspace-parser) behind `index.ts` (358 LOC). Holds well; cleanest
  engine.
- **`templater/`** — 11 files; engine/writer/merger/manifest/selector separation is good.
  `index.ts` (394 LOC) orchestrates. Imports registry (V4) — orchestration concern leaking in.
  Mostly holds.
- **`validator/`** — **largest SRP problem.** 24 top-level files + `checks/` + `rules/`;
  `index.ts` is 630 LOC doing orchestration *and* level wiring. Contains alerting, escalation,
  cost, performance, rbac, compliance, orchestration — responsibilities that read as separate
  domains bolted onto validation. Also 7 upward imports (V5–V7) and the highest sibling
  coupling (`validator → translator` weight 17). Primary Stage 2 target.
- **`translator/`** — IR + serialize + fidelity + adapters. Cohesive; the 12 type-only cycles
  (C3–C14) are its only structural debt. `adapters/base/` shared bases are good reuse.
- **`backends/`** — registry/syntax/version-check for 31 tools. Holds.
- **`packs/`** — schema, store, materialize. Holds, except the module-level cycle with
  `rule-library` (V9).
- **`registry/`** — 9 files: artifact, canonical, client, install, publish, signer, tar, trust.
  Two responsibilities under one roof: remote client/install/publish *and* crypto
  (signer/trust/canonical). Acceptable now; consider a split if it grows. Contains C2.
- **`report/`** — model, build, sarif, snapshot. Holds.
- **`plugin/`** — single-file public API surface. Holds. **Do not prune its "unused" exports —
  they are the public contract** (`@agentic/bp/plugin`).
- **`plugins/`** — loader/runner/worker isolation internals. Holds.
- **`lsp/`** — server + entry. Holds.
- **`blueprint-sync/`** — diff/merge/types behind tiny index. Holds.
- **`rule-library/`** — manager + built-in packs data. Holds, but see §4 (duplicate concept in
  `ecosystem/rule-library.ts`).
- **`dx/`** — dev-server, docs, migrate: three unrelated features sharing a junk-drawer name.
  SRP violation at the module level. Stage 2: dissolve into their commands or rename.
- **`ecosystem/`** — diff, inheritance, marketplace-v2, merge, rule-library: another junk
  drawer. `diff.ts`/`merge.ts` conceptually overlap `blueprint-sync/diff.ts`/`merge.ts`, and
  `rule-library.ts` overlaps `src/rule-library/`. Strongest consolidation candidate.
- **`enterprise/`** — compliance-report, env-template, runbooks. Real implementations (not
  stubs) but thin; conceptual overlap with `validator/compliance.ts`. Review in Stage 2.
- **`multiagent/`** — chains (real DAG validation), mcp-governance, memory. Real code. Holds.
- **`cli/`** — 31 command files + orchestrators + ui. `commands/rule.ts` is 952 LOC and
  `doctor.ts` 623 LOC — command files doing business logic that belongs in modules. Stage 2
  target.

## 3. Export-surface audit (T3.1–T3.2)

Method: grep word-boundary search for each `src/*/index.ts` named export across `src/` and
`tests/`, excluding the owning module. Approximate (string match), so zero-hit results were
the focus and each was spot-verified.

Exports with **zero external consumers** (internal-helper leaks unless noted):

| Export | Module | Note |
|---|---|---|
| `ApprovalMode` | detector | type, unused outside detector |
| `PluginValidator` | plugin | **keep — public plugin API surface, not removable** |
| `TemplaterOptions`, `ManifestRecord`, `TemplaterResult`, `TemplateContext` | templater | types consumed only inside templater; candidates to stop re-exporting |
| `BlueprintAdapter` | translator | consumed only by adapter files inside the module — moving it to `translator/adapter.ts` fixes C3–C14 and removes the leak in one change |
| `UnsupportedBackendError` | translator | unused externally; verify CLI maps this error before removal |

Removal/de-export deferred to Stage 2 per spec §4.2 (findings, not fixes). None qualified as
"trivially safe + test-covered" enough to justify touching `src/` in Stage 1.

## 4. Speculative-code audit (T5.1–T5.3)

Correction to the spec's pre-measured baseline: `rule-library/` is **not** unreferenced. The
earlier grep missed dynamic imports — `src/cli/commands/rule.ts:776,893` dynamically imports
`rule-library/packs.js` and `rule-library/manager.js`, and `src/packs/store.ts:20` statically
imports `BUILT_IN_PACKS`. Verdict: **used**.

| Module | LOC | Entry points traced | Real work? | Verdict |
|---|---|---|---|---|
| `dx/` | 718 | `cli/commands/dev.ts`, `docs.ts`, `migrate.ts` | yes | **keep**, but dissolve the junk-drawer module name in Stage 2 |
| `ecosystem/` | 884 | `cli/commands/marketplace.ts`, `diff.ts`, `merge.ts`; dynamic import in `rule.ts:434` | yes | **consolidate** — diff/merge overlap `blueprint-sync/`, `rule-library.ts` overlaps `src/rule-library/` |
| `enterprise/` | 452 | `cli/commands/team.ts` + report path | yes (thin) | **keep**, review overlap with `validator/compliance.ts` |
| `multiagent/` | 323 | `cli/commands/chain.ts`, `mcp.ts`, `memory.ts` | yes (chains has real DAG validation) | **keep** |
| `blueprint-sync/` | 692 | `cli/commands/diff.ts`, `merge.ts`, sync | yes | **keep**, merge with or absorb `ecosystem/{diff,merge}.ts` |
| `rule-library/` | 592 | `rule.ts` (dynamic), `packs/store.ts` (static) | yes (380-LOC built-in pack data + manager) | **keep**, absorb `ecosystem/rule-library.ts` |

No module is dead code; the speculative-code risk is **duplication across modules**, not
aspirational stubs. Proposed-removal list: empty. Consolidation list for Stage 2:
`ecosystem/diff+merge → blueprint-sync`, `ecosystem/rule-library → rule-library/`.

## 5. Documentation drift (T6.1–T6.4)

- **Commands (T6.1):** `docs/commands.md` documents 31 `bp` commands; `src/cli/commands/` has
  31 files; the sets match 1:1 (adopt, agent, chain, config, convert, cost, dev, diff, docs,
  doctor, drift, emit, health, hook, init, marketplace, mcp, memory, merge, migrate, pack,
  report, rule, skill, sync, team, telemetry, template, trust, update, verify). Flag-level
  diffing not performed (recorded as a Stage 9 task), so this check is command-level only.
- **Exit codes (T6.2):** `EXIT_CODES` in `src/constants.ts` defines codes 0–10;
  `docs/troubleshooting.md` has `{#code-0}` … `{#code-10}` — all 11 anchors present, none
  extra. In agreement.
- **Schema versions (T6.3):** docs match code — Fingerprint `"1.0"`
  (`src/detector/fingerprint.ts` / `docs/data-models.md:11`), BlueprintIR `"2.0"`
  (`src/translator/ir.ts:401` / `docs/data-models.md:77`), `bp-pack/1`, `bp-pack-lock/1`,
  `bp-artifact/1` (`docs/data-models.md:168–177`), `bp-report/1`
  (`src/report/model.ts:12` / `docs/governance-reporting.md`). No drift.
- **Module lists (T6.4):** **drift found.** `AGENTS.md` mentions only 12 of the 24 `src/`
  directories (missing: blueprint-sync, dx, ecosystem, enterprise, lsp, multiagent,
  observability, rule-library, security, telemetry, types, utils). `CLAUDE.md` names the same
  core set plus pointers. Fix belongs to Stage 9 (docs revamp); recorded here as drift item
  D1.

## 6. Coverage gaps (T4.x)

See `baseline-metrics.md` for the measured numbers and the <65%-branch file list feeding the
Stage 4 backlog.
