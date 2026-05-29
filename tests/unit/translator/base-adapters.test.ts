import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CrushAdapter } from "../../../src/translator/adapters/crush.js";
import { QwenAdapter } from "../../../src/translator/adapters/qwen.js";
import { TraeAdapter } from "../../../src/translator/adapters/trae.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-base-adapter-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

function createBaseIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "test",
      surface: "",
      temporal_anchor: "dev",
      conventions: [],
    },
    personas: [],
    rules: [],
    skills: [],
    hooks: [],
    meta: {
      rule_precedence: [],
      conflict_resolution: "precedence-based",
      source_backend: "claude",
      target_backend: "claude",
    },
  };
}

describe("MarkdownAdapter (via CrushAdapter)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("renders skills with tools_required populated", async () => {
    const adapter = new CrushAdapter();
    const ir = createBaseIR();
    ir.skills = [
      {
        name: "deploy",
        description: "Deploy to prod",
        when_to_use: "On release",
        tools_required: ["Bash", "Docker"],
        procedure: "Run deploy script",
      },
    ];
    const files = await adapter.render(ir, tmpDir);
    expect(files.some((f) => f.endsWith("deploy.md"))).toBe(true);
    const content = fs.readFileSync(files.find((f) => f.endsWith("deploy.md"))!, "utf-8");
    expect(content).toContain("tools_required");
    expect(content).toContain("Bash");
  });

  it("renders skills with empty tools_required (skips tools_required block)", async () => {
    const adapter = new CrushAdapter();
    const ir = createBaseIR();
    ir.skills = [
      {
        name: "greet",
        description: "Say hello",
        when_to_use: "Always",
        tools_required: [],
        procedure: "Say hi",
      },
    ];
    const files = await adapter.render(ir, tmpDir);
    expect(files.some((f) => f.endsWith("greet.md"))).toBe(true);
    const content = fs.readFileSync(files.find((f) => f.endsWith("greet.md"))!, "utf-8");
    expect(content).not.toContain("tools_required");
  });

  it("renderCommand returns markdown frontmatter string", () => {
    const adapter = new CrushAdapter();
    const skill = {
      name: "audit",
      description: "Run audit",
      when_to_use: "Before deploy",
      tools_required: [],
      procedure: "Run npm audit",
    };
    const result = adapter.renderCommand(skill, "workflow-1");
    expect(result).toContain("name: audit");
    expect(result).toContain("Run npm audit");
  });

  it("getSkillPath returns correct path with extension", () => {
    const adapter = new CrushAdapter();
    const result = adapter.getSkillPath(tmpDir, "my-skill");
    expect(result).toContain("my-skill.md");
    expect(result).toContain(tmpDir);
  });

  it("render creates commandsDir when commandsPath set", async () => {
    const adapter = new CrushAdapter();
    const ir = createBaseIR();
    await adapter.render(ir, tmpDir);
    expect(fs.existsSync(path.join(tmpDir, ".crush/.opsx/commands"))).toBe(true);
  });
});

describe("SkillOnlyAdapter (via TraeAdapter)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("renderCommand throws for skill-only backends", () => {
    const adapter = new TraeAdapter();
    expect(() =>
      adapter.renderCommand(
        { name: "x", description: "", when_to_use: "", tools_required: [], procedure: "" },
        "wf"
      )
    ).toThrow(/does not support command files/);
  });

  it("parse returns empty skills when skillsDir does not exist", async () => {
    const adapter = new TraeAdapter();
    const ir = await adapter.parse(tmpDir);
    expect(ir.skills).toHaveLength(0);
  });

  it("parse reads skills from existing skillsDir", async () => {
    const adapter = new TraeAdapter();
    const skillsDir = path.join(tmpDir, ".trae/skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillsDir, "deploy.md"),
      "---\nname: deploy\ndescription: Deploy app\n---\nRun the deploy script"
    );
    const ir = await adapter.parse(tmpDir);
    expect(ir.skills.some((s) => s.name === "deploy")).toBe(true);
  });

  it("render writes skill files and AGENTS.md", async () => {
    const adapter = new TraeAdapter();
    const ir = createBaseIR();
    ir.skills = [
      {
        name: "build",
        description: "Build project",
        when_to_use: "On push",
        tools_required: [],
        procedure: "npm run build",
      },
    ];
    const files = await adapter.render(ir, tmpDir);
    expect(files.some((f) => f.endsWith("AGENTS.md"))).toBe(true);
    expect(files.some((f) => f.endsWith("build.md"))).toBe(true);
  });
});

describe("TomlCommandAdapter (via QwenAdapter)", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("renderCommand returns TOML string", () => {
    const adapter = new QwenAdapter();
    const skill = {
      name: "run-tests",
      description: "Run test suite",
      when_to_use: "Before merge",
      tools_required: [],
      procedure: "npm test",
    };
    const result = adapter.renderCommand(skill, "run-tests");
    expect(result).toContain("[command]");
    expect(result).toContain("[body]");
    expect(result).toContain("npm test");
  });

  it("render writes TOML command files when commandsPath set", async () => {
    const adapter = new QwenAdapter();
    const ir = createBaseIR();
    ir.skills = [
      {
        name: "lint",
        description: "Run linter",
        when_to_use: "On commit",
        tools_required: [],
        procedure: "npm run lint",
      },
    ];
    const files = await adapter.render(ir, tmpDir);
    expect(files.some((f) => f.endsWith(".toml"))).toBe(true);
  });
});
