import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodexAdapter } from "../../../src/translator/adapters/codex.js";
import { BlueprintIRSchema } from "../../../src/translator/ir.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-codex-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("CodexAdapter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  describe("parse", () => {
    it("returns valid IR for minimal CODEX.md", async () => {
      fs.writeFileSync(path.join(tmpDir, "CODEX.md"), "# my-codex\n");
      const adapter = new CodexAdapter();
      const ir = await adapter.parse(tmpDir);
      expect(ir.version).toBe("2.0");
      expect(ir.spatial_anchor.project_name).toBe("my-codex");
      expect(ir.meta.source_backend).toBe("codex");
    });

    it("parses rules from .codex/rules/", async () => {
      const rulesDir = path.join(tmpDir, ".codex", "rules");
      fs.mkdirSync(rulesDir, { recursive: true });
      fs.writeFileSync(
        path.join(rulesDir, "no-secrets.md"),
        `---\nid: no-secrets\nscope: "**"\nseverity: hard\naction: No hardcoded secrets\n---\n`
      );

      const adapter = new CodexAdapter();
      const ir = await adapter.parse(tmpDir);
      expect(ir.rules).toHaveLength(1);
      expect(ir.rules[0]?.id).toBe("no-secrets");
    });

    it("parses full structure with agents, rules, and skills", async () => {
      const codexDir = path.join(tmpDir, ".codex");
      fs.mkdirSync(codexDir, { recursive: true });
      fs.mkdirSync(path.join(codexDir, "agents"), { recursive: true });
      fs.mkdirSync(path.join(codexDir, "rules"), { recursive: true });
      fs.mkdirSync(path.join(codexDir, "skills"), { recursive: true });
      fs.mkdirSync(path.join(codexDir, "hooks"), { recursive: true });

      fs.writeFileSync(
        path.join(tmpDir, "CODEX.md"),
        `# test-project\n\n- convention 1\n- convention 2\n`,
        "utf-8"
      );
      fs.writeFileSync(
        path.join(codexDir, "agents", "reviewer.md"),
        `---\nname: Reviewer\nrole: Code review\nreasoning_style: critical\nallowed_tools: ["Bash"]\n---\n## Constraints\n- Review all changes\n`,
        "utf-8"
      );
      fs.writeFileSync(
        path.join(codexDir, "rules", "01-security.md"),
        `---\nid: security-rule\nscope: src/**\nseverity: hard\naction: Scan for security\nrationale: Security\ntags: [security]\n---\nRule body.\n`,
        "utf-8"
      );
      fs.writeFileSync(
        path.join(codexDir, "skills", "review.md"),
        `---\nname: CodeReview\ndescription: Review code\nwhen_to_use: Always\ntools_required: ["Bash"]\n---\nReview procedure.\n`,
        "utf-8"
      );

      const adapter = new CodexAdapter();
      const ir = await adapter.parse(tmpDir);
      const validation = BlueprintIRSchema.safeParse(ir);

      expect(validation.success).toBe(true);
      if (validation.success) {
        expect(validation.data.spatial_anchor.project_name).toBe("test-project");
        expect(validation.data.personas[0]?.name).toBe("Reviewer");
        expect(validation.data.rules[0]?.action).toBe("Scan for security");
        expect(validation.data.skills[0]?.name).toBe("CodeReview");
      }
    });
  });

  describe("render", () => {
    it("writes codex.md with approval matrix from rules", async () => {
      const adapter = new CodexAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "test",
          surface: "# test\n",
          temporal_anchor: new Date().toISOString(),
          conventions: [],
        },
        personas: [],
        rules: [
          {
            id: "no-console",
            scope: "src/**",
            severity: "hard" as const,
            action: "Replace console.log",
          },
          {
            id: "prefer-async",
            scope: "**",
            severity: "soft" as const,
            action: "Use async/await",
          },
        ],
        skills: [],
        hooks: [],
        settings: { approval_mode: "confirm" as const },
        meta: {
          rule_precedence: ["no-console", "prefer-async"],
          conflict_resolution: "precedence-based",
          source_backend: "codex",
          target_backend: "codex",
        },
      };

      const files = await adapter.render(ir, tmpDir);
      const codexMdPath = path.join(tmpDir, "codex.md");
      expect(fs.existsSync(codexMdPath)).toBe(true);
      const content = fs.readFileSync(codexMdPath, "utf-8");
      expect(content).toContain("Approval Modes");
      expect(content).toContain("no-console");
      expect(content).toContain("read-only");
      expect(content).toContain("auto");
      expect(files.some((f) => f.endsWith("codex.md"))).toBe(true);
    });

    it("writes agent files preserving allowed_tools", async () => {
      const adapter = new CodexAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "test",
          surface: "",
          temporal_anchor: new Date().toISOString(),
          conventions: [],
        },
        personas: [
          {
            name: "coder",
            role: "developer",
            reasoning_style: "analytical",
            constraints: ["no hacks"],
            allowed_tools: ["read", "write"],
          },
        ],
        rules: [],
        skills: [],
        hooks: [],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "codex",
          target_backend: "codex",
        },
      };

      await adapter.render(ir, tmpDir);
      const agentPath = path.join(tmpDir, ".codex", "agents", "coder.md");
      expect(fs.existsSync(agentPath)).toBe(true);
      const content = fs.readFileSync(agentPath, "utf-8");
      expect(content).toContain("allowed_tools");
    });

    it("writes all output files to target directory", async () => {
      const adapter = new CodexAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "codex-test",
          surface: "# codex-test\n\n- convention 1\n",
          temporal_anchor: "2025-05-28",
          conventions: ["convention 1"],
        },
        personas: [
          {
            name: "CodexReviewer",
            role: "Review code",
            reasoning_style: "methodical",
            constraints: ["Review thoroughly"],
            allowed_tools: ["Bash"],
          },
        ],
        rules: [
          {
            id: "rule-1",
            scope: "src/**",
            severity: "hard" as const,
            action: "Scan security",
            rationale: "Security",
            tags: ["sec"],
          },
        ],
        skills: [
          {
            name: "Audit",
            description: "Audit code",
            when_to_use: "Before deploy",
            tools_required: ["Bash"],
            procedure: "Run audit script",
          },
        ],
        hooks: [
          {
            event: "pre_tool_use" as const,
            language: "javascript",
            stub: "console.log('hook');",
          },
        ],
        settings: {
          approval_mode: "confirm" as const,
        },
        meta: {
          rule_precedence: ["rule-1"],
          conflict_resolution: "precedence-based",
          source_backend: "codex",
          target_backend: "codex",
        },
      };

      const writtenFiles = await adapter.render(ir, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "CODEX.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "codex.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".codex", "agents", "codexreviewer.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".codex", "rules", "rule-1.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, ".codex", "skills", "audit.md"))).toBe(true);

      expect(writtenFiles.length).toBeGreaterThan(0);
      expect(writtenFiles).toContain(path.join(tmpDir, "CODEX.md"));
      expect(writtenFiles).toContain(path.join(tmpDir, "AGENTS.md"));
    });

    it("maps hard rules to read-only in rule files", async () => {
      const adapter = new CodexAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "approval-test",
          surface: "# approval-test\n",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [],
        rules: [
          {
            id: "hard-rule",
            scope: "src/**",
            severity: "hard" as const,
            action: "Hard rule",
          },
        ],
        skills: [],
        hooks: [],
        settings: {
          approval_mode: "read-only" as const,
        },
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "test",
          target_backend: "codex",
        },
      };

      await adapter.render(ir, tmpDir);

      const ruleContent = fs.readFileSync(
        path.join(tmpDir, ".codex", "rules", "hard-rule.md"),
        "utf-8"
      );
      expect(ruleContent).toContain("approval_mode: read-only");
    });

    it("generates codex.md with correct headings and structure", async () => {
      const adapter = new CodexAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "config-test",
          surface: "# config-test\n",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [],
        rules: [
          {
            id: "rule-1",
            scope: "**",
            severity: "hard" as const,
            action: "Hard action",
          },
          {
            id: "rule-2",
            scope: "**",
            severity: "soft" as const,
            action: "Soft action",
          },
        ],
        skills: [],
        hooks: [],
        settings: {
          approval_mode: "confirm" as const,
        },
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "test",
          target_backend: "codex",
        },
      };

      await adapter.render(ir, tmpDir);

      const configContent = fs.readFileSync(path.join(tmpDir, "codex.md"), "utf-8");

      expect(configContent).toContain("# Codex Configuration");
      expect(configContent).toContain("confirm");
      expect(configContent).toContain("Rules Approval Matrix");
      expect(configContent).toContain("read-only");
      expect(configContent).toContain("auto");
    });

    it("includes AGENTS.md in output", async () => {
      const adapter = new CodexAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "agents-test",
          surface: "# agents-test\n",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [
          {
            name: "TestAgent",
            role: "Testing",
            reasoning_style: "methodical",
            constraints: [],
          },
        ],
        rules: [],
        skills: [],
        hooks: [],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "test",
          target_backend: "codex",
        },
      };

      await adapter.render(ir, tmpDir);

      const agentsMDPath = path.join(tmpDir, "AGENTS.md");
      expect(fs.existsSync(agentsMDPath)).toBe(true);

      const content = fs.readFileSync(agentsMDPath, "utf-8");
      expect(content).toContain("TestAgent");
      expect(content).toContain("# Agents & Governance Configuration");
    });
  });

  describe("round-trip", () => {
    it("preserves project name and personas through parse-render cycle", async () => {
      const adapter = new CodexAdapter();

      const codexDir = path.join(tmpDir, ".codex");
      fs.mkdirSync(codexDir, { recursive: true });
      fs.mkdirSync(path.join(codexDir, "agents"), { recursive: true });
      fs.mkdirSync(path.join(codexDir, "rules"), { recursive: true });
      fs.mkdirSync(path.join(codexDir, "skills"), { recursive: true });
      fs.mkdirSync(path.join(codexDir, "hooks"), { recursive: true });

      fs.writeFileSync(path.join(tmpDir, "CODEX.md"), "# round-trip\n\n- conv1\n", "utf-8");
      fs.writeFileSync(
        path.join(codexDir, "agents", "agent1.md"),
        `---\nname: Agent1\nrole: Testing\nreasoning_style: fast\n---\n- constraint\n`,
        "utf-8"
      );

      const ir1 = await adapter.parse(tmpDir);

      const tmpDir2 = createTmpDir();
      try {
        await adapter.render(ir1, tmpDir2);
        const ir2 = await adapter.parse(tmpDir2);

        expect(ir2.spatial_anchor.project_name).toBe(ir1.spatial_anchor.project_name);
        expect(ir2.personas).toHaveLength(ir1.personas.length);
        expect(ir2.personas[0]?.name).toBe(ir1.personas[0]?.name);
      } finally {
        cleanDir(tmpDir2);
      }
    });
  });
});
