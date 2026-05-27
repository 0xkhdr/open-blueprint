import { describe, it, expect } from "vitest";
import fc from "fast-check";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runValidator } from "../../src/validator/index.js";
import type { BackendManifest } from "../../src/templater/selector.js";

const MOCK_MANIFEST: BackendManifest = {
  backend: "claude",
  version: "2026.1",
  supported_features: {
    anchors: true,
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
  },
  file_patterns: {
    anchor: ["CLAUDE.md"],
    rules: ".claude/rules/*.md",
    skills: ".claude/skills/*.md",
    agents: ".claude/agents/*.md",
    hooks: ".claude/hooks/*",
  },
  max_file_sizes: {
    anchor: 5000,
    rules: 10000,
    skills: 15000,
    agents: 8000,
  },
  frontmatter_schema: {
    rules: {
      required: ["scope", "severity"],
      optional: [],
      severity_values: ["hard", "soft"],
    },
    skills: {
      required: ["name", "description"],
      optional: [],
    },
    agents: {
      required: ["name"],
      optional: [],
    },
  },
};

describe("Property-based Fuzz Testing", () => {
  it("never panics or hangs when validating random structures", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          anchorContent: fc.string(),
          ruleContent: fc.string(),
          skillContent: fc.string(),
          agentContent: fc.string(),
        }),
        async (data) => {
          const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-fuzz-"));
          
          try {
            // Scaffold random files
            fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), data.anchorContent, "utf-8");
            
            const rulesDir = path.join(tmpDir, ".claude/rules");
            fs.mkdirSync(rulesDir, { recursive: true });
            fs.writeFileSync(path.join(rulesDir, "fuzz-rule.md"), data.ruleContent, "utf-8");
            
            const skillsDir = path.join(tmpDir, ".claude/skills");
            fs.mkdirSync(skillsDir, { recursive: true });
            fs.writeFileSync(path.join(skillsDir, "fuzz-skill.md"), data.skillContent, "utf-8");
            
            const agentsDir = path.join(tmpDir, ".claude/agents");
            fs.mkdirSync(agentsDir, { recursive: true });
            fs.writeFileSync(path.join(agentsDir, "fuzz-agent.md"), data.agentContent, "utf-8");

            const result = await runValidator({
              level: "all",
              projectRoot: tmpDir,
              manifest: MOCK_MANIFEST,
            });

            // Invariant: result has passed boolean, and never crashes
            expect(result).toBeDefined();
            expect(typeof result.passed).toBe("boolean");
          } finally {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          }
        }
      ),
      { numRuns: 100 } // Fast check run
    );
  });
});
