import { describe, expect, it } from "vitest";
import {
  FEATURE_MATRIX,
  type FeatureParity,
  type MigrationPlan,
  generateMigrationReport,
  getFeatureParityList,
  getTargetAgentsPath,
  getTargetRulesPath,
  getTargetSkillsPath,
} from "../../../src/dx/migrate.js";

describe("FEATURE_MATRIX", () => {
  it("has all 10 backends", () => {
    const backends = [
      "claude", "cursor", "codex", "pi", "kiro", "copilot",
      "gemini", "opendev", "antigravity", "generic",
    ];
    for (const b of backends) {
      expect(FEATURE_MATRIX[b]).toBeDefined();
    }
  });

  it("claude supports all 9 features", () => {
    const features = ["rules", "skills", "agents", "hooks", "settings", "commands", "mcp", "teams", "chains"];
    for (const f of features) {
      expect(FEATURE_MATRIX.claude[f]).toBe(true);
    }
  });

  it("cursor only supports rules and settings", () => {
    expect(FEATURE_MATRIX.cursor.rules).toBe(true);
    expect(FEATURE_MATRIX.cursor.settings).toBe(true);
    expect(FEATURE_MATRIX.cursor.skills).toBe(false);
    expect(FEATURE_MATRIX.cursor.agents).toBe(false);
    expect(FEATURE_MATRIX.cursor.hooks).toBe(false);
    expect(FEATURE_MATRIX.cursor.mcp).toBe(false);
  });

  it("kiro supports nothing", () => {
    for (const value of Object.values(FEATURE_MATRIX.kiro)) {
      expect(value).toBe(false);
    }
  });

  it("pi does not support rules", () => {
    expect(FEATURE_MATRIX.pi.rules).toBe(false);
    expect(FEATURE_MATRIX.pi.skills).toBe(true);
  });

  it("copilot only supports rules", () => {
    expect(FEATURE_MATRIX.copilot.rules).toBe(true);
    expect(FEATURE_MATRIX.copilot.skills).toBe(false);
    expect(FEATURE_MATRIX.copilot.mcp).toBe(false);
  });

  it("gemini does not support hooks or teams or chains", () => {
    expect(FEATURE_MATRIX.gemini.hooks).toBe(false);
    expect(FEATURE_MATRIX.gemini.teams).toBe(false);
    expect(FEATURE_MATRIX.gemini.chains).toBe(false);
  });

  it("generic supports all features", () => {
    const features = ["rules", "skills", "agents", "hooks", "settings", "commands", "mcp", "teams", "chains"];
    for (const f of features) {
      expect(FEATURE_MATRIX.generic[f]).toBe(true);
    }
  });
});

describe("generateMigrationReport", () => {
  const mockPlan: MigrationPlan = {
    source_backend: "claude",
    target_backend: "cursor",
    steps: [
      {
        action: "translate",
        source_file: ".claude/rules/*.md",
        target_file: ".cursor/rules/*.md",
        confidence: 0.95,
        note: "5 rules will be translated",
      },
      {
        action: "skip",
        source_file: ".claude/skills/*.md",
        target_file: "N/A",
        confidence: 1.0,
        note: "cursor does not support skills",
      },
    ],
    warnings: ["cursor does not support 'skills'", "cursor does not support 'hooks'"],
    manual_steps: ["Manually port skills to cursor rules"],
    feature_gaps: ["skills", "hooks", "agents"],
  };

  it("includes header with source and target backend", () => {
    const report = generateMigrationReport(mockPlan);
    expect(report).toContain("claude → cursor");
  });

  it("includes summary section", () => {
    const report = generateMigrationReport(mockPlan);
    expect(report).toContain("## Summary");
    expect(report).toContain("Files to Translate:** 1");
    expect(report).toContain("Warnings:** 2");
    expect(report).toContain("Manual Steps Required:** 1");
    expect(report).toContain("Feature Gaps:** 3");
  });

  it("includes feature gaps section", () => {
    const report = generateMigrationReport(mockPlan);
    expect(report).toContain("## Feature Gaps");
    expect(report).toContain("**skills**");
    expect(report).toContain("**hooks**");
    expect(report).toContain("**agents**");
  });

  it("includes migration steps table", () => {
    const report = generateMigrationReport(mockPlan);
    expect(report).toContain("## Migration Steps");
    expect(report).toContain("translate");
    expect(report).toContain("95%");
    expect(report).toContain("100%");
  });

  it("includes warnings section", () => {
    const report = generateMigrationReport(mockPlan);
    expect(report).toContain("## Warnings");
    expect(report).toContain("cursor does not support 'skills'");
  });

  it("includes manual steps section", () => {
    const report = generateMigrationReport(mockPlan);
    expect(report).toContain("## Manual Steps");
    expect(report).toContain("Manually port skills to cursor rules");
  });

  it("omits feature gaps section when no gaps", () => {
    const plan: MigrationPlan = { ...mockPlan, feature_gaps: [], warnings: [], manual_steps: [] };
    const report = generateMigrationReport(plan);
    expect(report).not.toContain("## Feature Gaps");
  });

  it("omits warnings section when no warnings", () => {
    const plan: MigrationPlan = { ...mockPlan, warnings: [] };
    const report = generateMigrationReport(plan);
    expect(report).not.toContain("## Warnings");
  });

  it("omits manual steps section when empty", () => {
    const plan: MigrationPlan = { ...mockPlan, manual_steps: [] };
    const report = generateMigrationReport(plan);
    expect(report).not.toContain("## Manual Steps");
  });

  it("uses correct action icons", () => {
    const report = generateMigrationReport(mockPlan);
    expect(report).toContain("✅");
    expect(report).toContain("⏭️");
  });
});

describe("getFeatureParityList", () => {
  it("returns parity list for claude → cursor", () => {
    const list = getFeatureParityList("claude", "cursor");
    expect(list.length).toBeGreaterThan(0);
    const rules = list.find((f) => f.feature === "rules");
    expect(rules?.source_supported).toBe(true);
    expect(rules?.target_supported).toBe(true);
    expect(rules?.mappable).toBe(true);
  });

  it("marks non-mappable features correctly", () => {
    const list = getFeatureParityList("claude", "cursor");
    const skills = list.find((f) => f.feature === "skills");
    expect(skills?.source_supported).toBe(true);
    expect(skills?.target_supported).toBe(false);
    expect(skills?.mappable).toBe(false);
  });

  it("returns all 9 feature keys", () => {
    const list = getFeatureParityList("claude", "codex");
    const features = list.map((f) => f.feature);
    expect(features).toContain("rules");
    expect(features).toContain("skills");
    expect(features).toContain("agents");
    expect(features).toContain("hooks");
    expect(features).toContain("mcp");
    expect(features).toContain("teams");
    expect(features).toContain("chains");
  });

  it("all features mappable for claude → codex", () => {
    const list = getFeatureParityList("claude", "codex");
    for (const item of list) {
      expect(item.mappable).toBe(true);
    }
  });
});

describe("getTargetRulesPath", () => {
  it("returns correct path for claude", () => {
    expect(getTargetRulesPath("claude")).toBe(".claude/rules/*.md");
  });

  it("returns correct path for cursor", () => {
    expect(getTargetRulesPath("cursor")).toBe(".cursor/rules/*.md");
  });

  it("returns correct path for copilot", () => {
    expect(getTargetRulesPath("copilot")).toBe(".github/copilot/instructions.md");
  });

  it("returns fallback for unknown backend", () => {
    expect(getTargetRulesPath("unknown")).toContain("rules");
  });
});

describe("getTargetSkillsPath", () => {
  it("returns correct path for claude", () => {
    expect(getTargetSkillsPath("claude")).toBe(".claude/skills/*.md");
  });

  it("returns correct path for codex", () => {
    expect(getTargetSkillsPath("codex")).toBe(".codex/skills/*.md");
  });

  it("returns fallback for unknown backend", () => {
    expect(getTargetSkillsPath("unknown")).toContain("skills");
  });
});

describe("getTargetAgentsPath", () => {
  it("returns correct path for claude", () => {
    expect(getTargetAgentsPath("claude")).toBe(".claude/agents/*.md");
  });

  it("returns correct path for pi", () => {
    expect(getTargetAgentsPath("pi")).toBe("pi/teams.yaml");
  });

  it("returns fallback for unknown backend", () => {
    expect(getTargetAgentsPath("unknown")).toContain("agents");
  });
});
