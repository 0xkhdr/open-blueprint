import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BackendManifest } from "../../../src/templater/selector.js";
import {
  validateEnforcement,
  validateEnforcementDetailed,
} from "../../../src/validator/enforcement.js";

const FIXTURE = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../fixtures/enforcement"
);

function manifestStub(): BackendManifest {
  return {
    backend: "claude",
    version: "1.0",
    file_patterns: {
      anchor: ["CLAUDE.md"],
      rules: ".claude/rules/*.md",
      skills: ".claude/skills/*.md",
      agents: ".claude/agents/*.md",
      hooks: ".claude/hooks/*",
    },
  } as unknown as BackendManifest;
}

describe("validateEnforcement — fixture repo", () => {
  it("maps outcomes to RULE_VIOLATION / RULE_MANUAL / RULE_CHECK_INVALID", async () => {
    const { errors, summary } = await validateEnforcementDetailed(FIXTURE, manifestStub());

    const byType = (t: string) => errors.filter((e) => e.type === t);

    // passing.md produces no error; failing-hard + failing-soft are violations
    const violations = byType("RULE_VIOLATION");
    expect(violations).toHaveLength(2);

    const hard = violations.find((e) => e.file.endsWith("failing-hard.md"));
    expect(hard?.severity).toBe("error");
    expect(hard?.message).toContain("fixture-failing-hard");
    expect(hard?.message).toContain("SECURITY.md");
    expect(hard?.resolution).toBe("Security policy must be documented");
    expect(hard?.line).toBeGreaterThan(1); // points at the check: frontmatter line

    const soft = violations.find((e) => e.file.endsWith("failing-soft.md"));
    expect(soft?.severity).toBe("warning");

    const manual = byType("RULE_MANUAL");
    expect(manual).toHaveLength(1);
    expect(manual[0]?.severity).toBe("info");
    expect(manual[0]?.message).toContain("fixture-manual");
    expect(manual[0]?.message).toContain("not machine-enforceable");

    const invalid = byType("RULE_CHECK_INVALID");
    expect(invalid).toHaveLength(1);
    expect(invalid[0]?.severity).toBe("error");
    expect(invalid[0]?.file).toContain("malformed.md");

    expect(summary).toEqual({ enforced: 3, violations: 2, manual: 1 });
  });

  it("validateEnforcement returns the flat error list", async () => {
    const errors = await validateEnforcement(FIXTURE, manifestStub());
    expect(errors.length).toBe(4);
  });
});

describe("validateEnforcement — pass after remediation", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-enforcement-test-"));
    fs.mkdirSync(path.join(tmpDir, ".claude/rules"), { recursive: true });
    fs.writeFileSync(
      path.join(tmpDir, ".claude/rules/security.md"),
      [
        "---",
        "id: security-policy",
        'scope: "**/*"',
        "severity: hard",
        'action: "Repository must contain a SECURITY.md"',
        "check:",
        "  type: file-exists",
        '  glob: "SECURITY.md"',
        "---",
        "",
        "# Security policy rule",
      ].join("\n")
    );
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("fails without SECURITY.md and passes once it is added", async () => {
    const before = await validateEnforcementDetailed(tmpDir, manifestStub());
    expect(before.errors.some((e) => e.type === "RULE_VIOLATION")).toBe(true);
    expect(before.summary.violations).toBe(1);

    fs.writeFileSync(path.join(tmpDir, "SECURITY.md"), "# Security\n");

    const after = await validateEnforcementDetailed(tmpDir, manifestStub());
    expect(after.errors.filter((e) => e.type === "RULE_VIOLATION")).toHaveLength(0);
    expect(after.summary).toEqual({ enforced: 1, violations: 0, manual: 0 });
  });

  it("returns no errors when the rules pattern is empty", async () => {
    const manifest = manifestStub();
    (manifest.file_patterns as { rules: string }).rules = "";
    const result = await validateEnforcementDetailed(tmpDir, manifest);
    expect(result.errors).toHaveLength(0);
  });
});
