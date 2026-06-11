/**
 * Public plugin API — `@agentic/bp/plugin` subpath export (Stage 4).
 *
 * Client plugins default-export `definePlugin({...})`. Validators receive a
 * read-only `ValidationContext` (deep-frozen blueprint IR, fingerprint, file
 * inventory) and report diagnostics through `error`/`warn`/`info`.
 *
 * Trust model (see docs/plugin-api.md): plugins execute with the invoking
 * user's privileges. The default `isolated` mode limits runtime and memory
 * and protects validator state — it is NOT a security boundary.
 */
import { z } from "zod";
import type { Fingerprint } from "../detector/fingerprint.js";
import type { BlueprintIR } from "../translator/ir.js";

export type { BlueprintIR, Fingerprint };

export type PluginValidatorLevel = "structural" | "semantic" | "logical" | "enforcement";

export type BlueprintFileLayer = "anchor" | "agents" | "rules" | "skills" | "hooks";

/** One blueprint file as presented to plugin validators. */
export interface BlueprintFileInfo {
  readonly path: string;
  readonly layer: BlueprintFileLayer;
  readonly frontmatter: Readonly<Record<string, unknown>>;
  readonly body: string;
  /** 1-based line of a top-level frontmatter field, if present. */
  lineOf(field: string): number | undefined;
}

export interface ValidationContext {
  readonly blueprint: BlueprintIR;
  readonly fingerprint?: Fingerprint;
  readonly files: ReadonlyArray<BlueprintFileInfo>;
  error(file: string, line: number | undefined, message: string, resolution: string): void;
  warn(file: string, line: number | undefined, message: string, resolution?: string): void;
  info(file: string, message: string): void;
}

export interface PluginValidator {
  /** Stable identifier; surfaces in diagnostic types as PLUGIN_<name>_<id>. */
  id: string;
  level: PluginValidatorLevel;
  check: (ctx: ValidationContext) => void | Promise<void>;
}

export interface BpPlugin {
  name: string;
  /** Strict semver. */
  version: string;
  validators: PluginValidator[];
}

// Mirrors irIdentifier / SEMVER_RE from src/translator/ir.ts; duplicated so the
// public subpath stays free of runtime imports beyond zod.
const IDENTIFIER_RE = /^[a-z0-9_-]+$/i;
const SEMVER_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

const PluginValidatorSchema = z.object({
  id: z.string().min(1).max(64).regex(IDENTIFIER_RE, "validator id must match [a-z0-9_-]+"),
  level: z.enum(["structural", "semantic", "logical", "enforcement"]),
  check: z.custom<PluginValidator["check"]>((value) => typeof value === "function", {
    message: "check must be a function",
  }),
});

const BpPluginSchema = z
  .object({
    name: z.string().min(1).max(64).regex(IDENTIFIER_RE, "plugin name must match [a-z0-9_-]+"),
    version: z.string().regex(SEMVER_RE, "version must be strict semver (e.g. 1.0.0)"),
    validators: z.array(PluginValidatorSchema).min(1, "plugin must declare at least one validator"),
  })
  .superRefine((plugin, ctx) => {
    const seen = new Set<string>();
    for (const validator of plugin.validators) {
      if (seen.has(validator.id)) {
        ctx.addIssue({
          code: "custom",
          message: `duplicate validator id "${validator.id}"`,
          path: ["validators"],
        });
      }
      seen.add(validator.id);
    }
  });

/**
 * Validate a plugin definition at module-load time. Fails loud: throws with a
 * readable issue list on any schema violation. Returns the original object so
 * validator `check` function identities are preserved.
 */
export function definePlugin(plugin: BpPlugin): BpPlugin {
  const parsed = BpPluginSchema.safeParse(plugin);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "plugin"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid plugin definition: ${issues}`);
  }
  return plugin;
}
