import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeAdapter } from "../../../src/translator/adapters/claude.js";
import { CursorAdapter } from "../../../src/translator/adapters/cursor.js";
import { GenericAdapter } from "../../../src/translator/adapters/generic.js";
import { BlueprintIRSchema } from "../../../src/translator/ir.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-translator-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("Translator Engine", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("can serialize and deserialize from/to Claude adapter", async () => {
    const claudeAdapter = new ClaudeAdapter();
    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "rules"), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "skills"), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "hooks"), { recursive: true });

    // Write dummy spatial anchor
    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      `# test-project\n\n- convention 1\n- convention 2\n`,
      "utf-8"
    );

    // Write dummy agent
    fs.writeFileSync(
      path.join(claudeDir, "agents", "planner.md"),
      `---\nname: Planner\nrole: Planning\nreasoning_style: structured\nallowed_tools: ["Bash"]\n---\n## Constraints\n- constraint 1\n- constraint 2\n`,
      "utf-8"
    );

    // Write dummy rule
    fs.writeFileSync(
      path.join(claudeDir, "rules", "01-test.md"),
      `---\nscope: "src/**"\nseverity: hard\naction: "Must not leak secrets"\nrationale: "Security"\ntags: [security]\n---\nRule body.\n`,
      "utf-8"
    );

    // Write dummy skill
    fs.writeFileSync(
      path.join(claudeDir, "skills", "deploy.md"),
      `---\nname: deploy\ndescription: "deploy app"\nwhen_to_use: "deploying"\ntools_required: ["Bash"]\n---\nDeploy procedure.\n`,
      "utf-8"
    );

    // Write dummy hook
    fs.writeFileSync(
      path.join(claudeDir, "hooks", "pre_tool_use.js"),
      `module.exports = async function() {};`,
      "utf-8"
    );

    // Parse
    const ir = await claudeAdapter.parse(tmpDir);
    const validation = BlueprintIRSchema.safeParse(ir);
    expect(validation.success).toBe(true);

    if (validation.success) {
      expect(validation.data.spatial_anchor.project_name).toBe("test-project");
      expect(validation.data.spatial_anchor.conventions).toContain("convention 1");
      expect(validation.data.personas[0]?.name).toBe("Planner");
      expect(validation.data.personas[0]?.constraints).toContain("constraint 1");
      expect(validation.data.rules[0]?.severity).toBe("hard");
      expect(validation.data.rules[0]?.action).toBe("Must not leak secrets");
      expect(validation.data.skills[0]?.name).toBe("deploy");
      expect(validation.data.hooks[0]?.event).toBe("pre_tool_use");
    }

    // Render to another directory and check round-trip
    const targetDir = createTmpDir();
    try {
      await claudeAdapter.render(ir, targetDir);
      expect(fs.existsSync(path.join(targetDir, "CLAUDE.md"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, ".claude", "agents", "planner.md"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, ".claude", "rules", "01-test.md"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, ".claude", "skills", "deploy.md"))).toBe(true);
      expect(fs.existsSync(path.join(targetDir, ".claude", "hooks", "pre_tool_use.js"))).toBe(true);
    } finally {
      cleanDir(targetDir);
    }
  });

  it("can convert Claude to Cursor and round-trip successfully", async () => {
    const claudeAdapter = new ClaudeAdapter();
    const cursorAdapter = new CursorAdapter();

    const claudeDir = path.join(tmpDir, ".claude");
    fs.mkdirSync(claudeDir, { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "rules"), { recursive: true });
    fs.mkdirSync(path.join(claudeDir, "skills"), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, "CLAUDE.md"),
      `# my-app\n\n- convention a\n`,
      "utf-8"
    );

    fs.writeFileSync(
      path.join(claudeDir, "agents", "reviewer.md"),
      `---\nname: Reviewer\nrole: Code review\nreasoning_style: fast\n---\n- constraint a\n`,
      "utf-8"
    );

    const ir = await claudeAdapter.parse(tmpDir);
    
    // Render to cursor
    const cursorOutputDir = createTmpDir();
    try {
      await cursorAdapter.render(ir, cursorOutputDir);
      
      expect(fs.existsSync(path.join(cursorOutputDir, "context.md"))).toBe(true);
      expect(fs.existsSync(path.join(cursorOutputDir, ".cursor", "agents", "reviewer.md"))).toBe(true);

      // Parse back from cursor
      const cursorIr = await cursorAdapter.parse(cursorOutputDir);
      expect(cursorIr.spatial_anchor.project_name).toBe("my-app");
      expect(cursorIr.spatial_anchor.conventions).toContain("convention a");
      expect(cursorIr.personas[0]?.name).toBe("Reviewer");
      expect(cursorIr.personas[0]?.constraints).toContain("constraint a");
    } finally {
      cleanDir(cursorOutputDir);
    }
  });

  it("can round-trip Cursor adapter completely", async () => {
    const cursorAdapter = new CursorAdapter();
    const ir = {
      version: "1.0" as const,
      spatial_anchor: {
        project_name: "cursor-test",
        surface: "# cursor-test\n\n- convention 1\n",
        temporal_anchor: "development",
        conventions: ["convention 1"],
      },
      personas: [
        {
          name: "Planner",
          role: "Planning",
          reasoning_style: "methodical",
          constraints: ["constraint 1"],
          allowed_tools: ["Bash"],
        }
      ],
      rules: [
        {
          id: "01-rule",
          scope: "src/**/*.ts",
          severity: "hard" as const,
          action: "Do something",
          rationale: "Rationale",
          tags: ["test"],
        }
      ],
      skills: [
        {
          name: "Skill1",
          description: "Description",
          when_to_use: "When testing",
          tools_required: ["Bash"],
          procedure: "Procedure",
        }
      ],
      hooks: [],
      meta: {
        rule_precedence: [],
        conflict_resolution: "precedence-based",
        source_backend: "cursor",
        target_backend: "cursor",
      }
    };

    const targetDir = createTmpDir();
    try {
      await cursorAdapter.render(ir, targetDir);
      
      const parsedIr = await cursorAdapter.parse(targetDir);
      expect(parsedIr.spatial_anchor.project_name).toBe("cursor-test");
      expect(parsedIr.personas[0]?.name).toBe("Planner");
      expect(parsedIr.rules[0]?.severity).toBe("hard");
      expect(parsedIr.skills[0]?.name).toBe("Skill1");
    } finally {
      cleanDir(targetDir);
    }
  });

  it("can round-trip Generic adapter completely", async () => {
    const genericAdapter = new GenericAdapter();
    const ir = {
      version: "1.0" as const,
      spatial_anchor: {
        project_name: "generic-test",
        surface: "# generic-test\n\n- convention g\n",
        temporal_anchor: "development",
        conventions: ["convention g"],
      },
      personas: [
        {
          name: "AgentG",
          role: "Generic role",
          reasoning_style: "direct",
          constraints: ["constraint g"],
          allowed_tools: ["Bash"],
        }
      ],
      rules: [
        {
          id: "01-g",
          scope: "src/**/*.ts",
          severity: "soft" as const,
          action: "Soft rule",
          rationale: "Reason",
          tags: ["g"],
        }
      ],
      skills: [
        {
          name: "SkillG",
          description: "Desc",
          when_to_use: "Use",
          tools_required: ["Bash"],
          procedure: "Proc",
        }
      ],
      hooks: [
        {
          event: "pre_tool_use" as const,
          language: "javascript",
          stub: "code",
        }
      ],
      meta: {
        rule_precedence: [],
        conflict_resolution: "precedence-based",
        source_backend: "generic",
        target_backend: "generic",
      }
    };

    const targetDir = createTmpDir();
    try {
      await genericAdapter.render(ir, targetDir);
      
      const parsedIr = await genericAdapter.parse(targetDir);
      expect(parsedIr.spatial_anchor.project_name).toBe("generic-test");
      expect(parsedIr.personas[0]?.name).toBe("AgentG");
      expect(parsedIr.rules[0]?.severity).toBe("soft");
      expect(parsedIr.skills[0]?.name).toBe("SkillG");
      expect(parsedIr.hooks[0]?.event).toBe("pre_tool_use");
    } finally {
      cleanDir(targetDir);
    }
  });

  it("can convert Generic to Claude and round-trip successfully", async () => {
    const genericAdapter = new GenericAdapter();
    const claudeAdapter = new ClaudeAdapter();

    fs.mkdirSync(path.join(tmpDir, "agents"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "rules"), { recursive: true });
    fs.mkdirSync(path.join(tmpDir, "skills"), { recursive: true });

    fs.writeFileSync(
      path.join(tmpDir, "BLUEPRINT.md"),
      `# generic-app\n\n- convention generic\n`,
      "utf-8"
    );

    fs.writeFileSync(
      path.join(tmpDir, "agents", "bot.md"),
      `---\nname: Bot\nrole: Automation\nreasoning_style: direct\n---\n- rule 1\n`,
      "utf-8"
    );

    const ir = await genericAdapter.parse(tmpDir);

    const claudeOutputDir = createTmpDir();
    try {
      await claudeAdapter.render(ir, claudeOutputDir);
      
      expect(fs.existsSync(path.join(claudeOutputDir, "CLAUDE.md"))).toBe(true);
      expect(fs.existsSync(path.join(claudeOutputDir, ".claude", "agents", "bot.md"))).toBe(true);
    } finally {
      cleanDir(claudeOutputDir);
    }
  });
});
