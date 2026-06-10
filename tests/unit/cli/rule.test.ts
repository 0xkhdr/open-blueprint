import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRuleCommand } from "../../../src/cli/commands/rule.js";
import { BpError } from "../../../src/errors.js";
import { EXIT_CODES } from "../../../src/validator/index.js";

let tmpDir: string;
let prevCwd: string;

function writeRule(name: string, frontmatter: string[]): string {
  const file = path.join(tmpDir, name);
  fs.writeFileSync(file, ["---", ...frontmatter, "---", "", "# Rule body"].join("\n"), "utf-8");
  return file;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-rule-cli-test-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(path.join(tmpDir, "README.md"), "# Fixture\n");
  prevCwd = process.cwd();
  process.chdir(tmpDir);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("bp rule test — check evaluation", () => {
  it("passes (exit 0) when the check holds", async () => {
    const file = writeRule("passing.md", [
      "id: passing",
      'scope: "**/*"',
      "severity: hard",
      'action: "README required"',
      "check:",
      "  type: file-exists",
      '  glob: "README.md"',
    ]);
    const cmd = createRuleCommand();
    await expect(cmd.parseAsync(["test", file], { from: "user" })).resolves.toBeDefined();
  });

  it("exits with validation failure for a failing hard rule", async () => {
    const file = writeRule("hard.md", [
      "id: hard-fail",
      'scope: "**/*"',
      "severity: hard",
      'action: "SECURITY.md required"',
      "check:",
      "  type: file-exists",
      '  glob: "SECURITY.md"',
    ]);
    const cmd = createRuleCommand();
    await expect(cmd.parseAsync(["test", file], { from: "user" })).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.exitCode === EXIT_CODES.LOGICAL_FAILURE
    );
  });

  it("warns but exits 0 for a failing soft rule", async () => {
    const file = writeRule("soft.md", [
      "id: soft-fail",
      'scope: "**/*"',
      "severity: soft",
      'action: "CONTRIBUTING.md suggested"',
      "check:",
      "  type: file-exists",
      '  glob: "CONTRIBUTING.md"',
    ]);
    const cmd = createRuleCommand();
    await expect(cmd.parseAsync(["test", file], { from: "user" })).resolves.toBeDefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("FAIL (soft)"));
  });

  it("reports manual for rules without a check", async () => {
    const file = writeRule("manual.md", [
      "id: manual-rule",
      'scope: "**/*.ts"',
      "severity: hard",
      'action: "require(encryption)"',
    ]);
    const cmd = createRuleCommand();
    await expect(cmd.parseAsync(["test", file], { from: "user" })).resolves.toBeDefined();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("manual"));
  });

  it("fails with RULE_CHECK_INVALID for a malformed check", async () => {
    const file = writeRule("malformed.md", [
      "id: malformed-rule",
      'scope: "**/*"',
      "severity: hard",
      'action: "broken"',
      "check:",
      "  type: no-such-check",
    ]);
    const cmd = createRuleCommand();
    await expect(cmd.parseAsync(["test", file], { from: "user" })).rejects.toBeInstanceOf(BpError);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("RULE_CHECK_INVALID"));
  });
});

describe("bp rule lint — check validation", () => {
  it("reports RULE_CHECK_INVALID with a line number for a malformed check", async () => {
    fs.mkdirSync(path.join(tmpDir, ".claude/rules"), { recursive: true });
    const file = path.join(tmpDir, ".claude/rules/bad-check.md");
    fs.writeFileSync(
      file,
      [
        "---",
        "id: bad-check",
        'scope: "**/*"',
        "severity: hard",
        'action: "broken"',
        "check:",
        "  type: no-such-check",
        "---",
        "",
        "# Bad check",
      ].join("\n"),
      "utf-8"
    );
    const cmd = createRuleCommand();
    await expect(cmd.parseAsync(["lint", file], { from: "user" })).rejects.toBeInstanceOf(BpError);
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("RULE_CHECK_INVALID"));
  });

  it("accepts a rule with a valid check", async () => {
    fs.mkdirSync(path.join(tmpDir, ".claude/rules"), { recursive: true });
    const file = path.join(tmpDir, ".claude/rules/good-check.md");
    fs.writeFileSync(
      file,
      [
        "---",
        "id: good-check",
        'scope: "**/*"',
        "severity: hard",
        'action: "README required"',
        "check:",
        "  type: file-exists",
        '  glob: "README.md"',
        "---",
        "",
        "# Good check",
      ].join("\n"),
      "utf-8"
    );
    const cmd = createRuleCommand();
    await expect(cmd.parseAsync(["lint", file], { from: "user" })).resolves.toBeDefined();
  });
});
