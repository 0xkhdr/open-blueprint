import { describe, expect, it } from "vitest";
import { BUILT_IN_PACKS } from "../../../src/rule-library/packs.js";
import {
  createEmptyPackLock,
  PackLockSchema,
  RulePackSchema,
} from "../../../src/rule-library/schema.js";

function validPackData(): Record<string, unknown> {
  return {
    schema: "bp-pack/1",
    id: "acme-internal",
    name: "ACME Internal",
    version: "1.2.0",
    kind: "rules",
    framework: "custom",
    description: "House rules",
    author: "platform@acme.test",
    tags: ["security"],
    rules: [
      {
        id: "no-raw-sql",
        scope: "src/**/*.ts",
        severity: "hard",
        action: "Never build SQL via string concatenation",
        check: {
          type: "content-absent",
          glob: "src/**/*.ts",
          pattern: "execute\\(`",
        },
      },
    ],
  };
}

describe("RulePackSchema", () => {
  it("accepts a valid pack including a Stage 1 check", () => {
    const parsed = RulePackSchema.parse(validPackData());
    expect(parsed.id).toBe("acme-internal");
    expect(parsed.rules[0]?.check?.type).toBe("content-absent");
  });

  it("every built-in pack parses against the schema", () => {
    for (const pack of BUILT_IN_PACKS) {
      const result = RulePackSchema.safeParse(pack);
      expect(result.success, `built-in pack ${pack.id} must satisfy RulePackSchema`).toBe(true);
    }
  });

  it("rejects a broken severity with the issue path", () => {
    const data = validPackData();
    (data.rules as Array<Record<string, unknown>>)[0]!.severity = "fatal";
    const result = RulePackSchema.safeParse(data);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path.join(".") === "rules.0.severity")).toBe(true);
    }
  });

  it("rejects a non-semver version", () => {
    const result = RulePackSchema.safeParse({ ...validPackData(), version: "v1" });
    expect(result.success).toBe(false);
  });

  it("rejects a wrong schema marker", () => {
    const result = RulePackSchema.safeParse({ ...validPackData(), schema: "bp-pack/2" });
    expect(result.success).toBe(false);
  });

  it("rejects an empty rules array", () => {
    const result = RulePackSchema.safeParse({ ...validPackData(), rules: [] });
    expect(result.success).toBe(false);
  });

  it("rejects invalid pack ids", () => {
    const result = RulePackSchema.safeParse({ ...validPackData(), id: "Not Valid!" });
    expect(result.success).toBe(false);
  });

  it("rejects a malformed check inside a rule", () => {
    const data = validPackData();
    (data.rules as Array<Record<string, unknown>>)[0]!.check = { type: "nonsense" };
    const result = RulePackSchema.safeParse(data);
    expect(result.success).toBe(false);
  });
});

describe("PackLockSchema", () => {
  it("round-trips an empty lock", () => {
    const lock = createEmptyPackLock();
    expect(PackLockSchema.parse(JSON.parse(JSON.stringify(lock)))).toEqual(lock);
  });

  it("round-trips a lock with an entry", () => {
    const lock = {
      schema: "bp-pack-lock/1",
      installed: [
        {
          id: "acme",
          version: "1.0.0",
          source: "project",
          rules_count: 2,
          installed_at: new Date().toISOString(),
          content_hash: "a".repeat(64),
          files: { ".claude/rules/pack-acme-no-console.md": "b".repeat(64) },
        },
      ],
    };
    expect(PackLockSchema.parse(JSON.parse(JSON.stringify(lock)))).toEqual(lock);
  });

  it("rejects a bad content hash", () => {
    const result = PackLockSchema.safeParse({
      schema: "bp-pack-lock/1",
      installed: [
        {
          id: "acme",
          version: "1.0.0",
          source: "project",
          rules_count: 2,
          installed_at: "now",
          content_hash: "not-a-hash",
          files: {},
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
