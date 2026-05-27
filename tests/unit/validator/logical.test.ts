import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { validateLogical } from "../../../src/validator/logical.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-logical-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("validateLogical", () => {
  let tmpDir: string;
  let rulesDir: string;
  let skillsDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    rulesDir = path.join(tmpDir, ".claude", "rules");
    skillsDir = path.join(tmpDir, ".claude", "skills");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.mkdirSync(skillsDir, { recursive: true });

    // Create actual files that scopes can match
    const srcDir = path.join(tmpDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, "index.ts"), "// code");
    fs.writeFileSync(path.join(srcDir, "utils.ts"), "// utils");
  });

  afterEach(() => cleanDir(tmpDir));

  describe("scope intersection", () => {
    it("emits RULE_CONFLICT_HARD when two hard rules overlap on same scope", async () => {
      const ruleA = path.join(rulesDir, "01-api.md");
      const ruleB = path.join(rulesDir, "02-legacy.md");

      fs.writeFileSync(
        ruleA,
        `---\nscope: "src/**"\nseverity: hard\naction: "All network calls must use internal httpClient"\n---\nContent A.\n`
      );
      fs.writeFileSync(
        ruleB,
        `---\nscope: "src/**"\nseverity: hard\naction: "Use raw fetch() for legacy bridge compatibility"\n---\nContent B.\n`
      );

      const errors = await validateLogical([ruleA, ruleB], { projectRoot: tmpDir });

      const conflicts = errors.filter((e) => e.type === "RULE_CONFLICT_HARD");
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]?.severity).toBe("error");
    });

    it("emits RULE_CONFLICT_SOFT (warning) when hard+soft rules overlap", async () => {
      const ruleA = path.join(rulesDir, "01-hard.md");
      const ruleB = path.join(rulesDir, "02-soft.md");

      fs.writeFileSync(
        ruleA,
        `---\nscope: "src/**"\nseverity: hard\naction: "Must use TypeScript strict mode"\n---\nHard rule.\n`
      );
      fs.writeFileSync(
        ruleB,
        `---\nscope: "src/**"\nseverity: soft\naction: "Prefer TypeScript strict mode"\n---\nSoft rule.\n`
      );

      const errors = await validateLogical([ruleA, ruleB], { projectRoot: tmpDir });

      const softConflicts = errors.filter((e) => e.type === "RULE_CONFLICT_SOFT");
      expect(softConflicts.length).toBeGreaterThan(0);
      expect(softConflicts[0]?.severity).toBe("warning");
    });

    it("no conflict when scopes do not overlap", async () => {
      const srcA = path.join(tmpDir, "backend");
      const srcB = path.join(tmpDir, "frontend");
      fs.mkdirSync(srcA, { recursive: true });
      fs.mkdirSync(srcB, { recursive: true });
      fs.writeFileSync(path.join(srcA, "server.ts"), "// server");
      fs.writeFileSync(path.join(srcB, "app.tsx"), "// app");

      const ruleA = path.join(rulesDir, "01-backend.md");
      const ruleB = path.join(rulesDir, "02-frontend.md");

      fs.writeFileSync(
        ruleA,
        `---\nscope: "backend/**"\nseverity: hard\naction: "Use Express patterns"\n---\nBackend rule.\n`
      );
      fs.writeFileSync(
        ruleB,
        `---\nscope: "frontend/**"\nseverity: hard\naction: "Use React patterns"\n---\nFrontend rule.\n`
      );

      const errors = await validateLogical([ruleA, ruleB], { projectRoot: tmpDir });

      expect(errors.filter((e) => e.type === "RULE_CONFLICT_HARD").length).toBe(0);
    });

    it("conflict report includes suggested resolutions", async () => {
      const ruleA = path.join(rulesDir, "01-a.md");
      const ruleB = path.join(rulesDir, "02-b.md");

      fs.writeFileSync(
        ruleA,
        `---\nscope: "src/**"\nseverity: hard\naction: "Must use axios"\n---\nContent.\n`
      );
      fs.writeFileSync(
        ruleB,
        `---\nscope: "src/**"\nseverity: hard\naction: "Must use fetch"\n---\nContent.\n`
      );

      const errors = await validateLogical([ruleA, ruleB], { projectRoot: tmpDir });
      const conflict = errors.find((e) => e.type === "RULE_CONFLICT_HARD");

      expect(conflict?.message).toContain("Suggested Resolutions");
      expect(conflict?.message).toContain("Rule A");
      expect(conflict?.message).toContain("Rule B");
    });
  });

  describe("semantic contradiction (antonym matching)", () => {
    it("detects must-use vs must-not-use contradiction", async () => {
      const ruleA = path.join(rulesDir, "01-allow.md");
      const ruleB = path.join(rulesDir, "02-deny.md");

      fs.writeFileSync(
        ruleA,
        `---\nscope: "src/api/**"\nseverity: soft\naction: "must use the internal client"\n---\nContent.\n`
      );
      fs.writeFileSync(
        ruleB,
        `---\nscope: "src/api/**"\nseverity: soft\naction: "must not use the internal client"\n---\nContent.\n`
      );

      const errors = await validateLogical([ruleA, ruleB], { projectRoot: tmpDir });

      expect(errors.some((e) => e.type === "SEMANTIC_CONTRADICTION")).toBe(true);
    });
  });

  describe("circular skill dependency (Tarjan SCC)", () => {
    it("detects circular dependency between two skills", async () => {
      const skillA = path.join(skillsDir, "skill-a.md");
      const skillB = path.join(skillsDir, "skill-b.md");

      fs.writeFileSync(
        skillA,
        `---\nname: skill-a\ndescription: Skill A\nuses:\n  - skill-b\n---\nContent A.\n`
      );
      fs.writeFileSync(
        skillB,
        `---\nname: skill-b\ndescription: Skill B\nuses:\n  - skill-a\n---\nContent B.\n`
      );

      const errors = await validateLogical([skillA, skillB], { projectRoot: tmpDir });

      expect(errors.some((e) => e.type === "CIRCULAR_SKILL_DEPENDENCY")).toBe(true);
    });

    it("no cycle when skills are acyclic", async () => {
      const skillA = path.join(skillsDir, "skill-base.md");
      const skillB = path.join(skillsDir, "skill-derived.md");

      fs.writeFileSync(
        skillA,
        `---\nname: skill-base\ndescription: Base skill\n---\nContent.\n`
      );
      fs.writeFileSync(
        skillB,
        `---\nname: skill-derived\ndescription: Derived skill\nuses:\n  - skill-base\n---\nContent.\n`
      );

      const errors = await validateLogical([skillA, skillB], { projectRoot: tmpDir });

      expect(errors.some((e) => e.type === "CIRCULAR_SKILL_DEPENDENCY")).toBe(false);
    });
  });

  describe("all errors include resolution path", () => {
    it("each error has a non-empty resolution field", async () => {
      const ruleA = path.join(rulesDir, "01-a.md");
      const ruleB = path.join(rulesDir, "02-b.md");

      fs.writeFileSync(ruleA, `---\nscope: "src/**"\nseverity: hard\naction: "must use X"\n---\nC.\n`);
      fs.writeFileSync(ruleB, `---\nscope: "src/**"\nseverity: hard\naction: "must not use X"\n---\nC.\n`);

      const errors = await validateLogical([ruleA, ruleB], { projectRoot: tmpDir });

      for (const err of errors) {
        expect(err.resolution).toBeTruthy();
        expect(err.resolution.length).toBeGreaterThan(5);
      }
    });
  });
});
