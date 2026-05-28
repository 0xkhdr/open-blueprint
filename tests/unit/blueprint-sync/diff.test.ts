import { describe, it, expect } from "vitest";
import { BlueprintIR } from "../../../src/translator/ir";
import { diffBlueprints, BlueprintDiffer } from "../../../src/blueprint-sync/diff";

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

const modifiedBlueprint: BlueprintIR = {
  ...baseBlueprint,
  spatial_anchor: {
    ...baseBlueprint.spatial_anchor,
    project_name: "modified-project",
  },
  personas: [
    ...baseBlueprint.personas,
    {
      name: "Bob",
      role: "Manager",
      reasoning_style: "pragmatic",
      constraints: [],
    },
  ],
  rules: [
    {
      ...baseBlueprint.rules[0],
      action: "warn",
    },
  ],
  skills: [
    {
      name: "skill2",
      description: "New skill",
      when_to_use: "Sometimes",
      tools_required: ["tool2"],
      procedure: "Do something else",
    },
  ],
};

describe("BlueprintDiffer", () => {
  it("detects spatial anchor changes", () => {
    const report = diffBlueprints(baseBlueprint, modifiedBlueprint);
    expect(report.changes).toContainEqual(
      expect.objectContaining({
        op: "modify",
        path: "spatial_anchor.project_name",
        layer: "spatial_anchor",
        oldValue: "test-project",
        newValue: "modified-project",
      })
    );
  });

  it("detects added personas", () => {
    const report = diffBlueprints(baseBlueprint, modifiedBlueprint);
    expect(report.changes).toContainEqual(
      expect.objectContaining({
        op: "add",
        layer: "personas",
        itemId: "Bob",
      })
    );
  });

  it("detects removed items", () => {
    const removed: BlueprintIR = {
      ...baseBlueprint,
      skills: [],
    };
    const report = diffBlueprints(baseBlueprint, removed);
    expect(report.changes).toContainEqual(
      expect.objectContaining({
        op: "remove",
        layer: "skills",
        itemId: "skill1",
      })
    );
  });

  it("detects modified items", () => {
    const report = diffBlueprints(baseBlueprint, modifiedBlueprint);
    expect(report.changes).toContainEqual(
      expect.objectContaining({
        op: "modify",
        layer: "rules",
        itemId: "rule1",
      })
    );
  });

  it("generates correct summary", () => {
    const report = diffBlueprints(baseBlueprint, modifiedBlueprint);
    expect(report.summary).toMatchObject({
      added: expect.any(Number),
      removed: expect.any(Number),
      modified: expect.any(Number),
      reordered: expect.any(Number),
    });
  });

  it("computes checksums", () => {
    const report = diffBlueprints(baseBlueprint, modifiedBlueprint);
    expect(report.metadata.checksum_base).toHaveLength(8);
    expect(report.metadata.checksum_target).toHaveLength(8);
    expect(report.metadata.checksum_base).not.toEqual(
      report.metadata.checksum_target
    );
  });

  it("detects identical blueprints", () => {
    const report = diffBlueprints(baseBlueprint, baseBlueprint);
    expect(report.changes).toHaveLength(0);
    expect(report.metadata.compatible).toBe(true);
  });
});
