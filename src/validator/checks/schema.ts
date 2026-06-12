import { z } from "zod";

// ---------------------------------------------------------------------------
// Check schema — declarative, machine-evaluable rule conditions (Stage 1).
// Every check is a pure read of the filesystem or the Fingerprint: no network,
// no shell, no arbitrary code. Kept dependency-free of translator/ir.ts to
// avoid a circular import (ir.ts imports CheckSchema from this module).
// ---------------------------------------------------------------------------

export const MAX_CHECK_DEPTH = 3;
export const MAX_CHECK_CHILDREN = 16;
export const MAX_REGEX_LENGTH = 256;

// Same constraints as irGlobField in src/translator/ir.ts (duplicated to keep
// the import graph acyclic).
const globField = z
  .string()
  .min(1)
  .max(256)
  .refine((s) => !/\*{4,}/.test(s), {
    message: "Glob pattern must not contain 4 or more consecutive '*' characters",
  });

/**
 * Star-height guard: rejects patterns where a quantifier is applied to a
 * group whose body itself contains an unbounded quantifier, e.g. `(a+)+` or
 * `(a*)*`. These are the classic catastrophic-backtracking shapes. This is a
 * heuristic, not a full ReDoS analysis — it intentionally over-rejects.
 */
export function hasNestedQuantifier(pattern: string): boolean {
  // A group `( ... * or + or {n,} ... )` immediately followed by a quantifier.
  return /\([^)]*(?:[*+]|\{\d+,\d*\})[^)]*\)\s*(?:[*+]|\{\d+,\d*\})/.test(pattern);
}

const regexField = z
  .string()
  .min(1)
  .max(MAX_REGEX_LENGTH)
  .superRefine((pattern, ctx) => {
    if (hasNestedQuantifier(pattern)) {
      ctx.addIssue({
        code: "custom",
        message:
          "Regex rejected by star-height guard: quantified group containing a quantifier (e.g. '(a+)+') risks catastrophic backtracking",
      });
      return;
    }
    try {
      // Validation only; execution happens in the evaluator under caps.
      new RegExp(pattern);
    } catch (err) {
      ctx.addIssue({
        code: "custom",
        message: `Invalid regular expression: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  });

const literalValue = z.union([z.string().max(512), z.number(), z.boolean()]);

const dottedPath = z
  .string()
  .min(1)
  .max(256)
  .regex(/^[a-zA-Z0-9_$-]+(\.[a-zA-Z0-9_$-]+)*$/, {
    message: "Must be a dotted path of identifier segments, e.g. 'security_signals.has_docker'",
  });

const expectExists = z.strictObject({ exists: z.literal(true) });
const expectEquals = z.strictObject({ equals: literalValue });
const expectOneOf = z.strictObject({ oneOf: z.array(literalValue).min(1).max(32) });
const expectTruthy = z.strictObject({ truthy: z.literal(true) });

// ---------------------------------------------------------------------------
// Check type (declared by hand: z.lazy recursion needs an explicit type)
// ---------------------------------------------------------------------------

export type CheckExpectation =
  | { exists: true }
  | { equals: string | number | boolean }
  | { oneOf: (string | number | boolean)[] }
  | { truthy: true };

export type Check =
  | { type: "file-exists"; glob: string }
  | { type: "file-absent"; glob: string }
  | {
      type: "content-match";
      glob: string;
      pattern: string;
      flags?: "i" | undefined;
      minMatches?: number | undefined;
      scope?: "any" | "every" | undefined;
    }
  | { type: "content-absent"; glob: string; pattern: string; flags?: "i" | undefined }
  | {
      type: "frontmatter-field";
      glob: string;
      field: string;
      expect:
        | { exists: true }
        | { equals: string | number | boolean }
        | { oneOf: (string | number | boolean)[] };
    }
  | { type: "dependency-present"; name: string; range?: string | undefined }
  | { type: "dependency-absent"; name: string }
  | {
      type: "fingerprint";
      path: string;
      expect: { equals: string | number | boolean } | { truthy: true };
    }
  | {
      type: "json-key";
      file: string;
      path: string;
      expect: { exists: true } | { equals: string | number | boolean };
    }
  | { type: "allOf"; checks: Check[] }
  | { type: "anyOf"; checks: Check[] }
  | { type: "not"; check: Check };

const CheckNodeSchema: z.ZodType<Check> = z.lazy(() =>
  z.discriminatedUnion("type", [
    z.strictObject({ type: z.literal("file-exists"), glob: globField }),
    z.strictObject({ type: z.literal("file-absent"), glob: globField }),
    z.strictObject({
      type: z.literal("content-match"),
      glob: globField,
      pattern: regexField,
      flags: z.literal("i").optional(),
      minMatches: z.number().int().min(1).max(1000).optional(),
      scope: z.enum(["any", "every"]).optional(),
    }),
    z.strictObject({
      type: z.literal("content-absent"),
      glob: globField,
      pattern: regexField,
      flags: z.literal("i").optional(),
    }),
    z.strictObject({
      type: z.literal("frontmatter-field"),
      glob: globField,
      field: z.string().min(1).max(128),
      expect: z.union([expectExists, expectEquals, expectOneOf]),
    }),
    z.strictObject({
      type: z.literal("dependency-present"),
      name: z.string().min(1).max(214),
      range: z.string().min(1).max(100).optional(),
    }),
    z.strictObject({
      type: z.literal("dependency-absent"),
      name: z.string().min(1).max(214),
    }),
    z.strictObject({
      type: z.literal("fingerprint"),
      path: dottedPath,
      expect: z.union([expectEquals, expectTruthy]),
    }),
    z.strictObject({
      type: z.literal("json-key"),
      file: z.string().min(1).max(256),
      path: dottedPath,
      expect: z.union([expectExists, expectEquals]),
    }),
    z.strictObject({
      type: z.literal("allOf"),
      checks: z.array(CheckNodeSchema).min(1).max(MAX_CHECK_CHILDREN),
    }),
    z.strictObject({
      type: z.literal("anyOf"),
      checks: z.array(CheckNodeSchema).min(1).max(MAX_CHECK_CHILDREN),
    }),
    z.strictObject({ type: z.literal("not"), check: CheckNodeSchema }),
  ])
);

/** Leaf = 1; composite = 1 + max depth of children. */
export function checkDepth(check: Check): number {
  switch (check.type) {
    case "allOf":
    case "anyOf":
      return 1 + Math.max(...check.checks.map(checkDepth));
    case "not":
      return 1 + checkDepth(check.check);
    default:
      return 1;
  }
}

export const CheckSchema: z.ZodType<Check> = CheckNodeSchema.superRefine((check, ctx) => {
  const depth = checkDepth(check);
  if (depth > MAX_CHECK_DEPTH) {
    ctx.addIssue({
      code: "custom",
      message: `Check tree depth ${depth} exceeds maximum ${MAX_CHECK_DEPTH}`,
    });
  }
});
