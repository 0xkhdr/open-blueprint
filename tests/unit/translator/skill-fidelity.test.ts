import { describe, expect, it } from "vitest";
import { compareSkillFidelity, roundTripSkill } from "../../../src/translator/fidelity.js";
import type { Skill } from "../../../src/translator/ir.js";

const FIXTURE_SKILL: Skill = {
  name: "add-integration-test",
  description: "Add an integration test for an HTTP endpoint",
  when_to_use: "When a new endpoint lacks integration coverage",
  tools_required: ["read_file", "write_file", "run_tests"],
  procedure:
    "## Procedure\n\n1. Locate the route handler.\n2. Write a request/response test.\n3. Run the suite.",
  disable_model_invocation: false,
  id: "add-integration-test",
  risk: "low",
};

describe("roundTripSkill (spec §6: parse→IR→render preserves SkillSchema fields)", () => {
  for (const backend of ["claude", "cursor", "generic"]) {
    it(`is lossless through the '${backend}' adapter`, async () => {
      const result = await roundTripSkill(FIXTURE_SKILL, backend);
      expect(result.warnings).toEqual([]);
      expect(result.skill).toBeDefined();
      expect(result.skill?.tools_required).toEqual(FIXTURE_SKILL.tools_required);
      expect(result.skill?.risk).toBe("low");
      expect(result.skill?.disable_model_invocation).toBe(false);
    });
  }
});

describe("compareSkillFidelity (silent drops are impossible)", () => {
  it("flags a dropped field explicitly", () => {
    const { risk: _risk, ...withoutRisk } = FIXTURE_SKILL;
    const warnings = compareSkillFidelity(FIXTURE_SKILL, withoutRisk as Skill, "some-backend");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.field).toBe("risk");
    expect(warnings[0]?.message).toContain("dropped");
  });

  it("flags a mutated field explicitly", () => {
    const mutated: Skill = { ...FIXTURE_SKILL, tools_required: ["read_file"] };
    const warnings = compareSkillFidelity(FIXTURE_SKILL, mutated, "some-backend");
    expect(warnings.some((w) => w.field === "tools_required")).toBe(true);
  });

  it("flags a skill the backend dropped entirely", () => {
    const warnings = compareSkillFidelity(FIXTURE_SKILL, undefined, "some-backend");
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.message).toContain("dropped it entirely");
  });

  it("does not warn when optional fields were absent on the source", () => {
    const minimal: Skill = {
      name: "m",
      description: "d",
      when_to_use: "w",
      tools_required: [],
      procedure: "1. step",
    };
    expect(compareSkillFidelity(minimal, { ...minimal }, "b")).toEqual([]);
  });
});
