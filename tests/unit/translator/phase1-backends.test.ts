import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CopilotAdapter } from "../../../src/translator/adapters/copilot.js";
import { GeminiAdapter } from "../../../src/translator/adapters/gemini.js";
import { KiroAdapter } from "../../../src/translator/adapters/kiro.js";
import { AntigravityAdapter } from "../../../src/translator/adapters/antigravity.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-phase1-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

const testIR: BlueprintIR = {
  version: "2.0",
  spatial_anchor: {
    project_name: "phase1-test",
    surface: "# phase1-test\n\n- convention 1\n",
    temporal_anchor: "2025-05-28",
    conventions: ["convention 1"],
  },
  personas: [],
  rules: [
    {
      id: "rule-1",
      scope: "src/**",
      severity: "hard",
      action: "Enforce typing",
      rationale: "Type safety",
      tags: ["ts"],
    },
  ],
  skills: [
    {
      name: "TypeScript",
      description: "Type checking",
      when_to_use: "Always",
      tools_required: ["tsc"],
      procedure: "Run type checker",
    },
  ],
  hooks: [],
  settings: {
    approval_mode: "confirm",
  },
  meta: {
    rule_precedence: [],
    conflict_resolution: "precedence-based",
    source_backend: "test",
    target_backend: "test",
  },
};

describe("Phase 1: Additional Backends", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  describe("Copilot Adapter", () => {
    it("should render GitHub Copilot instructions", async () => {
      const adapter = new CopilotAdapter();
      const writtenFiles = await adapter.render(testIR, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "copilot-instructions.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".github", "copilot", "settings.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);

      expect(writtenFiles.length).toBeGreaterThan(0);
      expect(writtenFiles).toContain(path.join(tmpDir, "copilot-instructions.md"));
    });

    it("should generate Copilot settings with enforcement rules", async () => {
      const adapter = new CopilotAdapter();
      await adapter.render(testIR, tmpDir);

      const settingsContent = fs.readFileSync(
        path.join(tmpDir, ".github", "copilot", "settings.yaml"),
        "utf-8"
      );

      expect(settingsContent).toContain("approval_mode: confirm");
      expect(settingsContent).toContain("rules:");
      expect(settingsContent).toContain("rule-1: enforce");
    });

    it("should handle rules directory", async () => {
      const adapter = new CopilotAdapter();
      await adapter.render(testIR, tmpDir);

      expect(
        fs.existsSync(path.join(tmpDir, ".github", "copilot", "rules", "rule-1.md"))
      ).toBe(true);
    });
  });

  describe("Gemini Adapter", () => {
    it("should render Gemini CLI format", async () => {
      const adapter = new GeminiAdapter();
      const writtenFiles = await adapter.render(testIR, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "gemini.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "rules", "rule-1.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "skills", "typescript.md"))).toBe(true);

      expect(writtenFiles.length).toBeGreaterThan(0);
      expect(writtenFiles).toContain(path.join(tmpDir, "gemini.md"));
    });

    it("should structure rules and skills directories", async () => {
      const adapter = new GeminiAdapter();
      await adapter.render(testIR, tmpDir);

      const rulesDir = fs.readdirSync(path.join(tmpDir, "rules"));
      const skillsDir = fs.readdirSync(path.join(tmpDir, "skills"));

      expect(rulesDir).toContain("rule-1.md");
      expect(skillsDir.some((f) => f.includes("typescript"))).toBe(true);
    });
  });

  describe("Kiro Adapter", () => {
    it("should render AWS Kiro spec-driven format", async () => {
      const adapter = new KiroAdapter();
      const writtenFiles = await adapter.render(testIR, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "product.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "structure.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "tech.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "libraries.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);

      expect(writtenFiles.length).toBeGreaterThan(0);
    });

    it("should generate all Kiro spec files", async () => {
      const adapter = new KiroAdapter();
      await adapter.render(testIR, tmpDir);

      const productContent = fs.readFileSync(path.join(tmpDir, "product.md"), "utf-8");
      const structureContent = fs.readFileSync(path.join(tmpDir, "structure.md"), "utf-8");
      const techContent = fs.readFileSync(path.join(tmpDir, "tech.md"), "utf-8");
      const librariesContent = fs.readFileSync(path.join(tmpDir, "libraries.md"), "utf-8");

      expect(productContent).toContain("phase1-test");
      expect(structureContent).toContain("Directory Organization");
      expect(techContent).toContain("Enforcement Rules");
      expect(librariesContent).toContain("Skills & Capabilities");
    });
  });

  describe("Antigravity Adapter", () => {
    it("should render Google Antigravity artifact governance format", async () => {
      const adapter = new AntigravityAdapter();
      const writtenFiles = await adapter.render(testIR, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "antigravity.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "workspace.yaml"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "artifacts", "rule-1.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "capabilities", "typescript.md"))).toBe(true);

      expect(writtenFiles.length).toBeGreaterThan(0);
    });

    it("should generate workspace configuration", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.render(testIR, tmpDir);

      const workspaceContent = fs.readFileSync(path.join(tmpDir, "workspace.yaml"), "utf-8");

      expect(workspaceContent).toContain("workspace:");
      expect(workspaceContent).toContain("phase1-test");
      expect(workspaceContent).toContain("artifacts:");
      expect(workspaceContent).toContain("coordination:");
    });

    it("should mark artifacts with governance metadata", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.render(testIR, tmpDir);

      const artifactContent = fs.readFileSync(
        path.join(tmpDir, "artifacts", "rule-1.md"),
        "utf-8"
      );

      expect(artifactContent).toContain("artifact_type: rule");
      expect(artifactContent).toContain("Artifact Governance");
    });
  });

  describe("Cross-Adapter Consistency", () => {
    it("all Phase 1 adapters should generate AGENTS.md", async () => {
      const adapters = [
        { adapter: new CopilotAdapter(), name: "Copilot" },
        { adapter: new GeminiAdapter(), name: "Gemini" },
        { adapter: new KiroAdapter(), name: "Kiro" },
        { adapter: new AntigravityAdapter(), name: "Antigravity" },
      ];

      for (const { adapter, name } of adapters) {
        const dir = createTmpDir();
        try {
          await adapter.render(testIR, dir);
          const agentsMDPath = path.join(dir, "AGENTS.md");
          expect(fs.existsSync(agentsMDPath)).toBe(true, `${name} should generate AGENTS.md`);

          const content = fs.readFileSync(agentsMDPath, "utf-8");
          expect(content).toContain("# Agents & Governance Configuration");
        } finally {
          cleanDir(dir);
        }
      }
    });

    it("all Phase 1 adapters should parse and render consistently", async () => {
      const adapters = [
        new CopilotAdapter(),
        new GeminiAdapter(),
        new KiroAdapter(),
        new AntigravityAdapter(),
      ];

      for (const adapter of adapters) {
        const dir = createTmpDir();
        try {
          const writtenFiles = await adapter.render(testIR, dir);

          // All adapters should return a list of written files
          expect(Array.isArray(writtenFiles)).toBe(true);
          expect(writtenFiles.length).toBeGreaterThan(0);

          // All should produce AGENTS.md at minimum
          expect(writtenFiles).toContain(path.join(dir, "AGENTS.md"));
        } finally {
          cleanDir(dir);
        }
      }
    });
  });

  describe("Adapter Feature Parity", () => {
    it("should handle rules with severity levels", async () => {
      const irWithSoftRule: BlueprintIR = {
        ...testIR,
        rules: [
          ...testIR.rules,
          {
            id: "rule-soft",
            scope: "tests/**",
            severity: "soft",
            action: "Write tests",
            tags: ["quality"],
          },
        ],
      };

      const copilotAdapter = new CopilotAdapter();
      await copilotAdapter.render(irWithSoftRule, tmpDir);

      const settingsContent = fs.readFileSync(
        path.join(tmpDir, ".github", "copilot", "settings.yaml"),
        "utf-8"
      );

      expect(settingsContent).toContain("rule-1: enforce");
      expect(settingsContent).toContain("rule-soft: suggest");
    });

    it("should preserve skill information across adapters", async () => {
      const adapters = [
        { adapter: new CopilotAdapter(), path: ".github/copilot/skills" },
        { adapter: new GeminiAdapter(), path: "skills" },
        { adapter: new KiroAdapter(), path: "skills" },
        { adapter: new AntigravityAdapter(), path: "capabilities" },
      ];

      for (const { adapter, path: skillPath } of adapters) {
        const dir = createTmpDir();
        try {
          await adapter.render(testIR, dir);
          const skillFile = fs.readdirSync(path.join(dir, skillPath)).find((f) =>
            f.toLowerCase().includes("typescript")
          );

          expect(skillFile).toBeDefined();
          const skillContent = fs.readFileSync(
            path.join(dir, skillPath, skillFile!),
            "utf-8"
          );
          expect(skillContent).toContain("TypeScript");
        } finally {
          cleanDir(dir);
        }
      }
    });
  });

  describe("Backend-Specific Features", () => {
    it("Copilot should use GitHub directory structure", async () => {
      const adapter = new CopilotAdapter();
      await adapter.render(testIR, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, ".github", "copilot"))).toBe(true);
    });

    it("Kiro should generate all spec documents", async () => {
      const adapter = new KiroAdapter();
      await adapter.render(testIR, tmpDir);

      const specs = ["product.md", "structure.md", "tech.md", "libraries.md"];
      for (const spec of specs) {
        expect(fs.existsSync(path.join(tmpDir, spec))).toBe(true);
      }
    });

    it("Antigravity should use artifact governance structure", async () => {
      const adapter = new AntigravityAdapter();
      await adapter.render(testIR, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "artifacts"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "capabilities"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "workspace.yaml"))).toBe(true);
    });

    it("Gemini should use simple flat structure", async () => {
      const adapter = new GeminiAdapter();
      await adapter.render(testIR, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "gemini.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "rules"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "skills"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);
    });
  });
});
