import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import matter from "gray-matter";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadManifest } from "../../../src/templater/manifest.js";
import type { BackendManifest } from "../../../src/templater/selector.js";
import type { BlueprintIR, Rule, Skill } from "../../../src/translator/ir.js";
import {
  emitBlueprintFiles,
  patternToDir,
  serializeRule,
  serializeSkill,
  slugify,
} from "../../../src/translator/serialize.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-serialize-test-"));
}

const rule: Rule = {
  id: "no-secrets",
  scope: "src/**/*",
  severity: "hard",
  action: "Never commit secrets",
  rationale: "Leaks are costly",
  tags: ["security"],
};

const skill: Skill = {
  name: "Run Tests",
  description: "Execute the test suite",
  when_to_use: "Before every commit",
  tools_required: ["Bash"],
  procedure: "Run `npm test` and fix failures.",
};

function makeIR(rules: Rule[] = [], skills: Skill[] = []): BlueprintIR {
  return {
    spatial_anchor: { project_name: "t", surface: "", temporal_anchor: "", conventions: [] },
    personas: [],
    rules,
    skills,
    hooks: [],
    meta: {},
  };
}

function manifestWith(rules: string, skills: string): BackendManifest {
  return { file_patterns: { rules, skills } } as unknown as BackendManifest;
}

describe("slugify", () => {
  it("lowercases and replaces unsafe characters", () => {
    expect(slugify("Run Tests!")).toBe("run-tests");
  });
  it("strips path separators (traversal safety)", () => {
    expect(slugify("../../etc/passwd")).toBe("etc-passwd");
  });
  it("collapses repeated separators and trims them", () => {
    expect(slugify("  --A__B--  ")).toBe("a__b");
  });
  it("falls back to 'untitled' for empty results", () => {
    expect(slugify("///")).toBe("untitled");
  });
});

describe("patternToDir", () => {
  it("splits a glob into directory and extension", () => {
    expect(patternToDir(".claude/rules/*.md")).toEqual({ dir: ".claude/rules", ext: ".md" });
  });
  it("handles compound extensions", () => {
    expect(patternToDir(".github/prompts/*.prompt.md")).toEqual({
      dir: ".github/prompts",
      ext: ".prompt.md",
    });
  });
});

describe("serializeRule", () => {
  it("round-trips rule fields through frontmatter", () => {
    const parsed = matter(serializeRule(rule));
    expect(parsed.data.id).toBe(rule.id);
    expect(parsed.data.scope).toBe(rule.scope);
    expect(parsed.data.severity).toBe(rule.severity);
    expect(parsed.data.action).toBe(rule.action);
    expect(parsed.data.rationale).toBe(rule.rationale);
    expect(parsed.data.tags).toEqual(rule.tags);
  });

  it("omits optional fields when absent", () => {
    const minimal: Rule = { id: "r", scope: "**", severity: "soft", action: "do" };
    const parsed = matter(serializeRule(minimal));
    expect(parsed.data.rationale).toBeUndefined();
    expect(parsed.data.tags).toBeUndefined();
  });
});

describe("serializeSkill", () => {
  it("round-trips skill fields, with procedure as the body", () => {
    const parsed = matter(serializeSkill(skill));
    expect(parsed.data.name).toBe(skill.name);
    expect(parsed.data.description).toBe(skill.description);
    expect(parsed.data.when_to_use).toBe(skill.when_to_use);
    expect(parsed.data.tools_required).toEqual(skill.tools_required);
    expect(parsed.content.trim()).toBe(skill.procedure);
  });

  it("omits empty tools_required", () => {
    const s: Skill = { ...skill, tools_required: [] };
    expect(matter(serializeSkill(s)).data.tools_required).toBeUndefined();
  });
});

describe("emitBlueprintFiles", () => {
  let dir: string;
  beforeEach(() => {
    dir = createTmpDir();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("writes rules and skills to the backend's canonical locations", async () => {
    const result = await emitBlueprintFiles(
      makeIR([rule], [skill]),
      dir,
      manifestWith(".claude/rules/*.md", ".claude/skills/*.md")
    );
    expect(result.files.map((f) => f.action)).toEqual(["created", "created"]);
    expect(fs.existsSync(path.join(dir, ".claude/rules/no-secrets.md"))).toBe(true);
    expect(fs.existsSync(path.join(dir, ".claude/skills/run-tests.md"))).toBe(true);
  });

  it("records emitted files in the ownership manifest", async () => {
    await emitBlueprintFiles(
      makeIR([rule], []),
      dir,
      manifestWith(".claude/rules/*.md", ".claude/skills/*.md")
    );
    const manifest = await loadManifest(dir);
    expect(manifest?.files[".claude/rules/no-secrets.md"]?.origin).toBe("generated");
  });

  it("does not write to disk in dry-run mode", async () => {
    const result = await emitBlueprintFiles(
      makeIR([rule], []),
      dir,
      manifestWith(".claude/rules/*.md", ".claude/skills/*.md"),
      { dryRun: true }
    );
    expect(result.files[0]?.action).toBe("dry-run");
    expect(fs.existsSync(path.join(dir, ".claude/rules/no-secrets.md"))).toBe(false);
    expect(await loadManifest(dir)).toBeNull();
  });

  it("is idempotent: re-emitting identical content skips", async () => {
    const m = manifestWith(".claude/rules/*.md", ".claude/skills/*.md");
    await emitBlueprintFiles(makeIR([rule], []), dir, m);
    const second = await emitBlueprintFiles(makeIR([rule], []), dir, m);
    expect(second.files[0]?.action).toBe("skipped");
  });
});
