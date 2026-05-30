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

    it("errors when commands dir exists for trae", () => {
      fs.mkdirSync(path.join(tmpDir, ".trae", "commands"), { recursive: true });
      const rule = BACKEND_RULES.find((r) => r.id === "skill-only-no-commands")!;
      const errors = rule.check(tmpDir, ["trae"]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe("SKILL_ONLY_BACKEND_HAS_COMMANDS");
    });

    it("errors when commands dir exists for forgecode", () => {
      fs.mkdirSync(path.join(tmpDir, ".forgecode", "commands"), { recursive: true });
      const rule = BACKEND_RULES.find((r) => r.id === "skill-only-no-commands")!;
      const errors = rule.check(tmpDir, ["forgecode"]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe("SKILL_ONLY_BACKEND_HAS_COMMANDS");
    });

    it("passes when commands dir absent for trae and forgecode", () => {
      fs.mkdirSync(path.join(tmpDir, ".trae", "skills"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".forgecode", "skills"), { recursive: true });
      const rule = BACKEND_RULES.find((r) => r.id === "skill-only-no-commands")!;
      const errors = rule.check(tmpDir, ["trae", "forgecode"]);
      expect(errors).toHaveLength(0);
    });

    it("skips unknown backend id without throwing", () => {
      const rule = BACKEND_RULES.find((r) => r.id === "skill-only-no-commands")!;
      expect(() => rule.check(tmpDir, ["unknown-backend-xyz"])).not.toThrow();
      const errors = rule.check(tmpDir, ["unknown-backend-xyz"]);
      expect(errors).toHaveLength(0);
    });
  });

  describe("toml-command-format", () => {
    it("passes when no toml commands dir exists for gemini", () => {
      const rule = BACKEND_RULES.find((r) => r.id === "toml-command-format")!;
      const errors = rule.check(tmpDir, ["gemini"]);
      expect(errors).toHaveLength(0);
    });

    it("passes for valid toml files (no unclosed brackets)", () => {
      fs.mkdirSync(path.join(tmpDir, ".gemini", "commands"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, ".gemini", "commands", "test.toml"),
        '[section]\nkey = "value"\n'
      );
      const rule = BACKEND_RULES.find((r) => r.id === "toml-command-format")!;
      const errors = rule.check(tmpDir, ["gemini"]);
      expect(errors).toHaveLength(0);
    });

    it("errors for toml files with unclosed bracket", () => {
      fs.mkdirSync(path.join(tmpDir, ".gemini", "commands"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, ".gemini", "commands", "bad.toml"),
        "[unclosed\nkey = value\n"
      );
      const rule = BACKEND_RULES.find((r) => r.id === "toml-command-format")!;
      const errors = rule.check(tmpDir, ["gemini"]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe("INVALID_TOML_SYNTAX");
    });

    it("skips unknown backend id without throwing", () => {
      const rule = BACKEND_RULES.find((r) => r.id === "toml-command-format")!;
      expect(() => rule.check(tmpDir, ["unknown-backend-xyz"])).not.toThrow();
    });
  });

  describe("codex-global-path", () => {
    it("passes when codex not in backends list", () => {
      const rule = BACKEND_RULES.find((r) => r.id === "codex-global-path")!;
      const errors = rule.check(tmpDir, ["claude"]);
      expect(errors).toHaveLength(0);
    });

    it("warns when codex global path does not exist", () => {
      const rule = BACKEND_RULES.find((r) => r.id === "codex-global-path")!;
      const fakeHome = path.join(tmpDir, "fakehome");
      const origEnv = process.env.CODEX_HOME;
      process.env.CODEX_HOME = fakeHome;
      try {
        const errors = rule.check(tmpDir, ["codex"]);
        expect(errors.length).toBeGreaterThan(0);
        expect(errors[0].type).toBe("CODEX_GLOBAL_PATH_MISSING");
      } finally {
        if (origEnv === undefined) delete process.env.CODEX_HOME;
        else process.env.CODEX_HOME = origEnv;
      }
    });
  });

  describe("multi-backend-no-conflicts", () => {
    it("returns empty for backends with no rules dirs", () => {
      const rule = BACKEND_RULES.find((r) => r.id === "multi-backend-no-conflicts")!;
      const errors = rule.check(tmpDir, ["claude", "cursor"]);
      expect(errors).toHaveLength(0);
    });

    it("detects conflicting severity for same rule across backends", () => {
      fs.mkdirSync(path.join(tmpDir, ".claude", "rules"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, ".cursor", "rules"), { recursive: true });
      fs.writeFileSync(
        path.join(tmpDir, ".claude", "rules", "my-rule.md"),
        "---\nseverity: error\n---\nContent\n"
      );
      fs.writeFileSync(
        path.join(tmpDir, ".cursor", "rules", "my-rule.md"),
        "---\nseverity: warning\n---\nContent\n"
      );
      const rule = BACKEND_RULES.find((r) => r.id === "multi-backend-no-conflicts")!;
      const errors = rule.check(tmpDir, ["claude", "cursor"]);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].type).toBe("MULTI_BACKEND_RULE_CONFLICT");
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
