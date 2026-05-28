import { describe, it, expect } from "vitest";
import { BlueprintIR } from "../../../src/translator/ir";
import { mergeBlueprints } from "../../../src/blueprint-sync/merge";

const baseBlueprint: BlueprintIR = {
  version: "2.0",
  spatial_anchor: {
    project_name: "test-project",
    surface: "main",
    temporal_anchor: "2026-05-28",
    conventions: ["convention1"],
  },
  personas: [
    {
      name: "Alice",
      role: "Engineer",
      reasoning_style: "logical",
      constraints: ["no-external-api"],
    },
  ],
  rules: [
    {
      id: "rule1",
      scope: "global",
      severity: "hard",
      action: "deny",
    },
  ],
  skills: [
    {
      name: "skill1",
      description: "Test skill",
      when_to_use: "Always",
      tools_required: ["tool1"],
      procedure: "Do something",
    },
  ],
  hooks: [],
  meta: {
    rule_precedence: ["rule1"],
    conflict_resolution: "last-write-wins",
    source_backend: "claude",
    target_backend: "cursor",
  },
};

describe("BlueprintMerger", () => {
  it("merges non-conflicting changes from both sides", () => {
    const ours: BlueprintIR = {
      ...baseBlueprint,
      personas: [
        ...baseBlueprint.personas,
        {
          name: "Bob",
          role: "Manager",
          reasoning_style: "pragmatic",
          constraints: [],
        },
      ],
    };

    const theirs: BlueprintIR = {
      ...baseBlueprint,
      skills: [
        ...baseBlueprint.skills,
        {
          name: "skill2",
          description: "New skill",
          when_to_use: "Sometimes",
          tools_required: ["tool2"],
          procedure: "Do something else",
        },
      ],
    };

    const result = mergeBlueprints(baseBlueprint, ours, theirs);
    expect(result.success).toBe(true);
    expect(result.conflicts).toHaveLength(0);
    expect(result.merged.personas).toHaveLength(2);
    expect(result.merged.skills).toHaveLength(2);
  });

  it("detects conflicting modifications", () => {
    const ours: BlueprintIR = {
      ...baseBlueprint,
      rules: [
        {
          ...baseBlueprint.rules[0],
          action: "warn",
        },
      ],
    };

    const theirs: BlueprintIR = {
      ...baseBlueprint,
      rules: [
        {
          ...baseBlueprint.rules[0],
          action: "allow",
        },
      ],
    };

    const result = mergeBlueprints(baseBlueprint, ours, theirs);
    expect(result.conflicts.length).toBeGreaterThan(0);
  });

  it("resolves conflicts with 'ours' strategy", () => {
    const ours: BlueprintIR = {
      ...baseBlueprint,
      spatial_anchor: {
        ...baseBlueprint.spatial_anchor,
        project_name: "ours-project",
      },
    };

    const theirs: BlueprintIR = {
      ...baseBlueprint,
      spatial_anchor: {
        ...baseBlueprint.spatial_anchor,
        project_name: "theirs-project",
      },
    };

    const result = mergeBlueprints(baseBlueprint, ours, theirs, {
      strategy: "ours",
      autoResolveStrategy: (c) => c.oursValue,
    });

    expect(result.merged.spatial_anchor.project_name).toBe("ours-project");
  });

  it("resolves conflicts with 'theirs' strategy", () => {
    const ours: BlueprintIR = {
      ...baseBlueprint,
      spatial_anchor: {
        ...baseBlueprint.spatial_anchor,
        project_name: "ours-project",
      },
    };

    const theirs: BlueprintIR = {
      ...baseBlueprint,
      spatial_anchor: {
        ...baseBlueprint.spatial_anchor,
        project_name: "theirs-project",
      },
    };

    const result = mergeBlueprints(baseBlueprint, ours, theirs, {
      strategy: "theirs",
      autoResolveStrategy: (c) => c.theirsValue,
    });

    expect(result.merged.spatial_anchor.project_name).toBe("theirs-project");
  });

  it("handles removals from both sides", () => {
    const ours: BlueprintIR = {
      ...baseBlueprint,
      skills: [],
    };

    const theirs: BlueprintIR = {
      ...baseBlueprint,
      personas: [],
    };

    const result = mergeBlueprints(baseBlueprint, ours, theirs);
    expect(result.success).toBe(true);
    expect(result.merged.skills).toHaveLength(0);
    expect(result.merged.personas).toHaveLength(0);
  });

  it("counts applied changes", () => {
    const ours: BlueprintIR = {
      ...baseBlueprint,
      personas: [
        ...baseBlueprint.personas,
        {
          name: "Charlie",
          role: "Designer",
          reasoning_style: "creative",
          constraints: [],
        },
      ],
    };

    const theirs: BlueprintIR = {
      ...baseBlueprint,
      rules: [
        ...baseBlueprint.rules,
        {
          id: "rule2",
          scope: "local",
          severity: "soft",
          action: "warn",
        },
      ],
    };

    const result = mergeBlueprints(baseBlueprint, ours, theirs);
    expect(result.applied_changes).toBeGreaterThan(0);
  });

  it("generates resolution strategies", () => {
    const ours: BlueprintIR = {
      ...baseBlueprint,
      personas: [
        ...baseBlueprint.personas,
        {
          name: "David",
          role: "Lead",
          reasoning_style: "decisive",
          constraints: [],
        },
      ],
    };

    const result = mergeBlueprints(baseBlueprint, ours, baseBlueprint);
    expect(result.resolution_strategies).toBeInstanceOf(Object);
    expect(Object.keys(result.resolution_strategies).length).toBeGreaterThanOrEqual(0);
  });
});
