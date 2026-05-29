import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BACKEND_RULES, runBackendRules } from "../../../../src/validator/rules/backend-rules.js";

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-backend-rules-test-"));
}

describe("backend validation rules", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("skill-only-no-commands", () => {
    it("passes when no commands dir exists for kimi", () => {
      fs.mkdirSync(path.join(tmpDir, ".kimi", "skills"), { recursive: true });
      const rule = BACKEND_RULES.find((r) => r.id === "skill-only-no-commands")!;
      const errors = rule.check(tmpDir, ["kimi"]);
      expect(errors).toHaveLength(0);
    });

    it("errors when commands dir exists for kimi", () => {
      fs.mkdirSync(path.join(tmpDir, ".kimi", "commands"), { recursive: true });
      const rule = BACKEND_RULES.find((r) => r.id === "skill-only-no-commands")!;
      const errors = rule.check(tmpDir, ["kimi"]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe("SKILL_ONLY_BACKEND_HAS_COMMANDS");
    });
  });

  describe("github-copilot-ide-only", () => {
    it("always emits a warning for github-copilot", () => {
      const rule = BACKEND_RULES.find((r) => r.id === "github-copilot-ide-only")!;
      const errors = rule.check(tmpDir, ["github-copilot"]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe("COPILOT_IDE_ONLY");
      expect(errors[0].severity).toBe("warning");
    });

    it("does not emit warning when github-copilot is not in backends", () => {
      const rule = BACKEND_RULES.find((r) => r.id === "github-copilot-ide-only")!;
      const errors = rule.check(tmpDir, ["claude"]);
      expect(errors).toHaveLength(0);
    });
  });

  describe("backend-presence-check", () => {
    it("errors when backend is configured but skills dir is missing", () => {
      const rule = BACKEND_RULES.find((r) => r.id === "backend-presence-check")!;
      const errors = rule.check(tmpDir, ["claude"]);
      const presenceErrors = errors.filter((e) => e.type === "BACKEND_NOT_SCAFFOLDED");
      expect(presenceErrors.length).toBeGreaterThan(0);
    });

    it("passes when backend dir exists", () => {
      fs.mkdirSync(path.join(tmpDir, ".claude", "skills"), { recursive: true });
      const rule = BACKEND_RULES.find((r) => r.id === "backend-presence-check")!;
      const errors = rule.check(tmpDir, ["claude"]);
      const presenceErrors = errors.filter((e) => e.type === "BACKEND_NOT_SCAFFOLDED");
      expect(presenceErrors).toHaveLength(0);
    });

    it("warns when backend files exist but not in config", () => {
      fs.mkdirSync(path.join(tmpDir, ".windsurf", "workflows", "skills"), { recursive: true });
      const rule = BACKEND_RULES.find((r) => r.id === "backend-presence-check")!;
      const errors = rule.check(tmpDir, ["claude"]);
      const orphanedErrors = errors.filter((e) => e.type === "ORPHANED_BACKEND_FILES");
      expect(orphanedErrors.length).toBeGreaterThan(0);
    });
  });

  describe("runBackendRules integration", () => {
    it("runs all applicable rules and returns errors", () => {
      const errors = runBackendRules(tmpDir, ["github-copilot"]);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("returns empty for empty backends list", () => {
      const errors = runBackendRules(tmpDir, []);
      const copilotWarnings = errors.filter((e) => e.type === "COPILOT_IDE_ONLY");
      expect(copilotWarnings).toHaveLength(0);
    });
  });
});
