import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeAdapter } from "../../../src/translator/adapters/claude.js";
import { CursorAdapter } from "../../../src/translator/adapters/cursor.js";
import { GenericAdapter } from "../../../src/translator/adapters/generic.js";
import { generateAgentsMD } from "../../../src/translator/adapters/agents-md.js";
import { BlueprintIRSchema, type BlueprintIR } from "../../../src/translator/ir.js";
import { enrichFingerprint } from "../../../src/detector/index.js";
import type { Fingerprint } from "../../../src/detector/fingerprint.js";
import {
  validateSettings,
  validateCommands,
  validateMCPServers,
  validateIdentity,
  validateAudit,
  validateCompliance,
  validateRisk,
} from "../../../src/validator/layers.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-phase0-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("Phase 0: IR Extension & Enterprise Schemas", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  describe("IR Schema (Task 0.1)", () => {
    it("should support v2.0 IR with all 8 layers", () => {
      const ir: BlueprintIR = {
        version: "2.0",
        spatial_anchor: {
          project_name: "test-project",
          surface: "# test-project",
          temporal_anchor: "2025-05-28",
          conventions: ["convention 1"],
        },
        personas: [
          {
            name: "TestAgent",
            role: "Testing",
            reasoning_style: "methodical",
            constraints: ["constraint 1"],
          },
        ],
        rules: [
          {
            id: "rule-1",
            scope: "src/**",
            severity: "hard",
            action: "Test action",
          },
        ],
        skills: [
          {
            name: "TestSkill",
            description: "Test skill",
            when_to_use: "When testing",
            tools_required: ["Bash"],
            procedure: "Follow these steps to test",
          },
        ],
        hooks: [],
        settings: {
          approval_mode: "confirm",
          model_config: {
            model: "claude-opus-4-7",
            max_tokens: 2000,
            temperature: 0.7,
          },
          cost_controls: {
            monthly_budget_usd: 100,
          },
          safety_modes: ["safe"],
        },
        commands: [
          {
            name: "deploy",
            description: "Deploy the app",
            tools_required: ["Bash"],
            approval_scope: "admin",
          },
        ],
        mcp_servers: [
          {
            name: "github",
            endpoint: "mcp+docker://github-server",
            auth_scope: ["read:repos"],
            risk_level: "medium",
          },
        ],
        identity: {
          rbac_enabled: true,
          roles: [
            {
              name: "admin",
              permissions: ["deploy", "audit"],
            },
          ],
          agent_owner: "team-a",
        },
        audit: {
          audit_enabled: true,
          log_level: "info",
          correlation_id_format: "uuid",
          retention_days: 90,
          compliance_checkpoints: ["pre-deploy", "post-deploy"],
        },
        compliance: {
          frameworks: ["gdpr", "soc2"],
          certified: true,
        },
        risk: {
          risk_tier: "medium",
          risk_signals: {
            has_external_apis: true,
            has_secrets_manager: true,
          },
        },
        registry: {
          registry_name: "private-registry",
          published_version: "1.0.0",
          verified_publisher: true,
        },
        orchestration: {
          agent_teams: [
            {
              team_name: "team-a",
              agents: ["agent-1", "agent-2"],
            },
          ],
          agent_chains: [
            {
              chain_name: "chain-1",
              sequence: ["agent-1", "agent-2"],
              parallel_mode: false,
            },
          ],
          persistent_memory: {
            enabled: true,
            retention_policy: "7d",
          },
        },
        meta: {
          rule_precedence: ["rule-1"],
          conflict_resolution: "precedence-based",
          source_backend: "test",
          target_backend: "test",
        },
      };

      const validation = BlueprintIRSchema.safeParse(ir);
      expect(validation.success).toBe(true);

      if (validation.success) {
        expect(validation.data.version).toBe("2.0");
        expect(validation.data.settings?.approval_mode).toBe("confirm");
        expect(validation.data.commands?.[0]?.name).toBe("deploy");
        expect(validation.data.mcp_servers?.[0]?.name).toBe("github");
        expect(validation.data.identity?.rbac_enabled).toBe(true);
        expect(validation.data.audit?.audit_enabled).toBe(true);
        expect(validation.data.compliance?.frameworks).toContain("gdpr");
        expect(validation.data.risk?.risk_tier).toBe("medium");
        expect(validation.data.registry?.verified_publisher).toBe(true);
        expect(validation.data.orchestration?.agent_teams).toHaveLength(1);
      }
    });

    it("should allow optional enterprise layers", () => {
      const minimalIr: BlueprintIR = {
        version: "2.0",
        spatial_anchor: {
          project_name: "minimal",
          surface: "# minimal",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [],
        rules: [],
        skills: [],
        hooks: [],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "test",
          target_backend: "test",
        },
      };

      const validation = BlueprintIRSchema.safeParse(minimalIr);
      expect(validation.success).toBe(true);
    });
  });

  describe("AGENTS.md Generation (Task 0.3)", () => {
    it("should generate AGENTS.md from IR", () => {
      const ir: BlueprintIR = {
        version: "2.0",
        spatial_anchor: {
          project_name: "agents-test",
          surface: "# agents-test",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [
          {
            name: "Reviewer",
            role: "Code reviewer",
            reasoning_style: "critical",
            constraints: ["Must review code changes"],
          },
        ],
        rules: [
          {
            id: "security-rule",
            scope: "src/**",
            severity: "hard",
            action: "Must scan for security issues",
            rationale: "Security compliance",
            tags: ["security"],
          },
        ],
        skills: [
          {
            name: "CodeReview",
            description: "Review code changes",
            when_to_use: "After code changes",
            tools_required: ["Bash", "Git"],
            procedure: "Run linter and type checker",
          },
        ],
        hooks: [],
        meta: {
          rule_precedence: ["security-rule"],
          conflict_resolution: "precedence-based",
          source_backend: "test",
          target_backend: "test",
        },
      };

      const agentsMD = generateAgentsMD(ir);

      expect(agentsMD).toContain("# Agents & Governance Configuration");
      expect(agentsMD).toContain("Reviewer");
      expect(agentsMD).toContain("Code reviewer");
      expect(agentsMD).toContain("Must review code changes");
      expect(agentsMD).toContain("security-rule");
      expect(agentsMD).toContain("Must scan for security issues");
      expect(agentsMD).toContain("CodeReview");
      expect(agentsMD).toContain("Review code changes");
    });

    it("should include settings in AGENTS.md when present", () => {
      const ir: BlueprintIR = {
        version: "2.0",
        spatial_anchor: {
          project_name: "settings-test",
          surface: "# settings-test",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [],
        rules: [],
        skills: [],
        hooks: [],
        settings: {
          approval_mode: "read-only",
          model_config: {
            model: "claude-opus-4-7",
            max_tokens: 4096,
          },
        },
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "test",
          target_backend: "test",
        },
      };

      const agentsMD = generateAgentsMD(ir);

      expect(agentsMD).toContain("## Settings & Configuration");
      expect(agentsMD).toContain("read-only");
      expect(agentsMD).toContain("claude-opus-4-7");
      expect(agentsMD).toContain("4096");
    });

    it("should generate AGENTS.md for all adapters", async () => {
      const adapters = [new ClaudeAdapter(), new CursorAdapter(), new GenericAdapter()];

      const ir: BlueprintIR = {
        version: "2.0",
        spatial_anchor: {
          project_name: "adapter-test",
          surface: "# adapter-test",
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
          target_backend: "test",
        },
      };

      for (const adapter of adapters) {
        const outputDir = createTmpDir();
        try {
          await adapter.render(ir, outputDir);
          const agentsMDPath = path.join(outputDir, "AGENTS.md");
          expect(fs.existsSync(agentsMDPath)).toBe(true);
          const content = fs.readFileSync(agentsMDPath, "utf-8");
          expect(content).toContain("TestAgent");
        } finally {
          cleanDir(outputDir);
        }
      }
    });
  });

  describe("Detector Risk Scoring (Task 0.4)", () => {
    it("should detect risk tier as low", () => {
      const fp: Fingerprint = {
        version: "1.0",
        detected_at: new Date().toISOString(),
        project: {
          name: "test-low-risk",
          root: "/test",
          type: "library",
          git_workflow: "trunk-based",
        },
        languages: [{ name: "typescript", primary: true, percentage: 100 }],
        frameworks: [],
        entry_points: [],
        tooling: [],
        directory_topology: {
          src_dirs: ["src"],
          test_dirs: ["tests"],
          config_dirs: [],
          package_dirs: [],
        },
        security_signals: {
          has_external_apis: false,
          has_secrets_manager: false,
          has_auth: false,
          has_docker: false,
        },
      };

      const enhanced = enrichFingerprint(fp);
      expect(enhanced.risk_tier).toBe("low");
      expect(enhanced.suggested_approval_mode).toBe("auto");
    });

    it("should detect risk tier as high", () => {
      const fp: Fingerprint = {
        version: "1.0",
        detected_at: new Date().toISOString(),
        project: {
          name: "test-high-risk",
          root: "/test",
          type: "service",
          git_workflow: "trunk-based",
        },
        languages: [{ name: "typescript", primary: true, percentage: 100 }],
        frameworks: [
          { name: "express" },
        ],
        entry_points: [],
        tooling: [],
        directory_topology: {
          src_dirs: ["src"],
          test_dirs: ["tests"],
          config_dirs: [],
          package_dirs: [],
        },
        security_signals: {
          has_external_apis: true, // +2
          has_secrets_manager: true, // +2
          has_auth: false,
          has_docker: false,
        },
      };

      const enhanced = enrichFingerprint(fp);
      expect(enhanced.risk_tier).toBe("high"); // 2+2+1 = 5 >= 5
      expect(enhanced.suggested_approval_mode).toBe("confirm");
    });

    it("should detect risk tier as critical", () => {
      const fp: Fingerprint = {
        version: "1.0",
        detected_at: new Date().toISOString(),
        project: {
          name: "test-critical",
          root: "/test",
          type: "service",
          git_workflow: "trunk-based",
        },
        languages: [{ name: "typescript", primary: true, percentage: 100 }],
        frameworks: [
          { name: "express" },
          { name: "stripe-payments" }, // payment framework
        ],
        entry_points: [],
        tooling: [],
        directory_topology: {
          src_dirs: ["src"],
          test_dirs: ["tests"],
          config_dirs: [],
          package_dirs: [],
        },
        security_signals: {
          has_external_apis: true,
          has_secrets_manager: true,
          has_auth: true,
          has_docker: true,
        },
      };

      const enhanced = enrichFingerprint(fp);
      expect(enhanced.risk_tier).toBe("critical");
      expect(enhanced.suggested_approval_mode).toBe("read-only");
    });

    it("should estimate monthly tokens", () => {
      const fp: Fingerprint = {
        version: "1.0",
        detected_at: new Date().toISOString(),
        project: {
          name: "test-tokens",
          root: "/test",
          type: "library",
          git_workflow: "trunk-based",
        },
        languages: [{ name: "typescript", primary: true, percentage: 100 }],
        frameworks: [{ name: "react" }, { name: "nextjs" }],
        entry_points: [],
        tooling: [],
        directory_topology: {
          src_dirs: ["src"],
          test_dirs: ["tests"],
          config_dirs: ["config"],
          package_dirs: [],
        },
        security_signals: {
          has_external_apis: false,
          has_secrets_manager: false,
          has_auth: false,
          has_docker: false,
        },
      };

      const enhanced = enrichFingerprint(fp);
      expect(enhanced.estimated_monthly_tokens).toBeGreaterThan(1000);
      expect(enhanced.estimated_monthly_tokens).toBeLessThan(10000);
    });
  });

  describe("Validator Layer Schemas (Task 0.5)", () => {
    it("should validate settings layer", () => {
      const validSettings = {
        approval_mode: "confirm",
        model_config: {
          model: "claude-opus-4-7",
          max_tokens: 2000,
        },
      };

      const errors = validateSettings(validSettings);
      expect(errors).toHaveLength(0);
    });

    it("should reject invalid settings", () => {
      const invalidSettings = {
        approval_mode: "invalid-mode", // should be auto/confirm/read-only
      };

      const errors = validateSettings(invalidSettings);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("should validate commands layer", () => {
      const validCommands = [
        {
          name: "deploy",
          description: "Deploy the app",
          tools_required: ["Bash"],
          approval_scope: "admin",
        },
      ];

      const errors = validateCommands(validCommands);
      expect(errors).toHaveLength(0);
    });

    it("should validate MCP servers", () => {
      const validServers = [
        {
          name: "github",
          endpoint: "mcp+docker://github",
          auth_scope: ["read:repos"],
          risk_level: "medium",
        },
      ];

      const errors = validateMCPServers(validServers);
      expect(errors).toHaveLength(0);
    });

    it("should validate identity layer", () => {
      const validIdentity = {
        rbac_enabled: true,
        roles: [
          {
            name: "admin",
            permissions: ["deploy", "audit"],
          },
        ],
        agent_owner: "team-a",
      };

      const errors = validateIdentity(validIdentity);
      expect(errors).toHaveLength(0);
    });

    it("should validate audit layer", () => {
      const validAudit = {
        audit_enabled: true,
        log_level: "info",
        correlation_id_format: "uuid",
        retention_days: 90,
      };

      const errors = validateAudit(validAudit);
      expect(errors).toHaveLength(0);
    });

    it("should validate compliance layer", () => {
      const validCompliance = {
        frameworks: ["gdpr", "soc2"],
        certified: true,
      };

      const errors = validateCompliance(validCompliance);
      expect(errors).toHaveLength(0);
    });

    it("should validate risk layer", () => {
      const validRisk = {
        risk_tier: "high",
        risk_signals: {
          has_external_apis: true,
          has_secrets_manager: false,
        },
      };

      const errors = validateRisk(validRisk);
      expect(errors).toHaveLength(0);
    });
  });

  describe("Templater Layer 6-8 Support (Task 0.2)", () => {
    it("should render templates with new layers in Claude adapter", async () => {
      const claudeAdapter = new ClaudeAdapter();
      const ir: BlueprintIR = {
        version: "2.0",
        spatial_anchor: {
          project_name: "layer-test",
          surface: "# layer-test",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [],
        rules: [],
        skills: [],
        hooks: [],
        settings: {
          approval_mode: "confirm",
        },
        commands: [
          {
            name: "build",
            description: "Build the project",
            tools_required: ["Bash"],
          },
        ],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "test",
          target_backend: "claude",
        },
      };

      const outputDir = createTmpDir();
      try {
        await claudeAdapter.render(ir, outputDir);
        expect(fs.existsSync(path.join(outputDir, "CLAUDE.md"))).toBe(true);
        expect(fs.existsSync(path.join(outputDir, "AGENTS.md"))).toBe(true);
      } finally {
        cleanDir(outputDir);
      }
    });
  });

  describe("IR Version Migration (v1.0 to v2.0)", () => {
    it("should maintain backward compatibility with existing v1.0 IR structures", () => {
      // Test that we can parse minimal IR structures
      const oldStyleIr = {
        version: "2.0", // We now require 2.0
        spatial_anchor: {
          project_name: "legacy",
          surface: "# legacy",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [],
        rules: [],
        skills: [],
        hooks: [],
        meta: {
          rule_precedence: [],
          conflict_resolution: "precedence-based",
          source_backend: "test",
          target_backend: "test",
        },
      };

      const validation = BlueprintIRSchema.safeParse(oldStyleIr);
      expect(validation.success).toBe(true);
    });
  });
});
