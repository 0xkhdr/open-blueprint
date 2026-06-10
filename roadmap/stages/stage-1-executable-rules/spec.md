# Stage 1 — Executable Rule Conditions (Enforcement Engine)

> **Status: ✅ COMPLETED** (2026-06-11)

Closes **GAP-1** (`roadmap/00-analysis.md`): rule `action` strings are prose that nothing
evaluates, so `bp verify` cannot actually enforce governance. This stage adds a
declarative, machine-evaluable `check` to rules and an enforcement layer in the validator.

## Goals

1. Rules can declare a structured `check` that bp evaluates against the repository.
2. `bp verify` gains an `enforcement` validation level: hard-severity failing checks are
   errors (fail the build), soft-severity failing checks are warnings.
3. `bp rule test <file>` evaluates the check against the real repo, not just the scope glob.
4. Rules without a `check` are honestly reported as `manual` (info-level), never silently
   counted as passing.
5. Built-in compliance packs updated: each rule either gets an expressible `check` or is
   explicitly marked `enforcement: manual`.

## Non-goals

- Arbitrary code execution in rules (that is Stage 4 plugins).
- Network or build-tool invocation during checks (preserves the Detector's zero-network,
  zero-shell guarantee — checks are static filesystem + fingerprint reads only).
- Custom pack distribution (Stage 2/5).

## Design

### 1. Check schema (`src/validator/checks/schema.ts`, new)

Zod discriminated union. All regexes bounded (max 256 chars, reject patterns with
nested quantifier blowup via a simple star-height guard); all globs reuse the existing
`irGlobField` constraints from `src/translator/ir.ts`.

```ts
// Leaf checks — every one is a pure read of the filesystem or the Fingerprint.
type Check =
  | { type: "file-exists";  glob: string }                       // ≥1 match required
  | { type: "file-absent";  glob: string }                       // 0 matches required
  | { type: "content-match";  glob: string; pattern: string; flags?: "i" }
      // every file matching glob must contain ≥1 regex match
      // optional: minMatches?: number; scope?: "any" | "every" (default "every")
  | { type: "content-absent"; glob: string; pattern: string; flags?: "i" }
      // no file matching glob may contain the regex
  | { type: "frontmatter-field"; glob: string; field: string;
      expect: { exists: true } | { equals: string | number | boolean } | { oneOf: (string|number|boolean)[] } }
  | { type: "dependency-present"; name: string; range?: string } // from Fingerprint manifests
  | { type: "dependency-absent";  name: string }
  | { type: "fingerprint"; path: string;                          // dotted path, e.g. "security_signals.has_docker"
      expect: { equals: string | number | boolean } | { truthy: true } }
  | { type: "json-key"; file: string; path: string;               // dotted path into a JSON file
      expect: { exists: true } | { equals: string | number | boolean } }
  // Composites
  | { type: "allOf"; checks: Check[] }   // max depth 3, max 16 children
  | { type: "anyOf"; checks: Check[] }
  | { type: "not";   check: Check };
```

Export `CheckSchema` (z.lazy for recursion) and `type Check = z.infer<...>`.

### 2. IR extension (`src/translator/ir.ts`)

Add to `RuleSchema`:

```ts
check: CheckSchema.optional(),
enforcement: z.enum(["auto", "manual"]).optional(), // default: "auto" if check present, else "manual"
```

Backward compatible: existing rules (no `check`) parse unchanged. Frontmatter in rule
markdown files carries `check` as a YAML mapping (gray-matter already parses YAML).

### 3. Evaluator (`src/validator/checks/evaluate.ts`, new)

```ts
export interface CheckOutcome {
  passed: boolean;
  detail: string;            // human explanation, e.g. "0 files matched glob 'src/**/audit*.ts'"
  evidence?: { file: string; line?: number }[]; // up to 10 entries
}
export async function evaluateCheck(check: Check, ctx: CheckContext): Promise<CheckOutcome>;

export interface CheckContext {
  projectRoot: string;
  fingerprint?: Fingerprint;       // dependency-* and fingerprint checks error with
                                   // resolution "run bp verify with detection" when absent
  fileBudget: ResourceBudget;      // shares MAX_VALIDATION_FILES / MAX_VALIDATION_BYTES caps
}
```

Implementation constraints:
- `fast-glob` with `ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"]`, `dot: true`.
- Regex execution per file capped (skip files > 1 MiB with a warning outcome detail).
- Async fs only (`node:fs/promises`) — this module must be added to the `lint:no-sync-fs` list.
- All errors wrapped: a malformed check never throws past the evaluator; it returns
  `passed: false` with a `CHECK_INVALID` detail.
- Instrument with `startSpan("validator.enforcement", ...)` like other layers.

`dependency-present/absent`: resolve from the Fingerprint's tooling/manifest data; if the
Fingerprint does not carry a dependency list, read `package.json` /`go.mod`/`pyproject.toml`/
`Cargo.toml` directly (static parse only). Implement at minimum the package.json path plus
graceful `manual` downgrade (info: "dependency check unsupported for this ecosystem yet").

### 4. Enforcement layer (`src/validator/enforcement.ts`, new)

```ts
export async function validateEnforcement(
  projectRoot: string,
  manifest: BackendManifest,
  fingerprint?: Fingerprint
): Promise<ValidationError[]>;
```

Behavior:
1. Collect rule files via `manifest.file_patterns.rules` (same mechanism as
   `collectBlueprintFiles` in `src/validator/index.ts`).
2. Parse frontmatter (gray-matter); Zod-parse `check` when present. Invalid check ⇒
   `severity: "error"`, `type: "RULE_CHECK_INVALID"`, resolution quoting the Zod issue.
3. No check ⇒ `severity: "info"`, `type: "RULE_MANUAL"`, message
   `Rule '<id>' is not machine-enforceable (no check); verify manually`.
4. Check fails ⇒ error type `RULE_VIOLATION`, severity `error` for `severity: hard`
   rules, `warning` for `soft`. Message includes rule id, action text, and
   `CheckOutcome.detail`; `resolution` from the rule's `rationale` when present.
5. Line numbers: point at the `check:` (or `severity:`) frontmatter line for the rule file.

### 5. Validator integration (`src/validator/index.ts`)

- Extend `ValidationLevel` union with `"enforcement"`; run it in `"all"` after `logical`,
  before `drift`. Wire `--level enforcement` and `--fail-on` plumbing in
  `src/cli/commands/verify.ts` (follow how existing levels are threaded).
- Result summary gains counts: `enforced`, `violations`, `manual`.

### 6. `bp rule test` upgrade (`src/cli/commands/rule.ts`)

After printing scope matches (existing behavior), when the rule has a `check`:
evaluate via `evaluateCheck` against `process.cwd()` and print PASS/FAIL with
`detail` and up to 10 evidence locations. Exit code: 0 pass, `EXIT_CODES` validation
failure for hard-rule failure, 0-with-warning for soft. No check ⇒ print
`manual — bp cannot evaluate this rule automatically`.

Also `bp rule lint` must Zod-validate `check` frontmatter when present.

### 7. Built-in pack updates (`src/rule-library/packs.ts`)

For each rule in GDPR/SOC2/HIPAA/PCI/ISO packs: add a `check` where one is honestly
expressible from static repo state (examples: `gdpr-encryption` ⇒ `content-absent`
for `http://` URLs in src plus `dependency-present` for TLS config is NOT expressible —
prefer `enforcement: "manual"` over a fake check). Expected realistic outcome: most
compliance rules become explicit `enforcement: "manual"`; add at least 3 genuinely
checkable rules per pack where possible (e.g. `soc2-logging` ⇒ logging dependency
present; `gdpr-audit-log` ⇒ content-match for audit logger init). Update each pack's
`metadata.coverage` to mean "% of rules with auto enforcement" and recompute honestly.

### 8. Docs

- `docs/data-models.md`: Check schema reference with one example per check type.
- `docs/commands.md`: updated `verify --level enforcement`, `rule test` semantics.
- `docs/philosophy.md` pillar 3: note enforcement is static-analysis-based; what
  `manual` means.
- `docs/glossary.md`: add Check, Enforcement, Manual rule, Violation.

## Acceptance criteria

1. A repo with rule `{severity: hard, check: {type: "file-exists", glob: "SECURITY.md"}}`
   and no SECURITY.md: `bp verify --level enforcement` exits non-zero with
   `RULE_VIOLATION`, file+line of the rule, actionable resolution. Adding SECURITY.md
   makes it pass. Soft severity ⇒ exit 0 with warning.
2. Rule without check ⇒ `RULE_MANUAL` info, never affects exit code.
3. Malformed check YAML ⇒ `RULE_CHECK_INVALID` error quoting the Zod issue path.
4. `bp rule test` prints PASS/FAIL + evidence for checkable rules.
5. `npm run ci` green; no sync fs in new validator files; coverage holds.

## Test plan

- Unit (`tests/validator/checks/`): one suite per check type incl. composites, depth
  limit, glob-overrun rejection, >1 MiB file skip, missing-fingerprint degradation.
- Property (fast-check): random check trees ≤ depth 3 never throw from `evaluateCheck`.
- Integration: fixture repo under `tests/fixtures/enforcement/` with passing, failing,
  manual, and malformed rules; assert full `validateEnforcement` output and exit codes
  through the verify command (mirror existing e2e patterns in `tests/`).
