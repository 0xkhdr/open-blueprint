# Stage 4 — Plugin API v1: Real Contract, Fixed Loader, Honest Sandbox

Closes **GAP-4** (`roadmap/00-analysis.md`): `docs/plugin-api.md` documents
`definePlugin`/`ValidationContext` from `@agentic/bp/plugin`, but `src/plugin/` is empty;
the actual loader gives plugins no data to validate; the vm timeout is broken; and the
"sandbox" is not a security boundary. Plugins are the escape hatch for client governance
checks the Stage 1 DSL cannot express — they must actually work, and their safety story
must be truthful.

**Depends on Stage 1** (plugins run as an enforcement-adjacent layer and receive the
parsed IR + check context).

## Goals

1. Ship the documented public API: `@agentic/bp/plugin` subpath export with
   `definePlugin` and `ValidationContext` matching (a corrected version of) the docs.
2. Loader passes plugins real context: parsed `BlueprintIR`, rule/skill file inventory
   with frontmatter + line map, Fingerprint, and bounded read access to blueprint files.
3. Fix the timeout (`vm` sync execution) and process-isolate untrusted plugins.
4. Honest trust model: local project plugins are "trusted code, resource-limited";
   docs stop implying vm is a security sandbox.

## Non-goals

- Plugin marketplace/distribution (Stage 5 covers signed plugin packages).
- Lifecycle hooks beyond validation (templater/translator hooks: future).

## Design

### 1. Public API (`src/plugin/index.ts`, new; package.json `exports["./plugin"]`)

```ts
export interface PluginValidator {
  id: string;                                  // irIdentifier
  level: "structural" | "semantic" | "logical" | "enforcement";
  check: (ctx: ValidationContext) => void | Promise<void>;
}
export interface BpPlugin {
  name: string; version: string;               // semver
  validators: PluginValidator[];
}
export function definePlugin(p: BpPlugin): BpPlugin;  // runtime Zod parse, fail-loud

export interface ValidationContext {
  readonly blueprint: BlueprintIR;             // deep-frozen
  readonly fingerprint?: Fingerprint;          // deep-frozen
  readonly files: ReadonlyArray<BlueprintFileInfo>;
    // { path, layer: "anchor"|"agents"|"rules"|"skills"|"hooks", frontmatter, body, lineOf(field) }
  error(file: string, line: number | undefined, message: string, resolution: string): void;
  warn(file: string, line: number | undefined, message: string, resolution?: string): void;
  info(file: string, message: string): void;
}
```

Errors surface as `ValidationError` with `type: "PLUGIN_<plugin-name>_<validator-id>"`
(upper-snake), merged into the normal result at the validator level the plugin declared.

### 2. Plugin discovery & config

`.bp.json` project config (`src/config/project.ts`) gains:

```jsonc
"plugins": [
  { "path": "./plugins/acme-checks.mjs", "mode": "isolated" }  // mode: "isolated" (default) | "inline"
]
```

Zod-schema the entry. Paths must resolve inside the project root (reject `..` escapes
and absolute paths outside root — `PLUGIN_PATH_ESCAPE` error).

### 3. Execution engines (`src/plugins/`)

Replace the vm approach with two modes:

**`isolated` (default)** — `node:worker_threads` host (`src/plugins/worker-host.ts` +
`src/plugins/worker-entry.ts`):
- Worker receives structured-clone payload: blueprint IR, fingerprint, file inventory
  (already read by the host — the worker gets data, not fs access).
- Worker `import()`s the plugin module (ESM; `.mjs`/`.js`; TS not supported in v1 —
  document "compile your plugin first"), calls `definePlugin` export, runs validators,
  posts diagnostics back.
- Real timeout: `worker.terminate()` after `BP_PLUGIN_TIMEOUT_MS` (default 10_000) ⇒
  `PluginTimeoutError`. Memory cap via `resourceLimits: { maxOldGenerationSizeMb: 256 }`.
- Worker has Node's full capabilities (workers are NOT a security sandbox either) —
  but it cannot corrupt validator state, and runaway plugins are killable. State this
  plainly in docs.

**`inline`** — direct `import()` in-process for trusted/first-party plugins (fast path,
used by tests). Same API.

Delete `src/plugins/sandbox.ts` and the vm path in `loader.ts`; keep
`loadPlugins(paths)` signature shape but route through the new engine. Keep
`PluginLoadError`/`PluginTimeoutError` from `src/errors.ts`.

### 4. Validator integration (`src/validator/index.ts`)

Current integration loads plugins detached from any data. Rework: after IR parse and
file collection for the requested level, group plugin validators by `level` and run
them when that level runs; merge diagnostics. Plugin crash ⇒ single
`PLUGIN_CRASHED` error for that plugin (message + stack head, resolution "fix or
remove plugin '<name>' from .bp.json"), other plugins unaffected. `--no-plugins`
flag on `bp verify` to bypass.

### 5. DX

- `bp dev plugin:scaffold <name>` (extend `src/cli/commands/dev.ts`): emits a working
  `.mjs` plugin using `definePlugin`, with one example validator (require rationale on
  hard rules — the docs' own example, finally runnable).
- `bp dev plugin:test <path>` — run a plugin against the current repo, print
  diagnostics, exit code reflects errors.

### 6. Docs (rewrite `docs/plugin-api.md`)

- Corrected import (`@agentic/bp/plugin`), real `ValidationContext` shape, isolated vs
  inline modes, timeout/memory limits.
- **Security section (write plainly):** plugins execute with your user's privileges;
  isolation limits runtime/memory and protects validator state, it is not a security
  boundary; only run plugins you trust; Stage 5 adds signature verification for
  third-party distribution.

## Acceptance criteria

1. The docs' example plugin (rationale-on-hard-rules), scaffolded via
   `bp dev plugin:scaffold`, runs in `bp verify` and flags a hard rule lacking
   `rationale` with file+line.
2. A plugin with `while(true){}` is terminated at the timeout with
   `PluginTimeoutError`; other plugins still report; `bp verify` completes.
3. A plugin throwing synchronously yields one `PLUGIN_CRASHED` error, not a CLI crash.
4. `import "@agentic/bp/plugin"` type-checks for consumers (exports map + d.ts emitted).
5. `.bp.json` plugin path outside project root ⇒ `PLUGIN_PATH_ESCAPE` error.
6. `src/plugins/sandbox.ts` vm context removed; docs contain no sandbox-security claim.
7. `npm run ci` green.

## Test plan

- Unit: definePlugin runtime validation, config schema, path-escape guard,
  diagnostic type naming, deep-freeze of context payload.
- Integration: worker host with fixture plugins — happy path, timeout kill, OOM-ish
  (allocation loop) kill, crash isolation, inline mode parity (same fixture, same
  diagnostics both modes).
- E2E: verify command on fixture repo with `.bp.json` plugins entry.
