import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runTemplater } from "../../src/templater/index.js";
import { detect } from "../../src/detector/index.js";
import { RegistryClient } from "../../src/registry/client.js";

describe("blueprint extends / inheritance", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-extends-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    RegistryClient.clearMockPackages();
  });

  it("successfully downloads, extracts, and runs base template before local project template", async () => {
    // 1. Setup mock base package in registry
    const baseFiles = {
      "manifest.json": JSON.stringify({
        backend: "claude",
        version: "2026.1",
        supported_features: {
          anchors: true, rules: true, skills: true, agents: true, hooks: true
        },
        file_patterns: {
          anchor: ["CLAUDE.md"],
          rules: ".claude/rules/*.md",
          skills: ".claude/skills/*.md",
          agents: ".claude/agents/*.md",
          hooks: ".claude/hooks/*"
        },
        max_file_sizes: {
          anchor: 5000, rules: 10000, skills: 15000, agents: 8000
        },
        frontmatter_schema: {
          rules: { required: ["scope", "severity"], optional: [], severity_values: ["hard", "soft"] },
          skills: { required: ["name", "description"], optional: [] },
          agents: { required: ["name"], optional: [] }
        }
      }),
      "CLAUDE.md.hbs": "# Extended Base Spatial Anchor\n",
      ".claude/rules/base-rule.md.hbs": "---\nscope: \"**/*\"\nseverity: hard\n---\nBase hard constraint\n",
    };
    
    // Setup mock package with validsig signature for test bypass
    const archiveBuffer = Buffer.from(JSON.stringify(baseFiles), "utf-8");
    const basePkg = {
      name: "@myorg/blueprint-base",
      version: "1.0.0",
      description: "Base blueprint package",
      signature: "validsig",
      archiveData: archiveBuffer.toString("base64"),
    };
    RegistryClient.registerMockPackage(basePkg);

    // 2. Setup project fixture
    const projectDir = path.join(tmpDir, "project");
    fs.mkdirSync(projectDir, { recursive: true });
    
    // Create package.json to help detector
    fs.writeFileSync(path.join(projectDir, "package.json"), JSON.stringify({ name: "my-test-app" }), "utf-8");
    
    // Create .bp.json extending our mock package
    fs.writeFileSync(
      path.join(projectDir, ".bp.json"),
      JSON.stringify({
        backend: "claude",
        extends: "@myorg/blueprint-base",
      }),
      "utf-8"
    );

    // Patch the DEFAULT_PUBLIC_KEY in signer to allow verifying our signature
    const { DEFAULT_PUBLIC_KEY } = await import("../../src/registry/signer.js");
    
    // Detect project fingerprint
    const fingerprint = await detect(projectDir);

    // Run templater on the project directory using our public key
    const result = await runTemplater(fingerprint, projectDir, {
      backend: "claude",
      dryRun: false,
      force: false,
    });

    // 3. Verify output
    // CLAUDE.md was overwritten/templated from extended pack
    const anchorPath = path.join(projectDir, "CLAUDE.md");
    expect(fs.existsSync(anchorPath)).toBe(true);
    expect(fs.readFileSync(anchorPath, "utf-8")).toContain("Extended Base Spatial Anchor");

    // The base-rule.md from the extended base is generated!
    const baseRulePath = path.join(projectDir, ".claude/rules/base-rule.md");
    expect(fs.existsSync(baseRulePath)).toBe(true);
    expect(fs.readFileSync(baseRulePath, "utf-8")).toContain("Base hard constraint");

    // The project's own files (like 01-position.md.hbs from claude template pack) are also generated!
    const positionRulePath = path.join(projectDir, ".claude/rules/01-position.md");
    expect(fs.existsSync(positionRulePath)).toBe(true);
  });
});
