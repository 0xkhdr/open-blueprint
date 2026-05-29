import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  BUILTIN_RULE_PACKS,
  generateRuleMarkdown,
  generateSkillMarkdown,
  getRulePack,
  installRulePack,
  listAvailablePacks,
} from "../../../src/ecosystem/rule-library.js";

describe("BUILTIN_RULE_PACKS", () => {
  it("has gdpr, soc2, hipaa packs", () => {
    expect(BUILTIN_RULE_PACKS.gdpr).toBeDefined();
    expect(BUILTIN_RULE_PACKS.soc2).toBeDefined();
    expect(BUILTIN_RULE_PACKS.hipaa).toBeDefined();
  });

  it("gdpr has 5 rules", () => {
    expect(BUILTIN_RULE_PACKS.gdpr.rules).toHaveLength(5);
  });

  it("soc2 has 3 rules", () => {
    expect(BUILTIN_RULE_PACKS.soc2.rules).toHaveLength(3);
  });

  it("hipaa has 3 rules", () => {
    expect(BUILTIN_RULE_PACKS.hipaa.rules).toHaveLength(3);
  });

  it("gdpr has 1 skill", () => {
    expect(BUILTIN_RULE_PACKS.gdpr.skills).toHaveLength(1);
  });

  it("soc2 has 1 skill", () => {
    expect(BUILTIN_RULE_PACKS.soc2.skills).toHaveLength(1);
  });

  it("hipaa has 1 skill", () => {
    expect(BUILTIN_RULE_PACKS.hipaa.skills).toHaveLength(1);
  });

  it("each rule has required fields", () => {
    for (const pack of Object.values(BUILTIN_RULE_PACKS)) {
      for (const rule of pack.rules) {
        expect(rule.id).toBeTruthy();
        expect(rule.scope).toBeTruthy();
        expect(["hard", "soft"]).toContain(rule.severity);
        expect(rule.action).toBeTruthy();
        expect(rule.rationale).toBeTruthy();
        expect(Array.isArray(rule.tags)).toBe(true);
      }
    }
  });

  it("gdpr compliance mapping has 5 entries", () => {
    expect(BUILTIN_RULE_PACKS.gdpr.compliance_mapping).toHaveLength(5);
  });

  it("soc2 compliance mapping has 3 entries", () => {
    expect(BUILTIN_RULE_PACKS.soc2.compliance_mapping).toHaveLength(3);
  });

  it("gdpr rules include hard severity rules", () => {
    const hardRules = BUILTIN_RULE_PACKS.gdpr.rules.filter((r) => r.severity === "hard");
    expect(hardRules.length).toBeGreaterThan(0);
  });

  it("gdpr includes data-minimization rule", () => {
    const ids = BUILTIN_RULE_PACKS.gdpr.rules.map((r) => r.id);
    expect(ids).toContain("gdpr-data-minimization");
  });

  it("soc2 includes logical-access rule", () => {
    const ids = BUILTIN_RULE_PACKS.soc2.rules.map((r) => r.id);
    expect(ids).toContain("soc2-logical-access");
  });

  it("hipaa includes audit-controls rule", () => {
    const ids = BUILTIN_RULE_PACKS.hipaa.rules.map((r) => r.id);
    expect(ids).toContain("hipaa-audit-controls");
  });
});

describe("installRulePack", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-rule-pack-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws on unknown pack", () => {
    expect(() => installRulePack("unknown", tmpDir)).toThrow("Unknown rule pack");
  });

  it("throws and lists available packs for unknown framework", () => {
    expect(() => installRulePack("unknown", tmpDir)).toThrow(/gdpr|soc2|hipaa/);
  });

  it("installs gdpr: creates 5 rule files", () => {
    installRulePack("gdpr", tmpDir);
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
    expect(files).toHaveLength(5);
  });

  it("installs gdpr: creates 1 skill file", () => {
    installRulePack("gdpr", tmpDir);
    const skillsDir = path.join(tmpDir, ".claude", "skills");
    const files = fs.readdirSync(skillsDir).filter((f) => f.endsWith(".md"));
    expect(files).toHaveLength(1);
    expect(files[0]).toBe("gdpr-audit.md");
  });

  it("installs soc2: creates 3 rule files", () => {
    installRulePack("soc2", tmpDir);
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
    expect(files).toHaveLength(3);
  });

  it("installs hipaa: creates 3 rule files", () => {
    installRulePack("hipaa", tmpDir);
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    const files = fs.readdirSync(rulesDir).filter((f) => f.endsWith(".md"));
    expect(files).toHaveLength(3);
  });

  it("rule files contain yaml frontmatter", () => {
    installRulePack("soc2", tmpDir);
    const rulesDir = path.join(tmpDir, ".claude", "rules");
    const firstRule = fs.readdirSync(rulesDir).find((f) => f.endsWith(".md"))!;
    const content = fs.readFileSync(path.join(rulesDir, firstRule), "utf-8");
    expect(content).toContain("---");
    expect(content).toContain("scope:");
    expect(content).toContain("severity:");
  });

  it("skill files contain yaml frontmatter", () => {
    installRulePack("hipaa", tmpDir);
    const skillsDir = path.join(tmpDir, ".claude", "skills");
    const firstSkill = fs.readdirSync(skillsDir).find((f) => f.endsWith(".md"))!;
    const content = fs.readFileSync(path.join(skillsDir, firstSkill), "utf-8");
    expect(content).toContain("---");
    expect(content).toContain("name:");
    expect(content).toContain("description:");
  });

  it("creates .claude/rules directory if missing", () => {
    installRulePack("soc2", tmpDir);
    expect(fs.existsSync(path.join(tmpDir, ".claude", "rules"))).toBe(true);
  });

  it("creates .claude/skills directory if missing", () => {
    installRulePack("gdpr", tmpDir);
    expect(fs.existsSync(path.join(tmpDir, ".claude", "skills"))).toBe(true);
  });
});

describe("generateRuleMarkdown", () => {
  const sampleRule = {
    id: "test-rule",
    scope: "src/**/*",
    severity: "hard" as const,
    action: "Do something important",
    rationale: "Because compliance requires it",
    tags: ["test", "compliance"],
  };

  it("includes scope in frontmatter", () => {
    const md = generateRuleMarkdown(sampleRule);
    expect(md).toContain('scope: "src/**/*"');
  });

  it("includes severity in frontmatter", () => {
    const md = generateRuleMarkdown(sampleRule);
    expect(md).toContain("severity: hard");
  });

  it("includes tags in frontmatter", () => {
    const md = generateRuleMarkdown(sampleRule);
    expect(md).toContain('"test"');
    expect(md).toContain('"compliance"');
  });

  it("includes rule id as heading", () => {
    const md = generateRuleMarkdown(sampleRule);
    expect(md).toContain("# test-rule");
  });

  it("includes action text", () => {
    const md = generateRuleMarkdown(sampleRule);
    expect(md).toContain("Do something important");
  });

  it("includes rationale section", () => {
    const md = generateRuleMarkdown(sampleRule);
    expect(md).toContain("## Rationale");
    expect(md).toContain("Because compliance requires it");
  });
});

describe("generateSkillMarkdown", () => {
  const sampleSkill = {
    name: "test-skill",
    description: "A skill for testing",
    when_to_use: "During testing",
  };

  it("includes name in frontmatter", () => {
    const md = generateSkillMarkdown(sampleSkill);
    expect(md).toContain('"test-skill"');
  });

  it("includes description in frontmatter", () => {
    const md = generateSkillMarkdown(sampleSkill);
    expect(md).toContain('"A skill for testing"');
  });

  it("includes when_to_use in frontmatter", () => {
    const md = generateSkillMarkdown(sampleSkill);
    expect(md).toContain('"During testing"');
  });

  it("includes skill name as heading", () => {
    const md = generateSkillMarkdown(sampleSkill);
    expect(md).toContain("# test-skill");
  });
});

describe("listAvailablePacks", () => {
  it("returns gdpr, soc2, hipaa", () => {
    const packs = listAvailablePacks();
    expect(packs).toContain("gdpr");
    expect(packs).toContain("soc2");
    expect(packs).toContain("hipaa");
  });

  it("returns array of strings", () => {
    const packs = listAvailablePacks();
    expect(Array.isArray(packs)).toBe(true);
    for (const p of packs) {
      expect(typeof p).toBe("string");
    }
  });
});

describe("getRulePack", () => {
  it("returns gdpr pack", () => {
    const pack = getRulePack("gdpr");
    expect(pack).toBeDefined();
    expect(pack?.framework).toBe("gdpr");
  });

  it("returns undefined for unknown pack", () => {
    expect(getRulePack("unknown")).toBeUndefined();
  });
});
