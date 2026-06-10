import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detect } from "../../src/detector/index.js";
import { resolveTemplatePack } from "../../src/templater/selector.js";
import { EXIT_CODES, exitCodeForResult, runValidator } from "../../src/validator/index.js";

const FIXTURE = path.join(path.dirname(new URL(import.meta.url).pathname), "../fixtures/enforcement");

describe("bp verify --level enforcement (pipeline integration)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-enforce-int-"));
    fs.cpSync(FIXTURE, tmpDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  async function verify(level: "enforcement" | "all") {
    const fingerprint = await detect(tmpDir);
    const pack = resolveTemplatePack(fingerprint, "claude");
    return runValidator({ level, projectRoot: tmpDir, manifest: pack.manifest, fingerprint });
  }

  it("fails non-zero with RULE_VIOLATION for the hard rule, warning for soft, info for manual", async () => {
    const result = await verify("enforcement");

    expect(result.passed).toBe(false);
    expect(exitCodeForResult(result)).toBe(EXIT_CODES.LOGICAL_FAILURE);

    const hard = result.errors.find((e) => e.type === "RULE_VIOLATION");
    expect(hard).toBeDefined();
    expect(hard?.file).toContain("failing-hard.md");
    expect(hard?.line).toBeGreaterThan(0);
    expect(hard?.resolution).toBeTruthy();

    expect(result.errors.some((e) => e.type === "RULE_CHECK_INVALID")).toBe(true);
    expect(result.warnings.some((e) => e.type === "RULE_VIOLATION")).toBe(true);
    expect(result.infos.some((e) => e.type === "RULE_MANUAL")).toBe(true);

    expect(result.enforcement).toEqual({ enforced: 3, violations: 2, manual: 1 });
  });

  it("hard violation clears once the repo is remediated", async () => {
    fs.writeFileSync(path.join(tmpDir, "SECURITY.md"), "# Security\n");
    // also fix the soft rule and the malformed rule so only manual info remains
    fs.writeFileSync(path.join(tmpDir, "CONTRIBUTING.md"), "# Contributing\n");
    fs.rmSync(path.join(tmpDir, ".claude/rules/malformed.md"));

    const result = await verify("enforcement");

    expect(result.errors.filter((e) => e.type === "RULE_VIOLATION")).toHaveLength(0);
    expect(result.errors.filter((e) => e.type === "RULE_CHECK_INVALID")).toHaveLength(0);
    expect(result.passed).toBe(true);
    expect(result.infos.some((e) => e.type === "RULE_MANUAL")).toBe(true);
    expect(result.enforcement).toEqual({ enforced: 3, violations: 0, manual: 1 });
  });

  it("manual rules never affect the exit code", async () => {
    // keep only the manual rule
    for (const f of ["passing.md", "failing-hard.md", "failing-soft.md", "malformed.md"]) {
      fs.rmSync(path.join(tmpDir, ".claude/rules", f));
    }
    const result = await verify("enforcement");
    expect(result.passed).toBe(true);
    expect(exitCodeForResult(result)).toBe(EXIT_CODES.SUCCESS);
    expect(result.infos.some((e) => e.type === "RULE_MANUAL")).toBe(true);
  });
});
