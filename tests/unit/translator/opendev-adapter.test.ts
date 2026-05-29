import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { OpenDevAdapter } from "../../../src/translator/adapters/opendev.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-opendev-test-"));
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
      source_backend: "opendev",
      target_backend: "opendev",
    },
  };
}

describe("OpenDevAdapter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  it("parse returns empty skills when no skills dir", async () => {
    const adapter = new OpenDevAdapter();
    const ir = await adapter.parse(tmpDir);
    expect(ir.skills).toHaveLength(0);
    expect(ir.rules).toHaveLength(0);
  });

  it("parse reads skills from .opendev/skills/", async () => {
    const adapter = new OpenDevAdapter();
    const skillsDir = path.join(tmpDir, ".opendev/skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillsDir, "deploy.md"),
      "---\nname: deploy\ndescription: Deploy app\nwhen_to_use: On release\ntools_required: [Bash]\n---\nRun the deploy script"
    );
    const ir = await adapter.parse(tmpDir);
    expect(ir.skills).toHaveLength(1);
    expect(ir.skills[0]?.name).toBe("deploy");
    expect(ir.skills[0]?.tools_required).toEqual(["Bash"]);
  });

  it("parse falls back to filename when name not in frontmatter", async () => {
    const adapter = new OpenDevAdapter();
    const skillsDir = path.join(tmpDir, ".opendev/skills");
    fs.mkdirSync(skillsDir, { recursive: true });
    fs.writeFileSync(
      path.join(skillsDir, "my-skill.md"),
      "---\ndescription: No name here\n---\nDo the thing"
    );
    const ir = await adapter.parse(tmpDir);
    expect(ir.skills[0]?.name).toBe("my-skill");
  });

  it("render writes skill with when_to_use and tools_required", async () => {
    const adapter = new OpenDevAdapter();
    const ir = createBaseIR();
    ir.skills = [
      {
        name: "build",
        description: "Build project",
        when_to_use: "On every push",
        tools_required: ["npm", "node"],
        procedure: "npm run build",
      },
    ];
    const files = await adapter.render(ir, tmpDir);
    expect(files.some((f) => f.endsWith("build.md"))).toBe(true);
    const content = fs.readFileSync(files.find((f) => f.endsWith("build.md"))!, "utf-8");
    expect(content).toContain("when_to_use");
    expect(content).toContain("tools_required");
  });

  it("render omits when_to_use and tools_required when absent", async () => {
    const adapter = new OpenDevAdapter();
    const ir = createBaseIR();
    ir.skills = [
      {
        name: "greet",
        description: "Say hello",
        when_to_use: "",
        tools_required: [],
        procedure: "echo hello",
      },
    ];
    const files = await adapter.render(ir, tmpDir);
    const content = fs.readFileSync(files.find((f) => f.endsWith("greet.md"))!, "utf-8");
    expect(content).not.toContain("when_to_use");
    expect(content).not.toContain("tools_required");
  });

  it("render writes AGENTS.md", async () => {
    const adapter = new OpenDevAdapter();
    const ir = createBaseIR();
    const files = await adapter.render(ir, tmpDir);
    expect(files.some((f) => f.endsWith("AGENTS.md"))).toBe(true);
  });
});
