import { describe, expect, it } from "vitest";
import { diffPersona, diffRule, diffSkill } from "../../../src/ecosystem/diff.js";
import type { Persona, Rule, Skill } from "../../../src/translator/ir.js";

const rule: Rule = { id: "r1", scope: "src/**", severity: "hard", action: "do the thing" };
const skill: Skill = {
  name: "s1",
  description: "a skill",
  when_to_use: "always",
  tools_required: [],
  procedure: "step one\nstep two",
};
const persona: Persona = {
  name: "p1",
  role: "engineer",
  reasoning_style: "careful and precise",
  constraints: [],
};

describe("normalized diffing — cosmetic edits are ignored", () => {
  it("ignores whitespace-only changes to rule action", () => {
    expect(diffRule(rule, { ...rule, action: "do   the\tthing" })).toHaveLength(0);
  });

  it("ignores line-ending-only changes to skill procedure", () => {
    expect(diffSkill(skill, { ...skill, procedure: "step one\r\nstep two" })).toHaveLength(0);
  });

  it("ignores trailing-whitespace changes to persona reasoning_style", () => {
    expect(
      diffPersona(persona, { ...persona, reasoning_style: "careful and precise  " })
    ).toHaveLength(0);
  });
});

describe("normalized diffing — meaningful edits still surface", () => {
  it("detects a genuine rule action change", () => {
    expect(diffRule(rule, { ...rule, action: "do something else" })).toContain("action modified");
  });

  it("detects a genuine skill procedure change", () => {
    expect(diffSkill(skill, { ...skill, procedure: "completely different" })).toContain(
      "procedure modified"
    );
  });

  it("preserves case sensitivity for governance fidelity", () => {
    expect(diffRule(rule, { ...rule, action: "DO THE THING" })).toContain("action modified");
  });
});
