import { describe, expect, it } from "vitest";
import {
  type BlueprintDiff,
  diffBlueprints,
  diffPersona,
  diffRule,
  diffSkill,
  formatDiffReport,
} from "../../../src/ecosystem/diff.js";
import type { BlueprintIR, Persona, Rule, Skill } from "../../../src/translator/ir.js";

const baseAnchor = {
  project_name: "test",
  surface: "claude",
  temporal_anchor: "2026-01-01",
  conventions: [],
};

function makeIR(
  rules: Rule[] = [],
  skills: Skill[] = [],
  personas: Persona[] = []
): BlueprintIR {
  return {
    spatial_anchor: baseAnchor,
    personas,
    rules,
    skills,
    hooks: [],
    meta: {},
  };
}

const rule1: Rule = { id: "r1", scope: "src/**/*", severity: "hard", action: "do A" };
const rule2: Rule = { id: "r2", scope: "tests/**/*", severity: "soft", action: "do B" };
const rule1Modified: Rule = { id: "r1", scope: "lib/**/*", severity: "hard", action: "do A" };

const skill1: Skill = {
  name: "s1",
  description: "skill one",
  when_to_use: "always",
  procedure: "do it",
};
const skill2: Skill = {
  name: "s2",
  description: "skill two",
  when_to_use: "sometimes",
  procedure: "do it",
};
const skill1Modified: Skill = {
  name: "s1",
  description: "skill one updated",
  when_to_use: "always",
  procedure: "do it differently",
};

const persona1: Persona = {
  name: "p1",
  role: "engineer",
  reasoning_style: "analytical",
  constraints: [],
};
const persona2: Persona = {
  name: "p2",
  role: "reviewer",
  reasoning_style: "critical",
  constraints: [],
};
const persona1Modified: Persona = {
  name: "p1",
  role: "senior-engineer",
  reasoning_style: "analytical",
  constraints: [],
};

describe("diffBlueprints - rules", () => {
  it("detects added rule", () => {
    const left = makeIR([rule1]);
    const right = makeIR([rule1, rule2]);
    const diff = diffBlueprints(left, right);
    expect(diff.added).toHaveLength(1);
    expect(diff.added[0].id).toBe("r2");
    expect(diff.added[0].type).toBe("rule");
  });

  it("detects removed rule", () => {
    const left = makeIR([rule1, rule2]);
    const right = makeIR([rule1]);
    const diff = diffBlueprints(left, right);
    expect(diff.removed).toHaveLength(1);
    expect(diff.removed[0].id).toBe("r2");
  });

  it("detects modified rule", () => {
    const left = makeIR([rule1]);
    const right = makeIR([rule1Modified]);
    const diff = diffBlueprints(left, right);
    expect(diff.modified).toHaveLength(1);
    expect(diff.modified[0].id).toBe("r1");
    expect(diff.modified[0].changes).toContain('scope: "src/**/*" → "lib/**/*"');
  });

  it("detects unchanged rule", () => {
    const left = makeIR([rule1]);
    const right = makeIR([rule1]);
    const diff = diffBlueprints(left, right);
    expect(diff.unchanged).toHaveLength(1);
    expect(diff.unchanged[0].id).toBe("r1");
  });

  it("handles empty both sides", () => {
    const diff = diffBlueprints(makeIR(), makeIR());
    expect(diff.added).toHaveLength(0);
    expect(diff.removed).toHaveLength(0);
    expect(diff.modified).toHaveLength(0);
    expect(diff.unchanged).toHaveLength(0);
  });
});

describe("diffBlueprints - skills", () => {
  it("detects added skill", () => {
    const left = makeIR([], [skill1]);
    const right = makeIR([], [skill1, skill2]);
    const diff = diffBlueprints(left, right);
    expect(diff.added.filter((x) => x.type === "skill")).toHaveLength(1);
    expect(diff.added.find((x) => x.type === "skill")?.id).toBe("s2");
  });

  it("detects removed skill", () => {
    const left = makeIR([], [skill1, skill2]);
    const right = makeIR([], [skill1]);
    const diff = diffBlueprints(left, right);
    const removed = diff.removed.filter((x) => x.type === "skill");
    expect(removed).toHaveLength(1);
    expect(removed[0].id).toBe("s2");
  });

  it("detects modified skill", () => {
    const left = makeIR([], [skill1]);
    const right = makeIR([], [skill1Modified]);
    const diff = diffBlueprints(left, right);
    const modified = diff.modified.filter((x) => x.type === "skill");
    expect(modified).toHaveLength(1);
    expect(modified[0].changes).toContain("description modified");
  });
});

describe("diffBlueprints - personas", () => {
  it("detects added persona", () => {
    const left = makeIR([], [], [persona1]);
    const right = makeIR([], [], [persona1, persona2]);
    const diff = diffBlueprints(left, right);
    const added = diff.added.filter((x) => x.type === "persona");
    expect(added).toHaveLength(1);
    expect(added[0].id).toBe("p2");
  });

  it("detects removed persona", () => {
    const left = makeIR([], [], [persona1, persona2]);
    const right = makeIR([], [], [persona1]);
    const diff = diffBlueprints(left, right);
    const removed = diff.removed.filter((x) => x.type === "persona");
    expect(removed).toHaveLength(1);
    expect(removed[0].id).toBe("p2");
  });

  it("detects modified persona", () => {
    const left = makeIR([], [], [persona1]);
    const right = makeIR([], [], [persona1Modified]);
    const diff = diffBlueprints(left, right);
    const modified = diff.modified.filter((x) => x.type === "persona");
    expect(modified).toHaveLength(1);
    expect(modified[0].changes).toContain("role: engineer → senior-engineer");
  });
});

describe("diffRule", () => {
  it("detects scope change", () => {
    const changes = diffRule(rule1, { ...rule1, scope: "lib/**/*" });
    expect(changes).toContain('scope: "src/**/*" → "lib/**/*"');
  });

  it("detects severity change", () => {
    const changes = diffRule(rule1, { ...rule1, severity: "soft" });
    expect(changes).toContain("severity: hard → soft");
  });

  it("detects action change", () => {
    const changes = diffRule(rule1, { ...rule1, action: "do B" });
    expect(changes).toContain("action modified");
  });

  it("detects tag addition", () => {
    const changes = diffRule({ ...rule1, tags: ["a"] }, { ...rule1, tags: ["a", "b"] });
    expect(changes).toContain("tags added: b");
  });

  it("detects tag removal", () => {
    const changes = diffRule({ ...rule1, tags: ["a", "b"] }, { ...rule1, tags: ["a"] });
    expect(changes).toContain("tags removed: b");
  });

  it("returns empty for identical rules", () => {
    expect(diffRule(rule1, { ...rule1 })).toHaveLength(0);
  });
});

describe("diffSkill", () => {
  it("detects description change", () => {
    const changes = diffSkill(skill1, { ...skill1, description: "updated" });
    expect(changes).toContain("description modified");
  });

  it("detects when_to_use change", () => {
    const changes = diffSkill(skill1, { ...skill1, when_to_use: "never" });
    expect(changes).toContain("when_to_use modified");
  });

  it("detects tool addition", () => {
    const changes = diffSkill(
      { ...skill1, tools_required: ["Read"] },
      { ...skill1, tools_required: ["Read", "Edit"] }
    );
    expect(changes).toContain("tools added: Edit");
  });

  it("detects tool removal", () => {
    const changes = diffSkill(
      { ...skill1, tools_required: ["Read", "Edit"] },
      { ...skill1, tools_required: ["Read"] }
    );
    expect(changes).toContain("tools removed: Edit");
  });

  it("returns empty for identical skills", () => {
    expect(diffSkill(skill1, { ...skill1 })).toHaveLength(0);
  });
});

describe("diffPersona", () => {
  it("detects role change", () => {
    const changes = diffPersona(persona1, { ...persona1, role: "senior" });
    expect(changes).toContain("role: engineer → senior");
  });

  it("detects reasoning_style change", () => {
    const changes = diffPersona(persona1, { ...persona1, reasoning_style: "creative" });
    expect(changes).toContain("reasoning_style modified");
  });

  it("detects tool addition", () => {
    const changes = diffPersona(
      { ...persona1, allowed_tools: ["Read"] },
      { ...persona1, allowed_tools: ["Read", "Edit"] }
    );
    expect(changes).toContain("tools added: Edit");
  });

  it("returns empty for identical personas", () => {
    expect(diffPersona(persona1, { ...persona1 })).toHaveLength(0);
  });
});

describe("formatDiffReport", () => {
  const diff: BlueprintDiff = {
    added: [{ type: "rule", id: "r-new", value: rule2 }],
    removed: [{ type: "skill", id: "s-old", oldValue: skill2 }],
    modified: [{ type: "persona", id: "p1", oldValue: persona1, newValue: persona1Modified, changes: ["role: engineer → senior-engineer"] }],
    unchanged: [{ type: "rule", id: "r1" }],
  };

  it("includes summary section", () => {
    const report = formatDiffReport(diff);
    expect(report).toContain("## Summary");
    expect(report).toContain("Added:** 1");
    expect(report).toContain("Removed:** 1");
    expect(report).toContain("Modified:** 1");
    expect(report).toContain("Unchanged:** 1");
  });

  it("includes added section", () => {
    const report = formatDiffReport(diff);
    expect(report).toContain("## Added");
    expect(report).toContain("r-new");
  });

  it("includes removed section", () => {
    const report = formatDiffReport(diff);
    expect(report).toContain("## Removed");
    expect(report).toContain("s-old");
  });

  it("includes modified section with changes", () => {
    const report = formatDiffReport(diff);
    expect(report).toContain("## Modified");
    expect(report).toContain("role: engineer → senior-engineer");
  });

  it("omits added section when empty", () => {
    const emptyDiff: BlueprintDiff = { ...diff, added: [] };
    const report = formatDiffReport(emptyDiff);
    expect(report).not.toContain("## Added");
  });

  it("returns string", () => {
    expect(typeof formatDiffReport(diff)).toBe("string");
  });
});
