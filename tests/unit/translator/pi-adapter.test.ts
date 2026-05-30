import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { PIAdapter } from "../../../src/translator/adapters/pi.js";
import { BlueprintIRSchema } from "../../../src/translator/ir.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-pi-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("PIAdapter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  describe("parse", () => {
    it("returns valid IR with minimal PI.md anchor", async () => {
      fs.writeFileSync(path.join(tmpDir, "PI.md"), "# my-project\n\n- convention one\n");
      const adapter = new PIAdapter();
      const ir = await adapter.parse(tmpDir);

      expect(ir.version).toBe("2.0");
      expect(ir.spatial_anchor.project_name).toBe("my-project");
      expect(ir.spatial_anchor.conventions).toContain("convention one");
      expect(ir.meta.source_backend).toBe("pi");
    });

    it("returns unknown project name when PI.md missing", async () => {
      const adapter = new PIAdapter();
      const ir = await adapter.parse(tmpDir);

      expect(ir.spatial_anchor.project_name).toBe("unknown");
      expect(ir.personas).toHaveLength(0);
      expect(ir.rules).toHaveLength(0);
    });

    it("parses agent files from .pi/agents/", async () => {
      const piDir = path.join(tmpDir, ".pi", "agents");
      fs.mkdirSync(piDir, { recursive: true });
      fs.writeFileSync(
        path.join(piDir, "engineer.md"),
        `---\nname: engineer\nrole: Backend developer\nreasoning_style: methodical\n---\n\n## Constraints\n\n- No direct DB writes\n`
      );

      const adapter = new PIAdapter();
      const ir = await adapter.parse(tmpDir);

      expect(ir.personas).toHaveLength(1);
      expect(ir.personas[0]?.name).toBe("engineer");
      expect(ir.personas[0]?.role).toBe("Backend developer");
      expect(ir.personas[0]?.constraints).toContain("No direct DB writes");
    });

    it("skips malformed agent files without throwing", async () => {
      const piDir = path.join(tmpDir, ".pi", "agents");
      fs.mkdirSync(piDir, { recursive: true });
      fs.writeFileSync(path.join(piDir, "bad.md"), "not valid yaml: [\nbad");

      const adapter = new PIAdapter();
      const ir = await adapter.parse(tmpDir);
      expect(ir).toBeDefined();
    });

    it("parses full structure with agents and skills", async () => {
      const piDir = path.join(tmpDir, ".pi");
      fs.mkdirSync(piDir, { recursive: true });
      fs.mkdirSync(path.join(piDir, "agents"), { recursive: true });
      fs.mkdirSync(path.join(piDir, "rules"), { recursive: true });
      fs.mkdirSync(path.join(piDir, "skills"), { recursive: true });
      fs.mkdirSync(path.join(piDir, "hooks"), { recursive: true });

      fs.writeFileSync(
        path.join(tmpDir, "PI.md"),
        `# pi-test\n\n- convention 1\n`,
        "utf-8"
      );
      fs.writeFileSync(
        path.join(piDir, "agents", "agent1.md"),
        `---\nname: Agent1\nrole: Testing\nreasoning_style: methodical\nallowed_tools: ["Bash"]\n---\n- constraint\n`,
        "utf-8"
      );
      fs.writeFileSync(
        path.join(piDir, "skills", "skill1.md"),
        `---\nname: Skill1\ndescription: Test skill\nwhen_to_use: Always\ntools_required: ["Bash"]\n---\nProcedure.\n`,
        "utf-8"
      );

      const adapter = new PIAdapter();
      const ir = await adapter.parse(tmpDir);
      const validation = BlueprintIRSchema.safeParse(ir);

      expect(validation.success).toBe(true);
      if (validation.success) {
        expect(validation.data.spatial_anchor.project_name).toBe("pi-test");
        expect(validation.data.personas[0]?.name).toBe("Agent1");
        expect(validation.data.skills[0]?.name).toBe("Skill1");
      }
    });
  });

  describe("render", () => {
    it("writes PI.md and returns it in file list", async () => {
      const adapter = new PIAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "test",
          surface: "# test\n",
          temporal_anchor: new Date().toISOString(),
          conventions: [],
        },
        personas: [
          {
            name: "dev",
            role: "developer",
            reasoning_style: "methodical",
            constraints: ["no secrets"],
          },
        ],
        rules: [],
        skills: [],
        hooks: [],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "pi",
          target_backend: "pi",
        },
      };

      const files = await adapter.render(ir, tmpDir);
      expect(files.some((f) => f.endsWith("PI.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "PI.md"))).toBe(true);
    });

    it("writes PI.md, AGENTS.md, and pi.config.ts", async () => {
      const adapter = new PIAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "pi-render-test",
          surface: "# pi-render-test\n",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [
          {
            name: "Planner",
            role: "Planning",
            reasoning_style: "methodical",
            constraints: ["Plan thoroughly"],
            allowed_tools: ["Bash", "npm"],
          },
        ],
        rules: [],
        skills: [
          {
            name: "Deploy",
            description: "Deploy app",
            when_to_use: "After tests",
            tools_required: ["Docker"],
            procedure: "Run deploy",
          },
        ],
        hooks: [],
        settings: {
          approval_mode: "confirm" as const,
          model_config: {
            model: "claude-opus-4-7",
            max_tokens: 4096,
          },
        },
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "pi",
          target_backend: "pi",
        },
      };

      const writtenFiles = await adapter.render(ir, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "PI.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "AGENTS.md"))).toBe(true);
      expect(fs.existsSync(path.join(tmpDir, "pi.config.ts"))).toBe(true);
      expect(writtenFiles).toContain(path.join(tmpDir, "pi.config.ts"));
    });

    it("generates pi.config.ts with correct TypeScript structure", async () => {
      const adapter = new PIAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "config-test",
          surface: "# config\n",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [
          {
            name: "Builder",
            role: "Build",
            reasoning_style: "fast",
            constraints: ["Build fast"],
            allowed_tools: ["npm"],
          },
          {
            name: "Tester",
            role: "Test",
            reasoning_style: "thorough",
            constraints: ["Test all"],
          },
        ],
        rules: [],
        skills: [],
        hooks: [],
        settings: {
          approval_mode: "auto" as const,
        },
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "pi",
          target_backend: "pi",
        },
      };

      await adapter.render(ir, tmpDir);

      const configContent = fs.readFileSync(path.join(tmpDir, "pi.config.ts"), "utf-8");

      expect(configContent).toContain("export interface PIConfig");
      expect(configContent).toContain("project: 'config-test'");
      expect(configContent).toContain("name: 'Builder'");
      expect(configContent).toContain("name: 'Tester'");
      expect(configContent).toContain("approval_mode: 'auto'");
      expect(configContent).toContain("export default config");
    });

    it("generates pi.config.ts with model config", async () => {
      const adapter = new PIAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "model-test",
          surface: "# model\n",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [],
        rules: [],
        skills: [],
        hooks: [],
        settings: {
          approval_mode: "read-only" as const,
          model_config: {
            model: "claude-sonnet-4-6",
            max_tokens: 8192,
            temperature: 0.5,
          },
        },
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "pi",
          target_backend: "pi",
        },
      };

      await adapter.render(ir, tmpDir);

      const configContent = fs.readFileSync(path.join(tmpDir, "pi.config.ts"), "utf-8");

      expect(configContent).toContain("approval_mode: 'read-only'");
      expect(configContent).toContain("model: 'claude-sonnet-4-6'");
      expect(configContent).toContain("max_tokens: 8192");
      expect(configContent).toContain("temperature: 0.5");
    });

    it("generates teams.yaml from orchestration", async () => {
      const adapter = new PIAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "teams-test",
          surface: "# teams\n",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [],
        rules: [],
        skills: [],
        hooks: [],
        orchestration: {
          agent_teams: [
            {
              team_name: "frontend",
              agents: ["ui-agent", "style-agent"],
            },
            {
              team_name: "backend",
              agents: ["api-agent", "db-agent"],
            },
          ],
        },
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "pi",
          target_backend: "pi",
        },
      };

      await adapter.render(ir, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "teams.yaml"))).toBe(true);

      const teamsContent = fs.readFileSync(path.join(tmpDir, "teams.yaml"), "utf-8");

      expect(teamsContent).toContain("teams:");
      expect(teamsContent).toContain("frontend");
      expect(teamsContent).toContain("ui-agent");
      expect(teamsContent).toContain("backend");
      expect(teamsContent).toContain("db-agent");
    });

    it("generates chains.yaml from orchestration", async () => {
      const adapter = new PIAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "chains-test",
          surface: "# chains\n",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [],
        rules: [],
        skills: [],
        hooks: [],
        orchestration: {
          agent_chains: [
            {
              chain_name: "build-test-deploy",
              sequence: ["builder", "tester", "deployer"],
              parallel_mode: false,
            },
            {
              chain_name: "parallel-tests",
              sequence: ["unit-test", "integration-test", "e2e-test"],
              parallel_mode: true,
            },
          ],
        },
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "pi",
          target_backend: "pi",
        },
      };

      await adapter.render(ir, tmpDir);

      expect(fs.existsSync(path.join(tmpDir, "chains.yaml"))).toBe(true);

      const chainsContent = fs.readFileSync(path.join(tmpDir, "chains.yaml"), "utf-8");

      expect(chainsContent).toContain("chains:");
      expect(chainsContent).toContain("build-test-deploy");
      expect(chainsContent).toContain("builder");
      expect(chainsContent).toContain("parallel-tests");
      expect(chainsContent).toContain("parallel: true");
      expect(chainsContent).toContain("parallel: false");
    });

    it("includes AGENTS.md in output", async () => {
      const adapter = new PIAdapter();
      const ir = {
        version: "2.0" as const,
        spatial_anchor: {
          project_name: "agents-test",
          surface: "# agents\n",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [
          {
            name: "PIAgent",
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
          source_backend: "pi",
          target_backend: "pi",
        },
      };

      await adapter.render(ir, tmpDir);

      const agentsMDPath = path.join(tmpDir, "AGENTS.md");
      expect(fs.existsSync(agentsMDPath)).toBe(true);

      const content = fs.readFileSync(agentsMDPath, "utf-8");
      expect(content).toContain("PIAgent");
    });
  });

  describe("round-trip", () => {
    it("preserves project name and personas through parse-render cycle", async () => {
      const adapter = new PIAdapter();

      const piDir = path.join(tmpDir, ".pi");
      fs.mkdirSync(piDir, { recursive: true });
      fs.mkdirSync(path.join(piDir, "agents"), { recursive: true });
      fs.mkdirSync(path.join(piDir, "rules"), { recursive: true });
      fs.mkdirSync(path.join(piDir, "skills"), { recursive: true });
      fs.mkdirSync(path.join(piDir, "hooks"), { recursive: true });

      fs.writeFileSync(path.join(tmpDir, "PI.md"), "# rt-test\n", "utf-8");
      fs.writeFileSync(
        path.join(piDir, "agents", "rt-agent.md"),
        `---\nname: RTAgent\nrole: RT\nreasoning_style: fast\n---\n- rt constraint\n`,
        "utf-8"
      );

      const ir1 = await adapter.parse(tmpDir);

      const tmpDir2 = createTmpDir();
      try {
        await adapter.render(ir1, tmpDir2);
        const ir2 = await adapter.parse(tmpDir2);

        expect(ir2.spatial_anchor.project_name).toBe(ir1.spatial_anchor.project_name);
        expect(ir2.personas).toHaveLength(ir1.personas.length);
        expect(ir2.personas[0]?.name).toBe("RTAgent");
      } finally {
        cleanDir(tmpDir2);
      }
    });
  });
});
