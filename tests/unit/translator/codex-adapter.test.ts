import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CodexAdapter } from "../../../src/translator/adapters/codex.js";

describe("CodexAdapter", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-codex-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
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
  });

  describe("render — tool-use serialization", () => {
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
      // hard rules → read-only in approval matrix
      expect(content).toContain("read-only");
      // soft rules → auto
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
  });
});
