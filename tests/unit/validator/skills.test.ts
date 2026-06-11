import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { BackendManifest } from "../../../src/templater/selector.js";
import {
  extractPathCandidates,
  validateSkillFiles,
  validateSkills,
} from "../../../src/validator/skills.js";

const MANIFEST: BackendManifest = {
  backend: "claude",
  version: "2026.1",
  tools: ["read_file", "write_file", "edit_file", "run_command", "run_tests", "search", "web_fetch"],
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
    rules: { required: ["scope", "severity"], optional: [], severity_values: ["hard", "soft"] },
    skills: { required: ["name", "description"], optional: [] },
    agents: { required: ["name"], optional: [] },
  },
};

const VALID_SKILL = `---
name: deploy-check
description: Verify a deployment is healthy
when_to_use: After every production deploy
tools_required: [read_file, run_command]
risk: low
---

## Procedure

1. Check the health endpoint.
2. Tail the error logs.
`;

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-skill-validator-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeSkill(rel: string, content: string): string {
  const file = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf-8");
  return file;
}

async function lint(...files: string[]) {
  return validateSkillFiles(files, { projectRoot: tmpDir, manifest: MANIFEST });
}

describe("validateSkillFiles", () => {
  it("passes a fully valid skill", async () => {
    const file = writeSkill(".claude/skills/deploy-check.md", VALID_SKILL);
    expect(await lint(file)).toEqual([]);
  });

  it("SKILL_SCHEMA_INVALID: missing when_to_use, with the frontmatter line", async () => {
    const file = writeSkill(
      ".claude/skills/bad.md",
      VALID_SKILL.replace("when_to_use: After every production deploy\n", "")
    );
    const errors = await lint(file);
    const schemaError = errors.find((e) => e.type === "SKILL_SCHEMA_INVALID");
    expect(schemaError?.severity).toBe("error");
    expect(schemaError?.message).toContain("when_to_use");
  });

  it("SKILL_SCHEMA_INVALID: non-slug name reports the offending line", async () => {
    const file = writeSkill(
      ".claude/skills/bad-name.md",
      VALID_SKILL.replace("name: deploy-check", "name: Deploy Check!")
    );
    const errors = await lint(file);
    const schemaError = errors.find((e) => e.type === "SKILL_SCHEMA_INVALID");
    expect(schemaError).toBeDefined();
    expect(schemaError?.line).toBe(2);
  });

  it("SKILL_SCHEMA_INVALID: unparsable YAML frontmatter", async () => {
    const file = writeSkill(".claude/skills/broken.md", "---\nname: [unclosed\n---\nbody");
    const errors = await lint(file);
    expect(errors.some((e) => e.type === "SKILL_SCHEMA_INVALID")).toBe(true);
  });

  it("SKILL_NAME_COLLISION: duplicate names across files", async () => {
    const a = writeSkill(".claude/skills/a.md", VALID_SKILL);
    const b = writeSkill(".claude/skills/b.md", VALID_SKILL);
    const errors = await lint(a, b);
    const collision = errors.find((e) => e.type === "SKILL_NAME_COLLISION");
    expect(collision?.severity).toBe("error");
    expect(collision?.file).toBe(b);
    expect(collision?.message).toContain(a);
  });

  it("SKILL_NAME_COLLISION: explicit id colliding with another skill's slug", async () => {
    const a = writeSkill(".claude/skills/a.md", VALID_SKILL);
    const b = writeSkill(
      ".claude/skills/b.md",
      VALID_SKILL.replace("name: deploy-check", "name: other-name\nid: deploy-check")
    );
    const errors = await lint(a, b);
    expect(errors.some((e) => e.type === "SKILL_NAME_COLLISION")).toBe(true);
  });

  it("SKILL_UNKNOWN_TOOL: error when the backend declares capabilities", async () => {
    const file = writeSkill(
      ".claude/skills/teleporter.md",
      VALID_SKILL.replace("tools_required: [read_file, run_command]", "tools_required: [teleport]")
    );
    const errors = await lint(file);
    const toolError = errors.find((e) => e.type === "SKILL_UNKNOWN_TOOL");
    expect(toolError?.severity).toBe("error");
    expect(toolError?.message).toContain("teleport");
  });

  it("SKILL_UNKNOWN_TOOL: downgrades to info when the backend declares no tools", async () => {
    const { tools: _tools, ...rest } = MANIFEST;
    const file = writeSkill(
      ".claude/skills/teleporter.md",
      VALID_SKILL.replace("tools_required: [read_file, run_command]", "tools_required: [teleport]")
    );
    const errors = await validateSkillFiles([file], {
      projectRoot: tmpDir,
      manifest: rest as BackendManifest,
    });
    const toolFinding = errors.find((e) => e.type === "SKILL_UNKNOWN_TOOL");
    expect(toolFinding?.severity).toBe("info");
  });

  it("accepts backend aliases and mcp refs as tools", async () => {
    const file = writeSkill(
      ".claude/skills/aliased.md",
      VALID_SKILL.replace(
        "tools_required: [read_file, run_command]",
        "tools_required: [bash, grep, \"mcp:github\"]"
      )
    );
    expect((await lint(file)).filter((e) => e.type === "SKILL_UNKNOWN_TOOL")).toEqual([]);
  });

  it("SKILL_NO_PROCEDURE: body without numbered steps", async () => {
    const file = writeSkill(
      ".claude/skills/vague.md",
      VALID_SKILL.replace(/## Procedure[\s\S]*$/, "Just do the thing somehow.\n")
    );
    const errors = await lint(file);
    const procError = errors.find((e) => e.type === "SKILL_NO_PROCEDURE");
    expect(procError?.severity).toBe("error");
  });

  it("accepts numbered steps without an explicit Procedure heading", async () => {
    const file = writeSkill(
      ".claude/skills/headless.md",
      VALID_SKILL.replace("## Procedure\n", "")
    );
    expect((await lint(file)).filter((e) => e.type === "SKILL_NO_PROCEDURE")).toEqual([]);
  });

  it("SKILL_VAGUE_TRIGGER: when_to_use repeating the description", async () => {
    const file = writeSkill(
      ".claude/skills/echo.md",
      VALID_SKILL.replace(
        "when_to_use: After every production deploy",
        "when_to_use: Verify a deployment is healthy"
      )
    );
    const errors = await lint(file);
    const trigger = errors.find((e) => e.type === "SKILL_VAGUE_TRIGGER");
    expect(trigger?.severity).toBe("warning");
  });

  it("SKILL_STALE_PATH: warns on backticked paths that do not exist", async () => {
    const file = writeSkill(
      ".claude/skills/stale.md",
      `${VALID_SKILL}\n3. Update \`src/missing/file.ts\` accordingly.\n`
    );
    const errors = await lint(file);
    const stale = errors.find((e) => e.type === "SKILL_STALE_PATH");
    expect(stale?.severity).toBe("warning");
    expect(stale?.message).toContain("src/missing/file.ts");
  });

  it("does not flag paths that exist", async () => {
    fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
    fs.writeFileSync(path.join(tmpDir, "src/index.ts"), "export {};\n");
    const file = writeSkill(
      ".claude/skills/fresh.md",
      `${VALID_SKILL}\n3. Update \`src/index.ts\` accordingly.\n`
    );
    expect((await lint(file)).filter((e) => e.type === "SKILL_STALE_PATH")).toEqual([]);
  });
});

describe("extractPathCandidates", () => {
  it("only extracts conservative slash-paths", () => {
    const body = [
      "Use `src/cli/index.ts` and `docs/skill-authoring.md`.",
      "Ignore `npm run build`, `a // b`, `https://example.com/x`, and `src/**/*.ts`.",
    ].join("\n");
    expect(extractPathCandidates(body).sort()).toEqual([
      "docs/skill-authoring.md",
      "src/cli/index.ts",
    ]);
  });
});

describe("validateSkills (manifest glob entry point)", () => {
  it("collects files from manifest.file_patterns.skills", async () => {
    writeSkill(".claude/skills/a.md", VALID_SKILL);
    writeSkill(".claude/skills/b.md", VALID_SKILL);
    const errors = await validateSkills(tmpDir, MANIFEST);
    expect(errors.some((e) => e.type === "SKILL_NAME_COLLISION")).toBe(true);
  });

  it("returns nothing when the backend has no skills support", async () => {
    const manifest: BackendManifest = {
      ...MANIFEST,
      supported_features: { ...MANIFEST.supported_features, skills: false },
    };
    writeSkill(".claude/skills/a.md", "garbage");
    expect(await validateSkills(tmpDir, manifest)).toEqual([]);
  });
});
