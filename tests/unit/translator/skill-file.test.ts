import { describe, expect, it } from "vitest";
import type { Skill } from "../../../src/translator/ir.js";
import {
  parseSkillMarkdown,
  renderSkillMarkdown,
  skillFileName,
  skillId,
  slugifySkillName,
} from "../../../src/translator/skill-file.js";

const FULL_SKILL: Skill = {
  name: "deploy-check",
  description: "Verify a deployment is healthy",
  when_to_use: "After every production deploy",
  tools_required: ["read_file", "run_command", "mcp:datadog"],
  procedure: "## Procedure\n\n1. Check the health endpoint.\n2. Tail the error logs.",
  disable_model_invocation: true,
  id: "deploy-check",
  risk: "high",
};

describe("slugifySkillName / skillId", () => {
  it("slugs arbitrary names", () => {
    expect(slugifySkillName("Add Integration Test!")).toBe("add-integration-test");
    expect(slugifySkillName("already-slugged")).toBe("already-slugged");
  });

  it("prefers an explicit id", () => {
    expect(skillId({ name: "Fancy Name", id: "fancy" })).toBe("fancy");
    expect(skillId({ name: "Fancy Name" })).toBe("fancy-name");
  });

  it("derives the file name from the id", () => {
    expect(skillFileName(FULL_SKILL)).toBe("deploy-check.md");
  });
});

describe("renderSkillMarkdown / parseSkillMarkdown", () => {
  it("round-trips every SkillSchema field", () => {
    const rendered = renderSkillMarkdown(FULL_SKILL);
    const parsed = parseSkillMarkdown(rendered, "fallback");
    expect(parsed).toEqual(FULL_SKILL);
  });

  it("omits optional fields that are absent", () => {
    const minimal: Skill = {
      name: "minimal",
      description: "d",
      when_to_use: "w",
      tools_required: [],
      procedure: "1. step",
    };
    const rendered = renderSkillMarkdown(minimal);
    expect(rendered).not.toContain("risk:");
    expect(rendered).not.toContain("disable_model_invocation:");
    expect(parseSkillMarkdown(rendered, "fallback")).toEqual(minimal);
  });

  it("handles descriptions with YAML-hostile characters", () => {
    const tricky: Skill = {
      ...FULL_SKILL,
      description: 'Contains "quotes", colons: and #hashes',
    };
    const parsed = parseSkillMarkdown(renderSkillMarkdown(tricky), "fallback");
    expect(parsed.description).toBe(tricky.description);
  });

  it("carries extra provenance frontmatter without touching the Skill shape", () => {
    const rendered = renderSkillMarkdown(FULL_SKILL, { pack_id: "acme", bp_source: "scaffolded" });
    expect(rendered).toContain("pack_id: acme");
    expect(parseSkillMarkdown(rendered, "fallback")).toEqual(FULL_SKILL);
  });

  it("falls back to the provided name when frontmatter has none", () => {
    const parsed = parseSkillMarkdown("just a body", "from-filename");
    expect(parsed.name).toBe("from-filename");
    expect(parsed.procedure).toBe("just a body");
  });
});
