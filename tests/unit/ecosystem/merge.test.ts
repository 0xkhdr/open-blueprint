import { describe, expect, it } from "vitest";
import { formatMergeReport, threeWayMerge } from "../../../src/ecosystem/merge.js";
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

const ruleA: Rule = { id: "a", scope: "src/**/*", severity: "hard", action: "action A" };
const ruleB: Rule = { id: "b", scope: "tests/**/*", severity: "soft", action: "action B" };
const ruleC: Rule = { id: "c", scope: "lib/**/*", severity: "hard", action: "action C" };
const ruleAModified: Rule = { id: "a", scope: "src/**/*", severity: "hard", action: "action A v2" };
const ruleAModifiedLeft: Rule = {
  id: "a",
  scope: "src/**/*",
  severity: "soft",
  action: "action A left",
};

const skillX: Skill = {
  name: "x",
  description: "skill x",
  when_to_use: "always",
  procedure: "do x",
};
const skillY: Skill = {
  name: "y",
  description: "skill y",
  when_to_use: "sometimes",
  procedure: "do y",
};

describe("threeWayMerge - non-conflicting additions", () => {
  it("merges right-only addition into merged result", () => {
    const base = makeIR([ruleA]);
    const left = makeIR([ruleA]);
    const right = makeIR([ruleA, ruleB]);

    const result = threeWayMerge(base, left, right);
    expect(result.merged.rules.map((r) => r.id)).toContain("b");
    expect(result.autoResolved).toBeGreaterThan(0);
    expect(result.conflicts).toHaveLength(0);
  });

  it("preserves left-only changes", () => {
    const base = makeIR([ruleA]);
    const left = makeIR([ruleA, ruleC]);
    const right = makeIR([ruleA]);

    const result = threeWayMerge(base, left, right);
    expect(result.merged.rules.map((r) => r.id)).toContain("c");
  });

  it("merges both sides additions without conflict", () => {
    const base = makeIR([ruleA]);
    const left = makeIR([ruleA, ruleB]);
    const right = makeIR([ruleA, ruleC]);

    const result = threeWayMerge(base, left, right);
    const ids = result.merged.rules.map((r) => r.id);
    expect(ids).toContain("a");
    expect(ids).toContain("b");
    expect(ids).toContain("c");
    expect(result.conflicts).toHaveLength(0);
  });

  it("merges right skill addition", () => {
    const base = makeIR([], [skillX]);
    const left = makeIR([], [skillX]);
    const right = makeIR([], [skillX, skillY]);

    const result = threeWayMerge(base, left, right);
    const names = result.merged.skills.map((s) => s.name);
    expect(names).toContain("y");
    expect(result.conflicts).toHaveLength(0);
  });
});

describe("threeWayMerge - conflict detection", () => {
  it("detects conflict when both sides modify same field", () => {
    const base = makeIR([ruleA]);
    const left = makeIR([ruleAModifiedLeft]);
    const right = makeIR([ruleAModified]);

    const result = threeWayMerge(base, left, right);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("conflict has correct type and id", () => {
    const base = makeIR([ruleA]);
    const left = makeIR([ruleAModifiedLeft]);
    const right = makeIR([ruleAModified]);

    const result = threeWayMerge(base, left, right);
    const conflict = result.conflicts[0];
    expect(conflict?.type).toBe("rule");
    expect(conflict?.id).toBe("a");
  });

  it("conflict contains base, left, and right values", () => {
    const base = makeIR([ruleA]);
    const left = makeIR([ruleAModifiedLeft]);
    const right = makeIR([ruleAModified]);

    const result = threeWayMerge(base, left, right);
    const conflict = result.conflicts[0];
    expect(conflict?.base).toBeDefined();
    expect(conflict?.left).toBeDefined();
    expect(conflict?.right).toBeDefined();
  });
});

describe("threeWayMerge - auto-resolve", () => {
  it("auto-resolves right-only modification", () => {
    const base = makeIR([ruleA]);
    const left = makeIR([ruleA]);
    const right = makeIR([ruleAModified]);

    const result = threeWayMerge(base, left, right);
    expect(result.conflicts).toHaveLength(0);
    expect(result.autoResolved).toBeGreaterThan(0);
    const mergedA = result.merged.rules.find((r) => r.id === "a");
    expect(mergedA?.action).toBe("action A v2");
  });

  it("returns MergeResult with merged IR", () => {
    const base = makeIR([ruleA]);
    const left = makeIR([ruleA]);
    const right = makeIR([ruleA, ruleB]);

    const result = threeWayMerge(base, left, right);
    expect(result).toHaveProperty("merged");
    expect(result).toHaveProperty("conflicts");
    expect(result).toHaveProperty("autoResolved");
    expect(result.merged.spatial_anchor).toBeDefined();
  });
});

describe("threeWayMerge - identical inputs", () => {
  it("produces no conflicts for identical base/left/right", () => {
    const ir = makeIR([ruleA, ruleB]);
    const result = threeWayMerge(ir, ir, ir);
    expect(result.conflicts).toHaveLength(0);
  });
});

describe("formatMergeReport", () => {
  it("includes auto-resolved count", () => {
    const result = { merged: makeIR(), conflicts: [], autoResolved: 3 };
    const report = formatMergeReport(result);
    expect(report).toContain("Auto-resolved:** 3");
  });

  it("includes conflicts count", () => {
    const result = { merged: makeIR(), conflicts: [], autoResolved: 0 };
    const report = formatMergeReport(result);
    expect(report).toContain("Conflicts:** 0");
  });

  it("shows clean merge message when no conflicts", () => {
    const result = { merged: makeIR(), conflicts: [], autoResolved: 2 };
    const report = formatMergeReport(result);
    expect(report).toContain("Clean merge");
  });

  it("shows conflict details when conflicts exist", () => {
    const conflict = {
      type: "rule",
      id: "r1",
      base: { id: "r1" },
      left: { id: "r1", severity: "soft" },
      right: { id: "r1", severity: "hard" },
      field: "severity",
    };
    const result = { merged: makeIR(), conflicts: [conflict], autoResolved: 0 };
    const report = formatMergeReport(result);
    expect(report).toContain("Conflicts Requiring Manual Resolution");
    expect(report).toContain("r1");
    expect(report).toContain("severity");
  });

  it("returns a string", () => {
    const result = { merged: makeIR(), conflicts: [], autoResolved: 0 };
    expect(typeof formatMergeReport(result)).toBe("string");
  });
});
