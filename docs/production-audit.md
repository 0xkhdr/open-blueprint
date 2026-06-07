# Production-Grade Audit — Removing Misguided Features

This document records a production-readiness audit of `bp` focused on a single
question: **does every advertised feature deliver real value, or are some of
them smoke-and-mirrors that mislead users?** It also records the remediations
applied.

The guiding principle: a tool that governs other people's repositories must
itself be honest. Features that return fabricated data, call endpoints that do
not exist, or are documented but unimplemented erode trust in *all* of the
tool's output — including the parts that genuinely work.

---

## What is genuinely solid (kept and, where needed, hardened)

These deliver real value and were verified against their implementations:

- **Detector** — language/framework/security detection parses real lockfiles and
  manifests (`package.json`, `go.mod`, `Cargo.toml`, `requirements.txt`, …).
- **Validator** — the 4 layers (structural, semantic, logical, drift) are real:
  frontmatter/encoding/size checks, glob scope resolution, antonym + Tarjan SCC
  contradiction/cycle detection, and fingerprint-delta drift.
- **Translator** — the backend-neutral IR and the core adapters
  (`claude`, `cursor`, `codex`, `generic`) round-trip at ≥95% fidelity, verified
  by `tests/integration/backends/round-trip.test.ts`.
- **Governance** — memory governance, MCP risk scoring, chain DAG validation,
  team validation, compliance gap reports, and `.env.template` generation all
  perform real filesystem/IR work.
- **Ownership** — `adopt` / `emit` / the `.bp/manifest.json` ownership model.

---

## Misguided features found, and what was done

| Area | Problem (evidence) | Remediation |
|------|--------------------|-------------|
| **Marketplace ratings** | `rateTemplate` / `getTemplateRatings` POSTed to `marketplace.agentic.dev`, a host that does not exist; failures were swallowed silently. | Removed the dead-endpoint functions and the `rate` / `ratings` subcommands. Kept the **real** npm-backed `search`, which now **surfaces** network errors instead of returning a misleading empty result. |
| **Misleading "verified" badge** | Search marked any `@bp-templates/*` package as `verified` with a green check, implying an audit that never happened. | Renamed to `official` (an honest namespace check) and relabeled the CLI output `official scope` / `community`. Dropped the always-`0` `rating` field. |
| **Fake registry catalog** | `RegistryClient.list()` returned hardcoded `@bp-templates/{fastapi,django,go-std,rust-axum}` packages that are not published anywhere; `install` would fail for them. | `list()` now enumerates the **real** template packs bundled on disk (the same ones `install` can copy). |
| **Synthetic drift demo** | `bp drift semantic` always ran on hardcoded synthetic numbers, ignoring input — a number generator dressed up as analysis. | Removed the synthetic generators. `drift baseline` now **requires** a real NDJSON metrics file; added `drift behavioral --baseline --current` operating on real files. `drift semantic` kept as a hidden, deprecated alias that warns. |
| **Dead code (4 modules)** | `observability/anomaly.ts`, `observability/alerts.ts`, `detector/cost-scorer.ts`, `detector/metrics-baseline.ts` were exported but had **no callers** (only their own tests). `metrics-baseline` emitted synthetic metrics (`execution_count: 0`); `cost-scorer` multiplied arbitrary constants into dollar figures. | Deleted all four modules and their orphaned tests. (Genuine anomaly/alerting logic lives in `validator/alerting.ts` and stays.) |
| **Fabricated cost numbers** | `bp cost budget` injected `cost_per_token_usd: 0.00001` and `estimated_monthly_tokens: 1_000_000` out of thin air, which fed an authoritative-looking "estimated spend". | Stopped fabricating usage. Setting a budget records only the budget; spend projection requires values you wire from your provider's billing. |
| **Documented-but-nonexistent commands** | `docs/observability.md` documented `bp generate-dashboard/monitors/alerts` and `bp verify --drift semantic` — none exist. `docs/api/detector.md` imported the deleted `cost-scorer` and a `scoreRisk()` that never existed. | Rewrote both docs to reference only real commands (`bp telemetry …`, `bp cost …`, `bp drift behavioral`) and the real detector API (`detect` + `enrichFingerprint`). |
| **Overstated metrics** | README badge claimed "Coverage 95%" (enforced floor is 75%); docs claimed round-trip "fidelity above 98%" (tests assert ≥95%). | Badge now reads "≥75% CI-enforced"; fidelity claims aligned to the ≥95% the tests actually verify. |

---

## Production-grade defects fixed

- **`npm ci` failed on a clean machine** — `madge` (dev-only) declares
  `peerOptional typescript@^5.4.4` and has not updated for TypeScript 6, so
  ERESOLVE aborted install. Added a committed `.npmrc` (`legacy-peer-deps=true`)
  and regenerated the lockfile; `npm ci` is now reproducible.
- **`npm run lint` failed** (Biome) — formatting drift plus an
  assign-in-expression in `security/scan.ts` (rewritten with `matchAll`). Lint is
  now green.

---

## Remaining honest limitations (documented, not hidden)

- **Template registry is local/in-session.** `bp template publish` signs with
  real RSA crypto but stores packages in an in-process map; there is no remote
  registry service. `install`/`list` work against bundled local packs. This is a
  real boundary, not a bug — surface it to users rather than implying a live
  registry.
- **Cost is configuration-driven.** `bp` does not meter live token usage; the
  dashboard reflects the values you configure. Wire them from provider telemetry
  for accuracy.
- **Stub backend adapters.** ~21 of 31 backends inherit the markdown base
  adapter without backend-specific round-trip tests. They are functional but
  unverified for fidelity; only the core adapters carry a fidelity guarantee.
