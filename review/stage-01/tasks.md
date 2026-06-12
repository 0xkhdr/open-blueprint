# Tasks — Stage 1: Architecture & Dependency Audit

Companion to `review/stage-01/spec.md`. Check off in order. Audit-only stage: tasks write to
`review/` only, except T1.3 if the madge config itself is broken.

## 1. Circular dependencies

- [ ] **T1.1** Re-run `npx madge --circular --ts-config tsconfig.json src/` and capture full
      output. Investigate why it reported "Processed 0 files".
- [ ] **T1.2** If madge is not scanning (likely needs `--extensions ts` or entry-file mode),
      determine the correct invocation that processes all 201 `src/` files.
- [ ] **T1.3** If `check:circular` in `package.json` is vacuous, fix the script (single-line
      change, safe) and re-run. Record real cycle count in `review/stage-01/baseline-metrics.md`.
- [ ] **T1.4** For each real cycle found: document members, severity, and proposed resolution
      (interface extraction vs. dependency inversion) in spec addendum.

## 2. Module cohesion & dependency direction

- [ ] **T2.1** Generate import edges: for each `src/<module>`, list which other `src/` modules it
      imports (grep `from '../` / path analysis or madge JSON output).
- [ ] **T2.2** Classify every edge against the L0–L4 layering model in the spec. Flag upward
      edges (e.g., engine → cli, foundation → engine).
- [ ] **T2.3** Write dependency graph as a table + mermaid diagram in
      `review/stage-01/dependency-graph.md`.
- [ ] **T2.4** SRP review: for each of the 27 modules, one paragraph — responsibility, whether it
      holds, violations observed (e.g., `validator/index.ts` doing orchestration + evaluation).

## 3. Export surface

- [ ] **T3.1** For each `src/*/index.ts`, list exports; cross-reference actual external usage
      (imports from outside the module).
- [ ] **T3.2** Flag exports with zero external consumers as internal-helper leaks. Record list;
      removal happens in Stage 2 unless trivially safe and test-covered.

## 4. Test coverage gaps

- [ ] **T4.1** Run `npm run test:coverage`; persist summary to `review/stage-01/baseline-metrics.md`
      (global lines/functions/branches/statements).
- [ ] **T4.2** From coverage JSON, list every `src/` file with branch coverage <65%.
- [ ] **T4.3** Prioritize: hot-path files (detector, validator, templater, registry, security,
      lsp — the `lint:no-sync-fs` list) first, then `errors.ts`, then the rest. Output is the
      Stage 4 test backlog.

## 5. Speculative code audit

- [ ] **T5.1** For `dx/`, `ecosystem/`, `enterprise/`, `multiagent/`, `blueprint-sync/`,
      `rule-library/`: trace every entry point from `src/cli/commands/*` to determine whether the
      module does real work or is stub/aspirational.
- [ ] **T5.2** Special case `rule-library/` (0 static imports found from core/cli): full-repo
      grep including dynamic imports and tests; verdict = used / dead / test-only.
- [ ] **T5.3** Verdict table per module: keep / consolidate / propose-removal (removal itself is
      a later-stage task with its own approval).

## 6. Documentation drift

- [ ] **T6.1** Diff `docs/commands.md` against `src/cli/commands/` file list and registered
      commands; flag undocumented commands and documented-but-missing commands.
- [ ] **T6.2** Verify `docs/troubleshooting.md` `{#code-N}` anchors cover every `EXIT_CODES`
      entry in `src/constants.ts` and every `BpError` subclass code.
- [ ] **T6.3** Verify schema versions in `docs/data-models.md` match code (Fingerprint "1.0",
      BlueprintIR "2.0", bp-pack/1, bp-pack-lock/1, bp-artifact/1, bp-report/1).
- [ ] **T6.4** Check `AGENTS.md`/`CLAUDE.md` module lists against actual 27 `src/` dirs.

## 7. Baseline metrics (for Stage 10 before/after)

- [ ] **T7.1** Record in `review/stage-01/baseline-metrics.md`: src LOC, test LOC, coverage numbers,
      circular-dep count, `dist/` size, CLI cold-start (`time node dist/cli/index.js --version`,
      median of 5).

## 8. Wrap-up

- [ ] **T8.1** Write `review/stage-01/gaps.md` answering the five PROMPT.md gap questions,
      including explicit hand-off notes for Stage 2.
- [ ] **T8.2** Run `npm run ci`; record pass/fail. If fail pre-exists, document — do not batch
      unrelated fixes into Stage 1.
