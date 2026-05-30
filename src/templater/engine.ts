import * as fs from "node:fs";
import * as path from "node:path";
import Handlebars from "handlebars";

// Allowlisted helpers only — no arbitrary JS execution
const ALLOWED_HELPERS: Record<string, Handlebars.HelperDelegate> = {
  upper: (str: unknown) => (typeof str === "string" ? str.toUpperCase() : ""),
  lower: (str: unknown) => (typeof str === "string" ? str.toLowerCase() : ""),
  capitalize: (str: unknown) =>
    typeof str === "string" && str.length > 0 ? str.charAt(0).toUpperCase() + str.slice(1) : "",
  kebab: (str: unknown) =>
    typeof str === "string"
      ? str
          .replace(/([a-z])([A-Z])/g, "$1-$2")
          .replace(/\s+/g, "-")
          .toLowerCase()
      : "",
  snake: (str: unknown) =>
    typeof str === "string"
      ? str
          .replace(/([a-z])([A-Z])/g, "$1_$2")
          .replace(/\s+/g, "_")
          .replace(/-/g, "_")
          .toLowerCase()
      : "",
  eq: (a: unknown, b: unknown) => a === b,
  ne: (a: unknown, b: unknown) => a !== b,
  includes: (arr: unknown, val: unknown) => Array.isArray(arr) && arr.includes(val),
  join: (arr: unknown, sep: unknown) =>
    Array.isArray(arr) ? arr.join(typeof sep === "string" ? sep : ", ") : "",
  default: (val: unknown, fallback: unknown) =>
    val !== undefined && val !== null && val !== "" ? val : fallback,
  year: () => new Date().getFullYear(),
  date: () => new Date().toISOString().split("T")[0],
  // biome-ignore lint/suspicious/noExplicitAny: Handlebars helper — this/options are runtime context objects
  hasFeature: function (this: any, feature: unknown, options: any) {
    const ctx = options?.data?.root || this;
    if (!ctx) return false;
    const featStr = String(feature).toLowerCase();
    if (ctx.security_signals && typeof ctx.security_signals === "object") {
      const sigKey = `has_${featStr}`;
      if (sigKey in ctx.security_signals) {
        // biome-ignore lint/suspicious/noExplicitAny: dynamic property access on Handlebars context
        return !!(ctx.security_signals as any)[sigKey];
      }
    }
    if (featStr === "docker") return !!ctx.security_signals?.has_docker;
    if (featStr === "monorepo") return ctx.project?.type === "monorepo";
    if (featStr === "cicd") return !!ctx.tooling?.ci_system;
    return false;
  },
  // biome-ignore lint/suspicious/noExplicitAny: Handlebars helper — this/options are runtime context objects
  riskGte: function (this: any, targetTier: unknown, options: any) {
    const ctx = options?.data?.root || this;
    if (!ctx) return false;
    const currentTier = ctx.risk_tier || ctx.riskTier || "low";
    const currentRank = RISK_RANKS[String(currentTier).toLowerCase()] ?? 0;
    const targetRank = RISK_RANKS[String(targetTier).toLowerCase()] ?? 0;
    return currentRank >= targetRank;
  },
};

const RISK_RANKS: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  critical: 3,
};

const templateCache = new Map<string, HandlebarsTemplateDelegate>();

export function createEngine(): typeof Handlebars {
  const instance = Handlebars.create();

  for (const [name, fn] of Object.entries(ALLOWED_HELPERS)) {
    instance.registerHelper(name, fn);
  }

  return instance;
}

const hbs = createEngine();

export function registerPartials(partialsDir: string): void {
  if (!fs.existsSync(partialsDir)) return;
  const files = fs.readdirSync(partialsDir);
  for (const file of files) {
    if (!file.endsWith(".hbs")) continue;
    const name = path.basename(file, ".hbs");
    const content = fs.readFileSync(path.join(partialsDir, file), "utf-8");
    hbs.registerPartial(name, content);
  }
}

export function renderTemplate(templatePath: string, context: Record<string, unknown>): string {
  const cached = templateCache.get(templatePath);
  let compiled: HandlebarsTemplateDelegate;

  if (cached) {
    compiled = cached;
  } else {
    const source = fs.readFileSync(templatePath, "utf-8");
    compiled = hbs.compile(source, { noEscape: true, strict: false });
    templateCache.set(templatePath, compiled);
  }

  // Deep-freeze context to prevent prototype pollution (Security: ADR-004)
  const frozenCtx = deepFreeze(structuredClone(context));
  return compiled(frozenCtx);
}

export function renderString(template: string, context: Record<string, unknown>): string {
  const compiled = hbs.compile(template, { noEscape: true, strict: false });
  const frozenCtx = deepFreeze(structuredClone(context));
  return compiled(frozenCtx);
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  Object.getOwnPropertyNames(obj).forEach((name) => {
    const value = (obj as Record<string, unknown>)[name];
    if (value && typeof value === "object") {
      deepFreeze(value);
    }
  });
  return Object.freeze(obj);
}

export function compileTemplate(source: string): HandlebarsTemplateDelegate {
  return hbs.compile(source, { noEscape: true, strict: false });
}

export function renderCompiled(
  compiled: HandlebarsTemplateDelegate,
  context: Record<string, unknown>
): string {
  const frozenCtx = deepFreeze(structuredClone(context));
  return compiled(frozenCtx);
}

export function clearTemplateCache(): void {
  templateCache.clear();
}
