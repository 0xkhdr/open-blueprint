import { describe, expect, it } from "vitest";
import {
  CheckSchema,
  MAX_CHECK_CHILDREN,
  checkDepth,
  hasNestedQuantifier,
} from "../../../../src/validator/checks/schema.js";
import type { Check } from "../../../../src/validator/checks/schema.js";

describe("CheckSchema — valid samples per check type", () => {
  const valid: Check[] = [
    { type: "file-exists", glob: "SECURITY.md" },
    { type: "file-absent", glob: "**/*.pem" },
    { type: "content-match", glob: "src/**/*.ts", pattern: "audit", flags: "i", scope: "any" },
    { type: "content-match", glob: "src/**/*.ts", pattern: "logger", minMatches: 2 },
    { type: "content-absent", glob: "src/**/*.ts", pattern: "http://" },
    { type: "frontmatter-field", glob: ".claude/rules/*.md", field: "severity", expect: { exists: true } },
    { type: "frontmatter-field", glob: "*.md", field: "severity", expect: { equals: "hard" } },
    { type: "frontmatter-field", glob: "*.md", field: "severity", expect: { oneOf: ["hard", "soft"] } },
    { type: "dependency-present", name: "pino" },
    { type: "dependency-present", name: "zod", range: "^4.0.0" },
    { type: "dependency-absent", name: "left-pad" },
    { type: "fingerprint", path: "security_signals.has_docker", expect: { truthy: true } },
    { type: "fingerprint", path: "project.type", expect: { equals: "library" } },
    { type: "json-key", file: "package.json", path: "scripts.test", expect: { exists: true } },
    { type: "json-key", file: "tsconfig.json", path: "compilerOptions.strict", expect: { equals: true } },
    {
      type: "allOf",
      checks: [
        { type: "file-exists", glob: "README.md" },
        { type: "anyOf", checks: [{ type: "dependency-present", name: "pino" }] },
      ],
    },
    { type: "not", check: { type: "file-exists", glob: ".env" } },
  ];

  for (const sample of valid) {
    it(`accepts ${sample.type}${"expect" in sample ? ` (${Object.keys(sample.expect)[0]})` : ""}`, () => {
      const result = CheckSchema.safeParse(sample);
      expect(result.success).toBe(true);
    });
  }
});

describe("CheckSchema — rejections", () => {
  it("rejects unknown check type", () => {
    const result = CheckSchema.safeParse({ type: "shell-exec", command: "rm -rf /" });
    expect(result.success).toBe(false);
  });

  it("rejects unknown extra keys (strict objects)", () => {
    const result = CheckSchema.safeParse({ type: "file-exists", glob: "x", extra: 1 });
    expect(result.success).toBe(false);
  });

  it("rejects syntactically invalid regex", () => {
    const result = CheckSchema.safeParse({
      type: "content-match",
      glob: "src/**",
      pattern: "([unclosed",
    });
    expect(result.success).toBe(false);
  });

  it("rejects nested-quantifier regex (star-height guard)", () => {
    const result = CheckSchema.safeParse({
      type: "content-match",
      glob: "src/**",
      pattern: "(a+)+b",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("star-height");
    }
  });

  it("rejects regex over 256 chars", () => {
    const result = CheckSchema.safeParse({
      type: "content-absent",
      glob: "src/**",
      pattern: "a".repeat(257),
    });
    expect(result.success).toBe(false);
  });

  it("rejects glob with 4+ consecutive stars", () => {
    const result = CheckSchema.safeParse({ type: "file-exists", glob: "src/****/x.ts" });
    expect(result.success).toBe(false);
  });

  it("rejects depth-4 trees", () => {
    const depth4: Check = {
      type: "allOf",
      checks: [
        {
          type: "anyOf",
          checks: [{ type: "not", check: { type: "file-exists", glob: "README.md" } }],
        },
      ],
    };
    expect(checkDepth(depth4)).toBe(4);
    const result = CheckSchema.safeParse(depth4);
    expect(result.success).toBe(false);
  });

  it("accepts depth-3 trees", () => {
    const depth3: Check = {
      type: "allOf",
      checks: [{ type: "not", check: { type: "file-exists", glob: "README.md" } }],
    };
    const result = CheckSchema.safeParse(depth3);
    expect(result.success).toBe(true);
  });

  it("rejects composites with 17 children", () => {
    const children = Array.from({ length: MAX_CHECK_CHILDREN + 1 }, (_, i) => ({
      type: "file-exists" as const,
      glob: `file-${i}.md`,
    }));
    const result = CheckSchema.safeParse({ type: "allOf", checks: children });
    expect(result.success).toBe(false);
  });

  it("rejects empty composites", () => {
    const result = CheckSchema.safeParse({ type: "anyOf", checks: [] });
    expect(result.success).toBe(false);
  });

  it("rejects malformed dotted paths", () => {
    const result = CheckSchema.safeParse({
      type: "fingerprint",
      path: "a..b",
      expect: { truthy: true },
    });
    expect(result.success).toBe(false);
  });
});

describe("hasNestedQuantifier", () => {
  it("flags classic blowup shapes", () => {
    expect(hasNestedQuantifier("(a+)+")).toBe(true);
    expect(hasNestedQuantifier("(a*)*")).toBe(true);
    expect(hasNestedQuantifier("(\\d{2,})+")).toBe(true);
  });

  it("allows bounded and simple patterns", () => {
    expect(hasNestedQuantifier("audit[-_]?log")).toBe(false);
    expect(hasNestedQuantifier("AKIA[0-9A-Z]{16}")).toBe(false);
    expect(hasNestedQuantifier("(abc)?def")).toBe(false);
  });
});
