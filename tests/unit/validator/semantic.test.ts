import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BackendManifest } from "../../../src/templater/selector.js";
import { validateSemantic } from "../../../src/validator/semantic.js";

const MOCK_MANIFEST: BackendManifest = {
  backend: "claude",
  version: "2026.1",
  supported_features: { anchors: true, rules: true, skills: true, agents: true, hooks: true },
  file_patterns: {
    anchor: ["CLAUDE.md"],
    rules: ".claude/rules/*.md",
    skills: ".claude/skills/*.md",
    agents: ".claude/agents/*.md",
    hooks: ".claude/hooks/*",
  },
  max_file_sizes: { anchor: 5000, rules: 10000, skills: 15000, agents: 8000 },
  frontmatter_schema: {
    rules: {
      required: ["scope", "severity"],
      optional: ["action", "rationale", "tags"],
      severity_values: ["hard", "soft", "info"],
    },
    skills: { required: ["name", "description"], optional: ["tools_required", "when_to_use"] },
    agents: { required: ["name"], optional: ["role", "allowed_tools"] },
  },
};

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-semantic-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("validateSemantic", () => {
  let tmpDir: string;
  let rulesDir: string;
  let skillsDir: string;
  let agentsDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    rulesDir = path.join(tmpDir, ".claude", "rules");
    skillsDir = path.join(tmpDir, ".claude", "skills");
    agentsDir = path.join(tmpDir, ".claude", "agents");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.mkdirSync(agentsDir, { recursive: true });
  });

  afterEach(() => cleanDir(tmpDir));

  describe("scope pattern resolution", () => {
    it("warns when scope matches no files", async () => {
      const ruleFile = path.join(rulesDir, "01-nonexistent.md");
      fs.writeFileSync(
        ruleFile,
        `---\nscope: "nonexistent-dir/**/*.ts"\nseverity: soft\naction: "Do something"\n---\nContent.\n`
      );

      const errors = await validateSemantic([ruleFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "ZERO_MATCH_SCOPE")).toBe(true);
      expect(errors.find((e) => e.type === "ZERO_MATCH_SCOPE")?.severity).toBe("warning");
    });

    it("no ZERO_MATCH_SCOPE when scope matches files", async () => {
      // Create a file that the scope will match
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, "index.ts"), "// code");

      const ruleFile = path.join(rulesDir, "01-style.md");
      fs.writeFileSync(
        ruleFile,
        `---\nscope: "src/**/*.ts"\nseverity: soft\naction: "Follow style"\n---\nContent.\n`
      );

      const errors = await validateSemantic([ruleFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "ZERO_MATCH_SCOPE")).toBe(false);
    });

    it("handles broad scope **/* without warning", async () => {
      const srcDir = path.join(tmpDir, "src");
      fs.mkdirSync(srcDir, { recursive: true });
      fs.writeFileSync(path.join(srcDir, "app.ts"), "// app");

      const ruleFile = path.join(rulesDir, "01-global.md");
      fs.writeFileSync(
        ruleFile,
        `---\nscope: "**/*"\nseverity: soft\naction: "Global rule"\n---\nContent.\n`
      );

      const errors = await validateSemantic([ruleFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "ZERO_MATCH_SCOPE")).toBe(false);
    });
  });

  describe("tool reference validation", () => {
    it("warns on unknown tools_required in skill", async () => {
      const skillFile = path.join(skillsDir, "my-skill.md");
      fs.writeFileSync(
        skillFile,
        `---\nname: my-skill\ndescription: A skill\ntools_required:\n  - bash\n  - nonexistent_tool_xyz\n---\nContent.\n`
      );

      const errors = await validateSemantic([skillFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "UNKNOWN_TOOL_REFERENCE")).toBe(true);
      expect(errors.find((e) => e.type === "UNKNOWN_TOOL_REFERENCE")?.message).toContain(
        "nonexistent_tool_xyz"
      );
    });

    it("no error for known tools", async () => {
      const skillFile = path.join(skillsDir, "my-skill.md");
      fs.writeFileSync(
        skillFile,
        `---\nname: my-skill\ndescription: A skill\ntools_required:\n  - bash\n  - read\n  - write\n---\nContent.\n`
      );

      const errors = await validateSemantic([skillFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "UNKNOWN_TOOL_REFERENCE")).toBe(false);
    });

    it("warns on unknown allowed_tools in agent", async () => {
      const agentFile = path.join(agentsDir, "planner.md");
      fs.writeFileSync(
        agentFile,
        `---\nname: planner\nrole: planning\nallowed_tools:\n  - bash\n  - made_up_tool_99\n---\nContent.\n`
      );

      const errors = await validateSemantic([agentFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "UNKNOWN_TOOL_REFERENCE")).toBe(true);
    });
  });

  describe("cross-reference integrity", () => {
    it("errors when rule references non-existent skill", async () => {
      const ruleFile = path.join(rulesDir, "01-style.md");
      fs.writeFileSync(
        ruleFile,
        `---\nscope: "**/*"\nseverity: soft\nskills:\n  - nonexistent-skill\n---\nContent.\n`
      );

      const errors = await validateSemantic([ruleFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "MISSING_SKILL_REFERENCE")).toBe(true);
    });

    it("no error when referenced skill exists", async () => {
      // Create the skill file
      fs.writeFileSync(
        path.join(skillsDir, "add-test.md"),
        `---\nname: add-test\ndescription: Add a test\n---\nContent.\n`
      );

      const ruleFile = path.join(rulesDir, "01-style.md");
      fs.writeFileSync(
        ruleFile,
        `---\nscope: "**/*"\nseverity: soft\nskills:\n  - add-test\n---\nContent.\n`
      );

      const skillFile = path.join(skillsDir, "add-test.md");
      const errors = await validateSemantic([ruleFile, skillFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "MISSING_SKILL_REFERENCE")).toBe(false);
    });
  });

  describe("empty rule body", () => {
    it("warns on rule with frontmatter but no body content", async () => {
      const ruleFile = path.join(rulesDir, "01-empty.md");
      fs.writeFileSync(ruleFile, `---\nscope: "**/*"\nseverity: soft\n---\n\n   \n`);

      const errors = await validateSemantic([ruleFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "EMPTY_RULE_BODY")).toBe(true);
    });

    it("no warning when rule has body content", async () => {
      const ruleFile = path.join(rulesDir, "01-ok.md");
      fs.writeFileSync(
        ruleFile,
        `---\nscope: "**/*"\nseverity: soft\n---\nThis rule has content.\n`
      );

      const errors = await validateSemantic([ruleFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      expect(errors.some((e) => e.type === "EMPTY_RULE_BODY")).toBe(false);
    });
  });

  describe("all errors include resolution path", () => {
    it("each error has a non-empty resolution field", async () => {
      const ruleFile = path.join(rulesDir, "01-bad.md");
      fs.writeFileSync(
        ruleFile,
        `---\nscope: "zzz-does-not-exist/**"\nseverity: soft\nskills:\n  - ghost-skill\n---\n\n`
      );

      const errors = await validateSemantic([ruleFile], {
        projectRoot: tmpDir,
        manifest: MOCK_MANIFEST,
      });

      for (const err of errors) {
        expect(err.resolution).toBeTruthy();
        expect(err.resolution.length).toBeGreaterThan(10);
      }
    });
  });
});
