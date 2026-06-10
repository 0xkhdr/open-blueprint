import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import fc from "fast-check";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Fingerprint } from "../../../../src/detector/fingerprint.js";
import type { CheckContext } from "../../../../src/validator/checks/evaluate.js";
import {
  MAX_CONTENT_FILE_BYTES,
  defaultResourceBudget,
  evaluateCheck,
} from "../../../../src/validator/checks/evaluate.js";
import type { Check } from "../../../../src/validator/checks/schema.js";

let tmpDir: string;

function ctx(overrides: Partial<CheckContext> = {}): CheckContext {
  return { projectRoot: tmpDir, fileBudget: defaultResourceBudget(), ...overrides };
}

function write(rel: string, content: string): void {
  const abs = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, "utf-8");
}

function makeFingerprint(): Fingerprint {
  return {
    version: "1.0",
    detected_at: new Date().toISOString(),
    project: { name: "t", root: ".", type: "library", git_workflow: "unknown" },
    languages: [{ name: "typescript", confidence: 1, primary: true }],
    frameworks: [],
    entry_points: [],
    tooling: {},
    directory_topology: { src_dirs: [], test_dirs: [], config_dirs: [], package_dirs: [] },
    security_signals: {
      has_auth: false,
      has_external_apis: false,
      has_secrets_manager: false,
      has_docker: true,
    },
    workspacePackages: [],
  };
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-evaluate-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("evaluateCheck — file-exists / file-absent", () => {
  it("file-exists passes with evidence when files match", async () => {
    write("SECURITY.md", "# Security");
    const outcome = await evaluateCheck({ type: "file-exists", glob: "SECURITY.md" }, ctx());
    expect(outcome.passed).toBe(true);
    expect(outcome.evidence?.[0]?.file).toBe("SECURITY.md");
  });

  it("file-exists fails with 0 matches", async () => {
    const outcome = await evaluateCheck({ type: "file-exists", glob: "SECURITY.md" }, ctx());
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain("0 files matched");
  });

  it("file-absent fails when files match, listing them as evidence", async () => {
    write("secret.pem", "x");
    const outcome = await evaluateCheck({ type: "file-absent", glob: "**/*.pem" }, ctx());
    expect(outcome.passed).toBe(false);
    expect(outcome.evidence?.map((e) => e.file)).toContain("secret.pem");
  });

  it("file-absent ignores node_modules", async () => {
    write("node_modules/dep/secret.pem", "x");
    const outcome = await evaluateCheck({ type: "file-absent", glob: "**/*.pem" }, ctx());
    expect(outcome.passed).toBe(true);
  });
});

describe("evaluateCheck — content-match / content-absent", () => {
  it("content-match every (default) requires the pattern in all files", async () => {
    write("src/a.ts", "initAuditLog();");
    write("src/b.ts", "nothing here");
    const outcome = await evaluateCheck(
      { type: "content-match", glob: "src/**/*.ts", pattern: "audit[-_]?log", flags: "i" },
      ctx()
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.evidence?.map((e) => e.file)).toContain("src/b.ts");
  });

  it("content-match any passes when one file matches, with line evidence", async () => {
    write("src/a.ts", "line1\ninitAuditLog();");
    write("src/b.ts", "nothing");
    const outcome = await evaluateCheck(
      { type: "content-match", glob: "src/**/*.ts", pattern: "audit", flags: "i", scope: "any" },
      ctx()
    );
    expect(outcome.passed).toBe(true);
    expect(outcome.evidence?.[0]).toEqual({ file: "src/a.ts", line: 2 });
  });

  it("content-match honors minMatches", async () => {
    write("src/a.ts", "log(); log();");
    const twoOk = await evaluateCheck(
      { type: "content-match", glob: "src/a.ts", pattern: "log", minMatches: 2 },
      ctx()
    );
    expect(twoOk.passed).toBe(true);
    const threeFails = await evaluateCheck(
      { type: "content-match", glob: "src/a.ts", pattern: "log", minMatches: 3 },
      ctx()
    );
    expect(threeFails.passed).toBe(false);
  });

  it("content-match fails when the glob matches nothing", async () => {
    const outcome = await evaluateCheck(
      { type: "content-match", glob: "src/**/*.ts", pattern: "x" },
      ctx()
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain("0 files matched");
  });

  it("content-absent flags offending files with line numbers", async () => {
    write("src/a.ts", "ok\nfetch('http://insecure.example')");
    const outcome = await evaluateCheck(
      { type: "content-absent", glob: "src/**/*.ts", pattern: "http://" },
      ctx()
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.evidence?.[0]).toEqual({ file: "src/a.ts", line: 2 });
  });

  it("skips files larger than 1 MiB and says so in the detail", async () => {
    write("src/big.ts", "a".repeat(MAX_CONTENT_FILE_BYTES + 1));
    const outcome = await evaluateCheck(
      { type: "content-match", glob: "src/big.ts", pattern: "a" },
      ctx()
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain("skipped");
  });
});

describe("evaluateCheck — frontmatter-field", () => {
  it("checks exists / equals / oneOf expectations", async () => {
    write("rules/a.md", "---\nseverity: hard\n---\nbody");
    const exists = await evaluateCheck(
      { type: "frontmatter-field", glob: "rules/*.md", field: "severity", expect: { exists: true } },
      ctx()
    );
    expect(exists.passed).toBe(true);
    const equals = await evaluateCheck(
      { type: "frontmatter-field", glob: "rules/*.md", field: "severity", expect: { equals: "soft" } },
      ctx()
    );
    expect(equals.passed).toBe(false);
    const oneOf = await evaluateCheck(
      {
        type: "frontmatter-field",
        glob: "rules/*.md",
        field: "severity",
        expect: { oneOf: ["hard", "soft"] },
      },
      ctx()
    );
    expect(oneOf.passed).toBe(true);
  });
});

describe("evaluateCheck — dependency checks", () => {
  it("dependency-present reads package.json dependencies and devDependencies", async () => {
    write("package.json", JSON.stringify({ dependencies: { pino: "^9.0.0" }, devDependencies: { vitest: "^3.0.0" } }));
    expect((await evaluateCheck({ type: "dependency-present", name: "pino" }, ctx())).passed).toBe(true);
    expect((await evaluateCheck({ type: "dependency-present", name: "vitest" }, ctx())).passed).toBe(true);
    expect((await evaluateCheck({ type: "dependency-present", name: "left-pad" }, ctx())).passed).toBe(false);
  });

  it("dependency-present with range does exact range-string comparison", async () => {
    write("package.json", JSON.stringify({ dependencies: { pino: "^9.0.0" } }));
    expect(
      (await evaluateCheck({ type: "dependency-present", name: "pino", range: "^9.0.0" }, ctx())).passed
    ).toBe(true);
    const mismatch = await evaluateCheck(
      { type: "dependency-present", name: "pino", range: "^8.0.0" },
      ctx()
    );
    expect(mismatch.passed).toBe(false);
    expect(mismatch.detail).toContain("^9.0.0");
  });

  it("dependency-absent fails when declared", async () => {
    write("package.json", JSON.stringify({ dependencies: { lodash: "*" } }));
    expect((await evaluateCheck({ type: "dependency-absent", name: "lodash" }, ctx())).passed).toBe(false);
    expect((await evaluateCheck({ type: "dependency-absent", name: "pino" }, ctx())).passed).toBe(true);
  });

  it("degrades to unsupported for non-package.json ecosystems", async () => {
    write("go.mod", "module example.com/x\n");
    const outcome = await evaluateCheck({ type: "dependency-present", name: "pino" }, ctx());
    expect(outcome.passed).toBe(false);
    expect(outcome.unsupported).toBe(true);
    expect(outcome.detail).toContain("unsupported");
  });
});

describe("evaluateCheck — fingerprint and json-key", () => {
  it("fingerprint truthy/equals against dotted paths", async () => {
    const fingerprint = makeFingerprint();
    expect(
      (
        await evaluateCheck(
          { type: "fingerprint", path: "security_signals.has_docker", expect: { truthy: true } },
          ctx({ fingerprint })
        )
      ).passed
    ).toBe(true);
    expect(
      (
        await evaluateCheck(
          { type: "fingerprint", path: "project.type", expect: { equals: "service" } },
          ctx({ fingerprint })
        )
      ).passed
    ).toBe(false);
  });

  it("fingerprint check degrades gracefully when fingerprint is absent", async () => {
    const outcome = await evaluateCheck(
      { type: "fingerprint", path: "project.type", expect: { truthy: true } },
      ctx()
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain("fingerprint unavailable");
  });

  it("json-key exists/equals", async () => {
    write("tsconfig.json", JSON.stringify({ compilerOptions: { strict: true } }));
    expect(
      (
        await evaluateCheck(
          { type: "json-key", file: "tsconfig.json", path: "compilerOptions.strict", expect: { exists: true } },
          ctx()
        )
      ).passed
    ).toBe(true);
    expect(
      (
        await evaluateCheck(
          { type: "json-key", file: "tsconfig.json", path: "compilerOptions.strict", expect: { equals: false } },
          ctx()
        )
      ).passed
    ).toBe(false);
    const missing = await evaluateCheck(
      { type: "json-key", file: "nope.json", path: "a", expect: { exists: true } },
      ctx()
    );
    expect(missing.passed).toBe(false);
    expect(missing.detail).toContain("cannot read JSON file");
  });
});

describe("evaluateCheck — composites", () => {
  it("allOf short-circuits on first failure and names the failing child", async () => {
    write("README.md", "x");
    const outcome = await evaluateCheck(
      {
        type: "allOf",
        checks: [
          { type: "file-exists", glob: "README.md" },
          { type: "file-exists", glob: "SECURITY.md" },
        ],
      },
      ctx()
    );
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain("allOf failed at child 2/2");
  });

  it("anyOf passes when one child passes", async () => {
    write("README.md", "x");
    const outcome = await evaluateCheck(
      {
        type: "anyOf",
        checks: [
          { type: "file-exists", glob: "SECURITY.md" },
          { type: "file-exists", glob: "README.md" },
        ],
      },
      ctx()
    );
    expect(outcome.passed).toBe(true);
  });

  it("not inverts the inner outcome", async () => {
    const outcome = await evaluateCheck(
      { type: "not", check: { type: "file-exists", glob: ".env" } },
      ctx()
    );
    expect(outcome.passed).toBe(true);
  });
});

describe("evaluateCheck — malformed input never throws", () => {
  it("returns CHECK_INVALID for an unknown check type", async () => {
    const outcome = await evaluateCheck({ type: "bogus" } as unknown as Check, ctx());
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain("CHECK_INVALID");
  });

  it("returns CHECK_INVALID for a depth-4 tree", async () => {
    const depth4 = {
      type: "allOf",
      checks: [{ type: "anyOf", checks: [{ type: "not", check: { type: "file-exists", glob: "x" } }] }],
    } as Check;
    const outcome = await evaluateCheck(depth4, ctx());
    expect(outcome.passed).toBe(false);
    expect(outcome.detail).toContain("CHECK_INVALID");
  });
});

describe("evaluateCheck — property: random trees never throw", () => {
  const leafArb: fc.Arbitrary<Check> = fc.oneof(
    fc.record({ type: fc.constant("file-exists" as const), glob: fc.constantFrom("README.md", "**/*.ts", "nope/*.x") }),
    fc.record({ type: fc.constant("file-absent" as const), glob: fc.constantFrom("**/*.pem", "src/**") }),
    fc.record({
      type: fc.constant("content-match" as const),
      glob: fc.constantFrom("src/**/*.ts", "*.md"),
      pattern: fc.constantFrom("audit", "log", "[a-z]+"),
    }),
    fc.record({ type: fc.constant("dependency-present" as const), name: fc.constantFrom("pino", "zod") }),
    fc.record({
      type: fc.constant("fingerprint" as const),
      path: fc.constantFrom("project.type", "security_signals.has_docker"),
      expect: fc.constant({ truthy: true as const }),
    }),
    fc.record({
      type: fc.constant("json-key" as const),
      file: fc.constantFrom("package.json", "missing.json"),
      path: fc.constantFrom("name", "scripts.test"),
      expect: fc.constant({ exists: true as const }),
    })
  );

  const compositeArb = (children: fc.Arbitrary<Check>): fc.Arbitrary<Check> =>
    fc.oneof(
      fc.record({ type: fc.constant("allOf" as const), checks: fc.array(children, { minLength: 1, maxLength: 4 }) }),
      fc.record({ type: fc.constant("anyOf" as const), checks: fc.array(children, { minLength: 1, maxLength: 4 }) }),
      fc.record({ type: fc.constant("not" as const), check: children })
    );

  const treeArb: fc.Arbitrary<Check> = fc.oneof(
    leafArb,
    compositeArb(leafArb),
    compositeArb(fc.oneof(leafArb, compositeArb(leafArb)))
  );

  it("never throws for any tree of depth ≤ 3", async () => {
    write("README.md", "x");
    write("package.json", JSON.stringify({ name: "t", dependencies: { pino: "*" } }));
    await fc.assert(
      fc.asyncProperty(treeArb, async (check) => {
        const outcome = await evaluateCheck(check, ctx({ fingerprint: makeFingerprint() }));
        expect(typeof outcome.passed).toBe("boolean");
        expect(typeof outcome.detail).toBe("string");
      }),
      { numRuns: 100 }
    );
  });
});
