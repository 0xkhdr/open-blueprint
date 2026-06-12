# Production Regression Review — open-blueprint v1.0.0

**Date**: 2026-06-12
**Branch**: `claude/bp-tool-analysis-improvements-galwk`
**Scope**: Full-repository pre-release audit — readability, security, performance, docs/feature parity.
**Verdict**: **NOT release-ready.** Automated gates are green, but the live smoke test breaks the first-run experience and the public exit-code API contradicts itself in three places.

---

## 1. Evidence Collected

| Gate | Result |
|---|---|
| `npm run typecheck` | ✅ pass |
| `npm run lint` (biome) | ⚠️ 2 fixable warnings |
| `npm run lint:custom` (no-sync-fs / no-interior-exit / no-require) | ✅ pass |
| Unit + integration tests | ✅ 1793 passed (157 files) |
| E2E tests | ✅ 21 passed (4 files) |
| Build + `dist` smoke (`--version`) | ✅ pass |
| Live smoke: `init claude` → `verify` in clean dir | ❌ exit 5, 32 warnings |
| Live smoke: `verify --json \| jq` | ❌ invalid JSON on stdout |

---

## 2. Findings

### 2.1 Release Blockers 🔴

#### B1 — Exit-code API: three conflicting tables

Docs declare exit codes 0–10 a frozen public API (`docs/nfrs.md`), yet three sources disagree:

| Code | `docs/troubleshooting.md` | `src/constants.ts` (`EXIT_CODES`) | `src/errors.ts` classes |
|---|---|---|---|
| 2 | Invalid CLI args | `STRUCTURAL_FAILURE` | — |
| 3 | Config error | `SEMANTIC_FAILURE` | — |
| 4 | Structural failure | `LOGICAL_FAILURE` | `ValidationError` default |
| 5 | Semantic failure | `DRIFT_DETECTED` | — |
| 6 | Drift detected | `UNSUPPORTED_BACKEND` | — |
| 7 | Translation error | `TEMPLATE_NOT_FOUND` | `TranslationError` = 7 |
| 8 | Network error | `PERMISSION_DENIED` | `NetworkError` = 8, `SecurityError` = 8 |
| 9 | Permission denied | `REGISTRY_UNREACHABLE` | `PermissionError` = 9 |
| 10 | Health check failure | `SIGNATURE_FAILED` | `HealthError` = 10 |

`errors.ts` follows the documented convention; the validator pipeline follows `constants.ts`. The same exit code therefore means different things depending on which code path fails. CI consumers cannot rely on this contract.

#### B2 — Fresh `bp init claude` → `bp verify` exits 5

Reproduced in a clean temp dir: scaffold succeeds, then immediate `bp verify` emits **32 warnings** (`ENTRY_POINT_DRIFT`, `SKILL_STALE_PATH`, `UNKNOWN_TOOL_REFERENCE` for the scaffold's own `Grep`/`Bash` references, `ZERO_MATCH_SCOPE`) and exits **5** despite `passed: true` (`exitCodeForResult` in `src/validator/index.ts:553` maps drift-class warnings to `DRIFT_DETECTED` even on pass). The tool's own scaffold fails the tool's own validator instantly — violating the documented idempotency NFR and breaking every CI recipe in `docs/recipes.md`. Additionally, a stray `rules-minimal.md` is written at the repository root instead of inside `.claude/`.

#### B3 — `--json` stdout is not valid JSON

Pino log lines (audit HMAC warning, validation-cache miss warning with full stack trace) interleave with the JSON payload on stdout. `src/logger.ts:16` only switches formatting on TTY detection; it never redirects logs to stderr. `bp verify --json | jq` fails to parse. This kills the machine-readable contract promised in `docs/json-output.md`.

#### B4 — Docker image cannot run `bp init`

`Dockerfile` copies only `dist/`, `node_modules/`, and `package.json` into the runner stage. `TEMPLATES_ROOT` resolves to `<package-root>/templates` (`src/templater/selector.ts:7`), which does not exist in the image — and `templates/` is never copied into the builder stage either. Any scaffolding command fails inside the container.

### 2.2 Security Findings 🟠

#### S1 — Path traversal in mock-registry install extraction

`src/registry/client.ts:397-401`: `install()` writes archive entries via `path.join(targetDir, relPath)` with no traversal check. A malicious archive key such as `../../x` escapes the target directory. Gated behind `BP_REGISTRY_MOCK=1`, but the code ships in the production bundle.

#### S2 — Fail-open signature verification

`src/registry/client.ts:353-356`: when no public key is configured, `install()` logs a warning and proceeds to install **unsigned**. This contradicts the trust-policy default `require_signature: true` in `src/registry/trust.ts`.

#### S3 — Hook safety validator trivially bypassed

`src/security/hook-validator.ts` is a line-based regex denylist that misses: ESM `import "child_process"` statements, `node:`-prefixed specifiers, dynamic `import()`, `globalThis["eval"]`, and `process["env"]` bracket access. `docs/commands.md` claims `bp hook validate` "ensures safety" — an overpromise.

#### S4 — Windows-broken module path resolution

`src/registry/client.ts:364`: `new URL(import.meta.url).pathname` yields `/C:/...` on Windows and mishandles percent-encoded paths. Must use `fileURLToPath`. The package declares cross-platform Node ≥ 20 support.

#### Verified-solid security controls ✅

- `registry/tar.ts`: hostile-input-first ustar extraction (regular files only, traversal/link rejection, size caps before allocation).
- `registry/client.ts` fetch path: HTTPS pinning with per-hop redirect re-validation, bounded redirects, abort timeout, byte caps.
- Handlebars engine: helper allowlist, JSON round-trip prototype strip, `deepFreeze` context.
- `utils/paths.ts` `resolveAndValidatePath`: prefix check **plus** realpath symlink-escape check.
- No `child_process`/`eval` in `src/`; js-yaml v4 safe load; pino redact list matches docs; OWASP table in `docs/nfrs.md` substantially verified.

### 2.3 Docs ↔ Implementation Gaps 🟡

| ID | Gap |
|---|---|
| D1 | `bp verify --entropy-scan` is **dead code**: flag parsed (`src/cli/commands/verify.ts:148,160`) but never forwarded to `runValidator`; `scanForSecrets` called with no options in `src/validator/structural.ts:319` and `src/validator/hook.ts:52`. `.bp.json` `scan.entropyEnabled` equally ignored on the verify path. Only `bp doctor` enables entropy. |
| D2 | `bp health` is registered in the CLI but absent from the `docs/commands.md` command table. |
| D3 | `bp init` docs omit implemented flags `--tools`, `--interactive`, `--json`; docs list 4 backends, the registry has 31. |
| D4 | Per-command "Error codes" lines in `docs/commands.md` repeat the wrong exit-code table (see B1). |

### 2.4 Quality / Hygiene 🔵

| ID | Issue |
|---|---|
| Q1 | 2 biome warnings: `client.ts:154` (use optional chain), `client.ts:266` (unused private `registryUrl`). |
| Q2 | Version hardcoded in `src/cli/index.ts:38-42`, duplicating `package.json` — silent drift on next bump. |
| Q3 | Duplicate implementations: `deepFreeze` in `templater/engine.ts` and `security/sandbox.ts`; path guards in `security/path-traversal.ts` (no symlink check) vs `utils/paths.ts` (symlink-aware). |
| Q4 | `security/audit.ts` writes to `os.homedir()/.bp`, ignoring `BP_HOME` (inconsistent with `trust.ts`); HMAC warning fires on every command invocation. |
| Q5 | CI `docs-health` job references `agents.md`; the file is `AGENTS.md` — no match on case-sensitive Linux runners. |
| Q6 | `tests/fixtures/drift-repo/.bp-fingerprint.json` exists locally but is gitignored (verified not load-bearing — tests pass without it). Confusing state; delete or un-ignore. |
| Q7 | `security/scan.ts:456` uses a synchronous fs walk inside an async API; also excluded from the project's own `lint:no-sync-fs` gate. |
| Q8 | Template LRU cache keyed by path only (no mtime) — stale renders during `--watch` sessions if a template is edited. |

---

## 3. Implementation Task List

Ordered by severity; each task is independently verifiable.

### Phase 1 — Release blockers

- [x] **T1. Unify exit codes** (B1, D4)
  - Choose `docs/troubleshooting.md` numbering as canonical (it matches `errors.ts`, the larger external surface).
  - Rewrite `src/constants.ts` `EXIT_CODES` to match; update `exitCodeForResult` and all `EXIT_CODES.*` call sites.
  - Update `tests/unit/properties/exit-codes.property.test.ts` and any asserting tests.
  - Sweep `docs/commands.md` per-command error-code lines for consistency.
- [x] **T2. Make fresh scaffold verify clean** (B2)
  - Fix templates so scaffolded agents reference only known tools/skills (or register `Grep`/`Bash` as built-in known tools in the semantic validator).
  - Fix `ENTRY_POINT_DRIFT` / `SKILL_STALE_PATH` / `ZERO_MATCH_SCOPE` triggers immediately post-init (fingerprint written at init must match what drift check reads).
  - Fix stray `rules-minimal.md` written at repo root — place under `.claude/rules/` (trace through `templater/risk-selector.ts` + writer merge).
  - Decide: `passed: true` must not exit non-zero by default; drift-as-exit-5 only when `--level drift` or explicit `--fail-on`. Document the choice.
  - Add e2e regression test: `init <backend>` → `verify` exits 0 for every bundled backend template.
- [x] **T3. Clean machine-readable stdout** (B3)
  - Route pino output to stderr (or silence non-error logs when `--json`/`--format sarif` active).
  - Downgrade first-run cache-miss warning to debug; drop stack trace from expected ENOENT.
  - Add e2e test: `verify --json` stdout parses as JSON; `report --sarif` file parses.
- [x] **T4. Fix Docker image** (B4)
  - Builder: `COPY templates/ ./templates/`; runner: `COPY --chown=node:node --from=builder /build/templates ./templates`.
  - Add CI step: build image, run `bp init claude` + `bp verify` inside container.

### Phase 2 — Security hardening

- [x] **T5. Traversal guard in mock install extraction** (S1) — route every entry through `safeOutputPath(relPath, targetDir)` in `client.ts install()`; add unit test with `../../evil` key.
- [x] **T6. Fail-closed signature policy** (S2) — when `require_signature: true` (default) and no key resolvable, abort install with `SIGNATURE_FAILED`; allow explicit opt-out flag/config only.
- [x] **T7. Harden hook validator or soften claim** (S3) — extend patterns to ESM imports, `node:` prefixes, dynamic `import()`, bracket-access on `globalThis`/`process`; document residual limits as advisory static analysis in `docs/commands.md`.
- [x] **T8. `fileURLToPath` in client.ts** (S4) — replace `new URL(import.meta.url).pathname`; mirror the pattern already used in `templater/selector.ts`.

### Phase 3 — Docs/feature parity

- [x] **T9. Wire `--entropy-scan` end-to-end** (D1) — thread flag + `.bp.json` `scan.entropyEnabled` through `runValidator` into `scanForSecrets` call sites; integration test proving a high-entropy string is flagged via `bp verify --entropy-scan` and via config.
- [x] **T10. Document `bp health`** (D2) — add to `docs/commands.md` table + section with options and exit codes.
- [x] **T11. Complete `bp init` docs** (D3) — add `--tools`, `--interactive`, `--json`; reference full backend list (link `docs/supported-tools.md`).

### Phase 4 — Hygiene

- [x] **T12. Fix biome warnings** (Q1) — apply both fixes in `client.ts`.
- [x] **T13. Single version source** (Q2) — read version from `package.json` (import attribute or build-time injection) in `src/cli/index.ts`.
- [x] **T14. Consolidate duplicates** (Q3) — one `deepFreeze` (export from `security/sandbox.ts`); deprecate `safeOutputPath` in favor of symlink-aware `resolveAndValidatePath`, or merge the symlink check into it.
- [x] **T15. Audit log respects `BP_HOME`** (Q4) — reuse `bpHome()` from `trust.ts`; rate-limit/once-per-process HMAC warning.
- [x] **T16. CI casing fix** (Q5) — `agents.md` → `AGENTS.md` in `ci.yml` (markdownlint + lychee args).
- [x] **T17. Fixture cleanup** (Q6) — remove gitignored `tests/fixtures/drift-repo/.bp-fingerprint.json` or add a negated gitignore rule and track it.
- [x] **T18. Async fs walk in scanner** (Q7) — convert `collectTextFilesSync` to `fs/promises`; add `security/scan.ts` to the `lint:no-sync-fs` file list.
- [x] **T19. Template cache mtime invalidation** (Q8) — include file mtime in cache key or stat-validate on hit (matters for `--watch`).

### Release gate (after all phases)

- [x] `npm run ci` green (typecheck, lint, custom lints, coverage thresholds).
- [x] Smoke sequence green in clean dir: `bp init claude` → `bp verify` (exit 0) → `bp verify --json | jq .` (parses).
- [x] Docker image smoke: containerized `init` + `verify`.
- [x] Docs/exit-code parity re-checked (`docs/troubleshooting.md` table vs `constants.ts` vs `errors.ts`).

---

## 4. What Is Already World-Class (keep as-is)

- Test depth: fuzz (`tests/fuzz/`), property-based (fast-check), e2e, backend round-trip tests.
- CI rigor: Node 20/22 matrix, Bun compat, CodeQL, `npm audit`, SARIF upload, SBOM, enforced coverage thresholds (75/80/65/75).
- Error taxonomy: every `BpError` carries code, exit code, and human resolution string.
- Supply-chain design: signed pack artifacts, trust keyring, in-memory hostile-input-first tar handling.
- 31-backend adapter architecture with shared base adapters and fidelity tracking.
