import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detect } from "../../src/detector/index.js";
import { runTemplater } from "../../src/templater/index.js";
import { runValidator } from "../../src/validator/index.js";
import { resolveTemplatePack } from "../../src/templater/selector.js";

const FIXTURE_DIR = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../fixtures"
);

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-integration-"));
}

async function runBlueprintInit(
  fixtureDir: string,
  outputDir: string
): Promise<{ fingerprint: Awaited<ReturnType<typeof detect>>; result: Awaited<ReturnType<typeof runTemplater>> }> {
  const fingerprint = await detect(fixtureDir);
  const result = await runTemplater(fingerprint, outputDir, {
    backend: "claude",
    dryRun: false,
    force: false,
  });
  return { fingerprint, result };
}

describe("bp init integration", () => {
  describe("node-express fixture", () => {
    let outputDir: string;
    const fixtureDir = path.join(FIXTURE_DIR, "node-express");

    beforeEach(() => {
      outputDir = createTmpDir();
    });

    afterEach(() => {
      fs.rmSync(outputDir, { recursive: true, force: true });
    });

    it("detects TypeScript + Express correctly", async () => {
      const fingerprint = await detect(fixtureDir);
      expect(fingerprint.languages.some((l) => l.name === "typescript" && l.primary)).toBe(true);
      expect(fingerprint.frameworks.some((f) => f.name === "express")).toBe(true);
      expect(fingerprint.tooling.test_runner).toBe("jest");
      expect(fingerprint.tooling.package_manager).toBe("npm");
    });

    it("generates CLAUDE.md with project name", async () => {
      const { result } = await runBlueprintInit(fixtureDir, outputDir);
      const claudeMdPath = path.join(outputDir, "CLAUDE.md");
      expect(fs.existsSync(claudeMdPath)).toBe(true);
      const content = fs.readFileSync(claudeMdPath, "utf-8");
      expect(content).toContain("node-express-fixture");
    });

    it("generates all 5 blueprint layers", async () => {
      await runBlueprintInit(fixtureDir, outputDir);
      expect(fs.existsSync(path.join(outputDir, "CLAUDE.md"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, ".claude/agents/planner.md"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, ".claude/agents/implementer.md"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, ".claude/agents/reviewer.md"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, ".claude/rules/01-position.md"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, ".claude/rules/02-security.md"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, ".claude/rules/03-style.md"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, ".claude/rules/04-meta.md"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, ".claude/skills/add-test.md"))).toBe(true);
      expect(fs.existsSync(path.join(outputDir, ".claude/skills/refactor-async.md"))).toBe(true);
    });

    it("passes structural validation after init", async () => {
      const { fingerprint } = await runBlueprintInit(fixtureDir, outputDir);
      const pack = resolveTemplatePack(fingerprint, "claude");
      const result = await runValidator({
        level: "structural",
        projectRoot: outputDir,
        manifest: pack.manifest,
      });
      const errors = result.errors;
      if (errors.length > 0) {
        console.log("Validation errors:", JSON.stringify(errors, null, 2));
      }
      expect(errors).toHaveLength(0);
    });

    it("is idempotent — running twice produces same output", async () => {
      await runBlueprintInit(fixtureDir, outputDir);
      const firstRun = fs.readFileSync(path.join(outputDir, "CLAUDE.md"), "utf-8");

      const fingerprint = await detect(fixtureDir);
      await runTemplater(fingerprint, outputDir, {
        backend: "claude",
        dryRun: false,
        force: true,
      });
      const secondRun = fs.readFileSync(path.join(outputDir, "CLAUDE.md"), "utf-8");
      expect(firstRun).toBe(secondRun);
    });

    it("creates .bp-fingerprint.json", async () => {
      await runBlueprintInit(fixtureDir, outputDir);
      expect(fs.existsSync(path.join(outputDir, ".bp-fingerprint.json"))).toBe(true);
      const fp = JSON.parse(fs.readFileSync(path.join(outputDir, ".bp-fingerprint.json"), "utf-8"));
      expect(fp.version).toBe("1.0");
    });
  });
});

describe("structural validation detects malformed frontmatter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("exits with errors when rule missing required fields", async () => {
    // Create a blueprint with a malformed rule
    const rulesDir = path.join(tmpDir, ".claude/rules");
    fs.mkdirSync(rulesDir, { recursive: true });
    fs.writeFileSync(
      path.join(rulesDir, "bad-rule.md"),
      "---\n# Missing scope and severity\n---\n\n# Body\n"
    );

    const pack = resolveTemplatePack(
      {
        version: "1.0",
        detected_at: new Date().toISOString(),
        project: { name: "test", root: tmpDir, type: "application", git_workflow: "unknown" },
        languages: [],
        frameworks: [],
        entry_points: [],
        tooling: {},
        directory_topology: { src_dirs: [], test_dirs: [], config_dirs: [], package_dirs: [] },
        security_signals: { has_auth: false, has_external_apis: false, has_secrets_manager: false, has_docker: false },
      },
      "claude"
    );

    const result = await runValidator({
      level: "structural",
      projectRoot: tmpDir,
      manifest: pack.manifest,
    });

    expect(result.passed).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
