import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import type { Fingerprint } from "../../detector/fingerprint.js";
import { startSpan } from "../../telemetry/tracer.js";
import type { Check } from "./schema.js";
import { CheckSchema } from "./schema.js";

// ---------------------------------------------------------------------------
// Check evaluator — pure static reads of the filesystem and the Fingerprint.
// No network, no shell, no code execution (Detector guarantee preserved).
// ---------------------------------------------------------------------------

export const MAX_CONTENT_FILE_BYTES = 1_048_576; // skip regex over files > 1 MiB
export const MAX_EVIDENCE_ENTRIES = 10;

const GLOB_IGNORE = ["**/node_modules/**", "**/dist/**", "**/.git/**"];

export interface ResourceBudget {
  maxFiles: number;
  maxBytes: number;
}

export interface CheckEvidence {
  file: string;
  line?: number | undefined;
}

export interface CheckOutcome {
  passed: boolean;
  detail: string;
  evidence?: CheckEvidence[] | undefined;
  /** True when bp cannot evaluate this check in this repo (e.g. unsupported
   *  ecosystem); callers should downgrade to a manual/info outcome. */
  unsupported?: boolean | undefined;
}

export interface CheckContext {
  projectRoot: string;
  fingerprint?: Fingerprint | undefined;
  fileBudget: ResourceBudget;
}

export function defaultResourceBudget(): ResourceBudget {
  return {
    maxFiles: Number(process.env.BP_MAX_VALIDATION_FILES ?? 1000),
    maxBytes: Number(process.env.BP_MAX_VALIDATION_BYTES ?? 52_428_800),
  };
}

/**
 * Evaluate a check against a repository. Never throws for malformed input:
 * invalid checks resolve to `passed: false` with a `CHECK_INVALID` detail.
 */
export async function evaluateCheck(check: Check, ctx: CheckContext): Promise<CheckOutcome> {
  return startSpan("validator.enforcement", async (span) => {
    span.setAttribute("check.type", check?.type ?? "unknown");
    const parsed = CheckSchema.safeParse(check);
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      return {
        passed: false,
        detail: `CHECK_INVALID: ${issue ? `${issue.path.join(".") || "(root)"}: ${issue.message}` : "malformed check"}`,
      };
    }
    try {
      return await evaluateNode(parsed.data, ctx);
    } catch (err) {
      return {
        passed: false,
        detail: `CHECK_INVALID: evaluation error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
}

async function evaluateNode(check: Check, ctx: CheckContext): Promise<CheckOutcome> {
  switch (check.type) {
    case "file-exists":
      return evaluateFileExists(check, ctx);
    case "file-absent":
      return evaluateFileAbsent(check, ctx);
    case "content-match":
      return evaluateContentMatch(check, ctx);
    case "content-absent":
      return evaluateContentAbsent(check, ctx);
    case "frontmatter-field":
      return evaluateFrontmatterField(check, ctx);
    case "dependency-present":
      return evaluateDependency(check.name, check.range, true, ctx);
    case "dependency-absent":
      return evaluateDependency(check.name, undefined, false, ctx);
    case "fingerprint":
      return evaluateFingerprint(check, ctx);
    case "json-key":
      return evaluateJsonKey(check, ctx);
    case "allOf":
      return evaluateAllOf(check.checks, ctx);
    case "anyOf":
      return evaluateAnyOf(check.checks, ctx);
    case "not":
      return evaluateNot(check.check, ctx);
  }
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

async function globFiles(glob: string, ctx: CheckContext): Promise<string[]> {
  const files = await fg(glob, {
    cwd: ctx.projectRoot,
    onlyFiles: true,
    dot: true,
    ignore: GLOB_IGNORE,
  });
  return files.slice(0, ctx.fileBudget.maxFiles).sort();
}

interface ReadResult {
  content?: string;
  skipped?: "too-large" | "unreadable" | "budget";
}

async function readBudgeted(
  file: string,
  ctx: CheckContext,
  budget: { bytesUsed: number }
): Promise<ReadResult> {
  const abs = path.join(ctx.projectRoot, file);
  let size: number;
  try {
    size = (await fsPromises.stat(abs)).size;
  } catch {
    return { skipped: "unreadable" };
  }
  if (size > MAX_CONTENT_FILE_BYTES) return { skipped: "too-large" };
  if (budget.bytesUsed + size > ctx.fileBudget.maxBytes) return { skipped: "budget" };
  budget.bytesUsed += size;
  try {
    return { content: await fsPromises.readFile(abs, "utf-8") };
  } catch {
    return { skipped: "unreadable" };
  }
}

function lineOfIndex(content: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < content.length; i++) {
    if (content[i] === "\n") line++;
  }
  return line;
}

function skipNote(skipped: string[]): string {
  return skipped.length > 0 ? ` (skipped ${skipped.length} file(s) > 1 MiB or unreadable)` : "";
}

function literalEquals(actual: unknown, expected: string | number | boolean): boolean {
  return actual === expected;
}

function resolveDottedPath(obj: unknown, dotted: string): unknown {
  let cursor: unknown = obj;
  for (const segment of dotted.split(".")) {
    if (cursor === null || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[segment];
  }
  return cursor;
}

// ---------------------------------------------------------------------------
// Leaf checks
// ---------------------------------------------------------------------------

async function evaluateFileExists(
  check: Extract<Check, { type: "file-exists" }>,
  ctx: CheckContext
): Promise<CheckOutcome> {
  const files = await globFiles(check.glob, ctx);
  if (files.length === 0) {
    return { passed: false, detail: `0 files matched glob '${check.glob}' (≥1 required)` };
  }
  return {
    passed: true,
    detail: `${files.length} file(s) matched glob '${check.glob}'`,
    evidence: files.slice(0, MAX_EVIDENCE_ENTRIES).map((file) => ({ file })),
  };
}

async function evaluateFileAbsent(
  check: Extract<Check, { type: "file-absent" }>,
  ctx: CheckContext
): Promise<CheckOutcome> {
  const files = await globFiles(check.glob, ctx);
  if (files.length > 0) {
    return {
      passed: false,
      detail: `${files.length} file(s) matched glob '${check.glob}' (0 required)`,
      evidence: files.slice(0, MAX_EVIDENCE_ENTRIES).map((file) => ({ file })),
    };
  }
  return { passed: true, detail: `no files matched glob '${check.glob}'` };
}

async function evaluateContentMatch(
  check: Extract<Check, { type: "content-match" }>,
  ctx: CheckContext
): Promise<CheckOutcome> {
  const files = await globFiles(check.glob, ctx);
  if (files.length === 0) {
    return { passed: false, detail: `0 files matched glob '${check.glob}'` };
  }

  const regex = new RegExp(check.pattern, `g${check.flags ?? ""}`);
  const minMatches = check.minMatches ?? 1;
  const scope = check.scope ?? "every";
  const budget = { bytesUsed: 0 };
  const evidence: CheckEvidence[] = [];
  const failing: string[] = [];
  const skipped: string[] = [];
  let passingFiles = 0;

  for (const file of files) {
    const read = await readBudgeted(file, ctx, budget);
    if (read.content === undefined) {
      skipped.push(file);
      continue;
    }
    regex.lastIndex = 0;
    let count = 0;
    let firstIndex = -1;
    for (const m of read.content.matchAll(regex)) {
      count++;
      if (firstIndex < 0) firstIndex = m.index ?? 0;
      if (count >= minMatches) break;
    }
    if (count >= minMatches) {
      passingFiles++;
      if (evidence.length < MAX_EVIDENCE_ENTRIES) {
        evidence.push({ file, line: lineOfIndex(read.content, firstIndex) });
      }
    } else {
      failing.push(file);
    }
  }

  const checked = files.length - skipped.length;
  if (checked === 0) {
    return {
      passed: false,
      detail: `all ${files.length} file(s) matching '${check.glob}' were skipped (> 1 MiB or unreadable); pattern /${check.pattern}/ not evaluated`,
    };
  }

  const passed = scope === "any" ? passingFiles > 0 : failing.length === 0;
  if (passed) {
    return {
      passed: true,
      detail: `pattern /${check.pattern}/ matched in ${passingFiles}/${checked} file(s)${skipNote(skipped)}`,
      evidence,
    };
  }
  return {
    passed: false,
    detail:
      scope === "any"
        ? `pattern /${check.pattern}/ matched in 0/${checked} file(s) for glob '${check.glob}'${skipNote(skipped)}`
        : `pattern /${check.pattern}/ missing (or < ${minMatches} match(es)) in ${failing.length}/${checked} file(s) for glob '${check.glob}'${skipNote(skipped)}`,
    evidence: failing.slice(0, MAX_EVIDENCE_ENTRIES).map((file) => ({ file })),
  };
}

async function evaluateContentAbsent(
  check: Extract<Check, { type: "content-absent" }>,
  ctx: CheckContext
): Promise<CheckOutcome> {
  const files = await globFiles(check.glob, ctx);
  const regex = new RegExp(check.pattern, check.flags ?? "");
  const budget = { bytesUsed: 0 };
  const offenders: CheckEvidence[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const read = await readBudgeted(file, ctx, budget);
    if (read.content === undefined) {
      skipped.push(file);
      continue;
    }
    const m = regex.exec(read.content);
    if (m) {
      offenders.push({ file, line: lineOfIndex(read.content, m.index) });
      if (offenders.length >= MAX_EVIDENCE_ENTRIES) break;
    }
  }

  if (offenders.length > 0) {
    return {
      passed: false,
      detail: `pattern /${check.pattern}/ found in ${offenders.length}${offenders.length >= MAX_EVIDENCE_ENTRIES ? "+" : ""} file(s) matching '${check.glob}' (must be absent)${skipNote(skipped)}`,
      evidence: offenders,
    };
  }
  return {
    passed: true,
    detail: `pattern /${check.pattern}/ absent from ${files.length - skipped.length} file(s) matching '${check.glob}'${skipNote(skipped)}`,
  };
}

async function evaluateFrontmatterField(
  check: Extract<Check, { type: "frontmatter-field" }>,
  ctx: CheckContext
): Promise<CheckOutcome> {
  const files = await globFiles(check.glob, ctx);
  if (files.length === 0) {
    return { passed: false, detail: `0 files matched glob '${check.glob}'` };
  }

  const budget = { bytesUsed: 0 };
  const failing: CheckEvidence[] = [];
  const skipped: string[] = [];

  for (const file of files) {
    const read = await readBudgeted(file, ctx, budget);
    if (read.content === undefined) {
      skipped.push(file);
      continue;
    }
    let value: unknown;
    try {
      value = matter(read.content).data?.[check.field];
    } catch {
      failing.push({ file, line: 1 });
      continue;
    }
    if (!frontmatterExpectationMet(value, check.expect)) {
      failing.push({ file, line: 1 });
    }
  }

  const checked = files.length - skipped.length;
  if (failing.length > 0) {
    return {
      passed: false,
      detail: `frontmatter field '${check.field}' fails ${describeExpectation(check.expect)} in ${failing.length}/${checked} file(s) matching '${check.glob}'${skipNote(skipped)}`,
      evidence: failing.slice(0, MAX_EVIDENCE_ENTRIES),
    };
  }
  return {
    passed: true,
    detail: `frontmatter field '${check.field}' satisfies ${describeExpectation(check.expect)} in ${checked} file(s)${skipNote(skipped)}`,
  };
}

function frontmatterExpectationMet(
  value: unknown,
  expect: Extract<Check, { type: "frontmatter-field" }>["expect"]
): boolean {
  if ("exists" in expect) return value !== undefined && value !== null;
  if ("equals" in expect) return literalEquals(value, expect.equals);
  return expect.oneOf.some((candidate) => literalEquals(value, candidate));
}

function describeExpectation(expect: Record<string, unknown>): string {
  if ("exists" in expect) return "expectation 'exists'";
  if ("equals" in expect) return `expectation 'equals ${JSON.stringify(expect.equals)}'`;
  if ("oneOf" in expect) return `expectation 'oneOf ${JSON.stringify(expect.oneOf)}'`;
  if ("truthy" in expect) return "expectation 'truthy'";
  return "expectation";
}

// ---------------------------------------------------------------------------
// Dependency checks (package.json today; other ecosystems degrade to manual)
// ---------------------------------------------------------------------------

const OTHER_MANIFESTS = ["go.mod", "pyproject.toml", "Cargo.toml", "requirements.txt", "Gemfile"];

async function readDependencyMap(ctx: CheckContext): Promise<Record<string, string> | null> {
  try {
    const raw = await fsPromises.readFile(path.join(ctx.projectRoot, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as Record<string, unknown>;
    const sections = [
      "dependencies",
      "devDependencies",
      "peerDependencies",
      "optionalDependencies",
    ];
    const map: Record<string, string> = {};
    for (const section of sections) {
      const deps = pkg[section];
      if (deps && typeof deps === "object") {
        for (const [name, range] of Object.entries(deps as Record<string, unknown>)) {
          if (typeof range === "string") map[name] = range;
        }
      }
    }
    return map;
  } catch {
    return null;
  }
}

async function evaluateDependency(
  name: string,
  range: string | undefined,
  mustBePresent: boolean,
  ctx: CheckContext
): Promise<CheckOutcome> {
  const deps = await readDependencyMap(ctx);
  if (deps === null) {
    let hasOtherManifest = false;
    for (const manifest of OTHER_MANIFESTS) {
      try {
        await fsPromises.access(path.join(ctx.projectRoot, manifest));
        hasOtherManifest = true;
        break;
      } catch {
        // keep looking
      }
    }
    return {
      passed: false,
      unsupported: true,
      detail: hasOtherManifest
        ? `dependency check unsupported for this ecosystem yet (no package.json; only package.json is parsed today)`
        : `no readable package.json found at project root; cannot evaluate dependency '${name}'`,
    };
  }

  const declared = deps[name];
  if (mustBePresent) {
    if (declared === undefined) {
      return { passed: false, detail: `dependency '${name}' not declared in package.json` };
    }
    if (range !== undefined && declared !== range) {
      return {
        passed: false,
        detail: `dependency '${name}' declared as '${declared}', expected range '${range}' (exact range-string comparison)`,
        evidence: [{ file: "package.json" }],
      };
    }
    return {
      passed: true,
      detail: `dependency '${name}' declared in package.json (${declared})`,
      evidence: [{ file: "package.json" }],
    };
  }

  if (declared !== undefined) {
    return {
      passed: false,
      detail: `dependency '${name}' is declared in package.json (${declared}) but must be absent`,
      evidence: [{ file: "package.json" }],
    };
  }
  return { passed: true, detail: `dependency '${name}' not declared in package.json` };
}

// ---------------------------------------------------------------------------
// Fingerprint + JSON key checks
// ---------------------------------------------------------------------------

async function evaluateFingerprint(
  check: Extract<Check, { type: "fingerprint" }>,
  ctx: CheckContext
): Promise<CheckOutcome> {
  if (!ctx.fingerprint) {
    return {
      passed: false,
      detail: `fingerprint unavailable; cannot evaluate path '${check.path}' — run bp verify with detection enabled`,
    };
  }
  const value = resolveDottedPath(ctx.fingerprint, check.path);
  const met = "truthy" in check.expect ? Boolean(value) : literalEquals(value, check.expect.equals);
  return {
    passed: met,
    detail: `fingerprint path '${check.path}' = ${JSON.stringify(value)} ${met ? "satisfies" : "fails"} ${describeExpectation(check.expect)}`,
  };
}

async function evaluateJsonKey(
  check: Extract<Check, { type: "json-key" }>,
  ctx: CheckContext
): Promise<CheckOutcome> {
  const abs = path.join(ctx.projectRoot, check.file);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await fsPromises.readFile(abs, "utf-8"));
  } catch (err) {
    return {
      passed: false,
      detail: `cannot read JSON file '${check.file}': ${err instanceof Error ? err.message : String(err)}`,
    };
  }
  const value = resolveDottedPath(parsed, check.path);
  const met =
    "exists" in check.expect
      ? value !== undefined
      : value !== undefined && literalEquals(value, check.expect.equals);
  return {
    passed: met,
    detail: `'${check.file}' key '${check.path}' = ${JSON.stringify(value)} ${met ? "satisfies" : "fails"} ${describeExpectation(check.expect)}`,
    evidence: [{ file: check.file }],
  };
}

// ---------------------------------------------------------------------------
// Composites (short-circuiting; merged evidence)
// ---------------------------------------------------------------------------

async function evaluateAllOf(checks: Check[], ctx: CheckContext): Promise<CheckOutcome> {
  const evidence: CheckEvidence[] = [];
  for (let i = 0; i < checks.length; i++) {
    const child = checks[i];
    if (!child) continue;
    const outcome = await evaluateNode(child, ctx);
    if (outcome.unsupported) return outcome;
    if (!outcome.passed) {
      return {
        passed: false,
        detail: `allOf failed at child ${i + 1}/${checks.length} (${child.type}): ${outcome.detail}`,
        evidence: outcome.evidence,
      };
    }
    if (outcome.evidence) {
      evidence.push(...outcome.evidence.slice(0, MAX_EVIDENCE_ENTRIES - evidence.length));
    }
  }
  return {
    passed: true,
    detail: `all ${checks.length} child check(s) passed`,
    evidence: evidence.slice(0, MAX_EVIDENCE_ENTRIES),
  };
}

async function evaluateAnyOf(checks: Check[], ctx: CheckContext): Promise<CheckOutcome> {
  const details: string[] = [];
  for (const child of checks) {
    if (!child) continue;
    const outcome = await evaluateNode(child, ctx);
    if (outcome.unsupported) return outcome;
    if (outcome.passed) {
      return {
        passed: true,
        detail: `anyOf satisfied by ${child.type}: ${outcome.detail}`,
        evidence: outcome.evidence,
      };
    }
    details.push(`${child.type}: ${outcome.detail}`);
  }
  return {
    passed: false,
    detail: `anyOf: none of ${checks.length} child check(s) passed — ${details.join("; ")}`.slice(
      0,
      1024
    ),
  };
}

async function evaluateNot(check: Check, ctx: CheckContext): Promise<CheckOutcome> {
  const outcome = await evaluateNode(check, ctx);
  if (outcome.unsupported) return outcome;
  return {
    passed: !outcome.passed,
    detail: `not(${check.type}): inner check ${outcome.passed ? "passed" : "failed"} — ${outcome.detail}`,
    evidence: outcome.evidence,
  };
}
