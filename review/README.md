# Review — Staged Optimization Plan

Source: `PROMPT.md`. Each stage lives in its own directory with `spec.md` + `tasks.md` written
upfront (drafts for stages 2–10, revised with prior-stage findings before execution) and
`gaps.md` written at stage completion. Implementation is sequential, one stage at a time, with
explicit approval before each stage; `npm run ci` must pass at every stage exit.

| Stage | Directory | Focus | Status |
|---|---|---|---|
| 1 | `stage-01/` | Architecture & dependency audit (read-only baseline) | Spec ready — awaiting approval |
| 2 | `stage-02/` | SOLID refactoring of Detector/Templater/Validator/Translator | Draft |
| 3 | `stage-03/` | Error handling & observability hardening | Draft |
| 4 | `stage-04/` | Testing strategy & coverage hardening (85/85/75/85) | Draft |
| 5 | `stage-05/` | Security & supply chain hardening | Draft |
| 6 | `stage-06/` | API surface & plugin system polish | Draft |
| 7 | `stage-07/` | Performance & resource optimization | Draft |
| 8 | `stage-08/` | AI agent skills ecosystem (`.bp/skills/`) | Draft |
| 9 | `stage-09/` | Documentation revamp | Draft |
| 10 | `stage-10/` | Final integration, gap closure, release readiness, `FINAL_REPORT.md` | Draft |

Invariants across all stages: exit codes 0–10, schema versions (Fingerprint "1.0", BlueprintIR
"2.0", bp-pack/1, bp-pack-lock/1, bp-artifact/1, bp-report/1), `@agentic/bp/plugin` export, no
new runtime deps without spec justification, honest output / fail loud / static-analysis-only /
idempotency.
