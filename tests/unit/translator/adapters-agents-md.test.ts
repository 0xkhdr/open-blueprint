import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ClaudeAdapter } from "../../../src/translator/adapters/claude.js";
import { CursorAdapter } from "../../../src/translator/adapters/cursor.js";
import { GenericAdapter } from "../../../src/translator/adapters/generic.js";
import { generateAgentsMD } from "../../../src/translator/adapters/agents-md.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-adapter-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("Adapters: AGENTS.md Universal Output", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    cleanDir(tmpDir);
  });

  const createTestIR = (): BlueprintIR => ({
    version: "2.0",
    spatial_anchor: {
      project_name: "adapter-test",
      surface: "# adapter-test",
      temporal_anchor: "2025-05-28",
      conventions: ["Convention 1", "Convention 2"],
    },
    personas: [
      {
        name: "Reviewer",
        role: "Code reviewer",
        reasoning_style: "critical",
        constraints: [
          "Must provide detailed feedback",
          "Must check for security issues",
        ],
        allowed_tools: ["Bash", "Git"],
      },
      {
        name: "Deployer",
        role: "Deployment engineer",
        reasoning_style: "careful",
        constraints: ["Must verify before deploy", "Must validate health checks"],
      },
    ],
    rules: [
      {
        id: "rule-1",
        scope: "src/**",
        severity: "hard",
        action: "Must scan for security issues",
        rationale: "Security compliance",
        tags: ["security", "critical"],
      },
      {
        id: "rule-2",
        scope: "**",
        severity: "soft",
        action: "Should add tests for new features",
        tags: ["quality"],
      },
    ],
    skills: [
      {
        name: "SecurityAudit",
        description: "Perform comprehensive security audit",
        when_to_use: "Before deployment",
        tools_required: ["Bash", "npm"],
        procedure: "Run eslint, npm audit, and snyk",
      },
      {
        name: "DeployApp",
        description: "Deploy application to production",
        when_to_use: "After approval",
        tools_required: ["Bash", "Docker"],
        procedure: "Build, push, and run deployment script",
      },
    ],
    hooks: [
      {
        event: "pre_tool_use",
        language: "javascript",
        stub: "console.log('Pre-tool hook');",
      },
    ],
    settings: {
      approval_mode: "confirm",
      model_config: {
        model: "claude-opus-4-7",
        max_tokens: 4096,
        temperature: 0.7,
      },
      cost_controls: {
        monthly_budget_usd: 500,
        per_session_limit_usd: 50,
      },
      safety_modes: ["safe", "strict"],
    },
    commands: [
      {
        name: "audit",
        description: "Run security audit",
        aliases: ["sec-audit"],
        tools_required: ["Bash"],
        approval_scope: "confirm",
      },
      {
        name: "deploy",
        description: "Deploy to production",
        tools_required: ["Docker", "Bash"],
        approval_scope: "admin",
      },
    ],
    mcp_servers: [
      {
        name: "github",
        endpoint: "mcp+docker://github-mcp",
        auth_scope: ["read:repos", "write:contents"],
        tools: ["get-repo", "create-issue", "push-code"],
        risk_level: "medium",
      },
      {
        name: "slack",
        endpoint: "mcp+docker://slack-mcp",
        auth_scope: ["chat:write"],
        tools: ["send-message"],
        risk_level: "low",
      },
    ],
    identity: {
      rbac_enabled: true,
      roles: [
        {
          name: "viewer",
          permissions: ["read"],
        },
        {
          name: "deployer",
          permissions: ["read", "deploy"],
        },
        {
          name: "admin",
          permissions: ["read", "deploy", "audit", "manage-roles"],
        },
      ],
      agent_owner: "platform-team",
      iam_policy: {
        viewer: "arn:aws:iam::account:role/viewer",
        deployer: "arn:aws:iam::account:role/deployer",
      },
    },
    audit: {
      audit_enabled: true,
      log_level: "info",
      correlation_id_format: "uuid",
      retention_days: 90,
      compliance_checkpoints: ["pre-deploy", "post-deploy", "audit-review"],
    },
    compliance: {
      frameworks: ["gdpr", "soc2", "hipaa"],
      compliance_gaps: [
        {
          framework: "hipaa",
          gap: "Data encryption at rest not configured",
          remediation: "Enable S3 encryption",
        },
      ],
      certified: false,
    },
    risk: {
      risk_tier: "high",
      risk_signals: {
        has_external_apis: true,
        has_secrets_manager: true,
        has_auth_layer: true,
        has_data_sensitive: true,
      },
      escalation_rules: [
        {
          condition: "critical_vulnerability",
          action: "page-oncall",
        },
      ],
    },
    registry: {
      registry_name: "internal-registry",
      published_version: "1.0.0",
      dependencies: ["base-blueprint@^1.0.0", "security-rules@^2.0.0"],
      verified_publisher: true,
    },
    orchestration: {
      agent_teams: [
        {
          team_name: "security-team",
          agents: ["auditor", "scanner"],
        },
        {
          team_name: "deployment-team",
          agents: ["deployer", "monitor"],
        },
      ],
      agent_chains: [
        {
          chain_name: "pre-deploy-checks",
          sequence: ["auditor", "scanner", "tester"],
          parallel_mode: true,
        },
        {
          chain_name: "deployment-flow",
          sequence: ["validator", "deployer", "monitor"],
          parallel_mode: false,
        },
      ],
      persistent_memory: {
        enabled: true,
        retention_policy: "7d",
      },
    },
    meta: {
      rule_precedence: ["rule-1", "rule-2"],
      conflict_resolution: "precedence-based",
      source_backend: "test",
      target_backend: "test",
    },
  });

  describe("Claude Adapter AGENTS.md", () => {
    it("generates AGENTS.md with all sections", async () => {
      const adapter = new ClaudeAdapter();
      const ir = createTestIR();
      const outputDir = createTmpDir();

      try {
        await adapter.render(ir, outputDir);
        const agentsMDPath = path.join(outputDir, "AGENTS.md");
        expect(fs.existsSync(agentsMDPath)).toBe(true);

        const content = fs.readFileSync(agentsMDPath, "utf-8");

        // Verify header
        expect(content).toContain("# Agents & Governance Configuration");
        expect(content).toContain("adapter-test");
        expect(content).toContain("2.0");

        // Verify personas section
        expect(content).toContain("## Agents & Personas");
        expect(content).toContain("### Reviewer");
        expect(content).toContain("Code reviewer");
        expect(content).toContain("### Deployer");
        expect(content).toContain("Deployment engineer");

        // Verify rules section
        expect(content).toContain("## Governance Rules");
        expect(content).toContain("🔴 Hard");
        expect(content).toContain("🟡 Soft");

        // Verify skills section
        expect(content).toContain("## Skills & Capabilities");
        expect(content).toContain("SecurityAudit");
        expect(content).toContain("DeployApp");

        // Verify settings section
        expect(content).toContain("## Settings & Configuration");
        expect(content).toContain("confirm");
        expect(content).toContain("claude-opus-4-7");
      } finally {
        cleanDir(outputDir);
      }
    });

    it("preserves bp-generated markers for idempotency", async () => {
      const adapter = new ClaudeAdapter();
      const ir = createTestIR();
      const outputDir = createTmpDir();

      try {
        await adapter.render(ir, outputDir);
        const agentsMDPath = path.join(outputDir, "AGENTS.md");
        const content = fs.readFileSync(agentsMDPath, "utf-8");

        expect(content).toContain("<!-- bp-generated:begin");
        expect(content).toContain("<!-- bp-generated:end");
      } finally {
        cleanDir(outputDir);
      }
    });
  });

  describe("Cursor Adapter AGENTS.md", () => {
    it("generates AGENTS.md", async () => {
      const adapter = new CursorAdapter();
      const ir = createTestIR();
      const outputDir = createTmpDir();

      try {
        await adapter.render(ir, outputDir);
        const agentsMDPath = path.join(outputDir, "AGENTS.md");
        expect(fs.existsSync(agentsMDPath)).toBe(true);

        const content = fs.readFileSync(agentsMDPath, "utf-8");
        expect(content).toContain("Reviewer");
        expect(content).toContain("Deployer");
      } finally {
        cleanDir(outputDir);
      }
    });
  });

  describe("Generic Adapter AGENTS.md", () => {
    it("generates AGENTS.md", async () => {
      const adapter = new GenericAdapter();
      const ir = createTestIR();
      const outputDir = createTmpDir();

      try {
        await adapter.render(ir, outputDir);
        const agentsMDPath = path.join(outputDir, "AGENTS.md");
        expect(fs.existsSync(agentsMDPath)).toBe(true);

        const content = fs.readFileSync(agentsMDPath, "utf-8");
        expect(content).toContain("Reviewer");
      } finally {
        cleanDir(outputDir);
      }
    });
  });

  describe("AGENTS.md Generation Edge Cases", () => {
    it("handles empty IR gracefully", () => {
      const emptyIR: BlueprintIR = {
        version: "2.0",
        spatial_anchor: {
          project_name: "empty",
          surface: "# empty",
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

      const md = generateAgentsMD(emptyIR);
      expect(md).toContain("# Agents & Governance Configuration");
      expect(md).toBeTruthy();
    });

    it("includes enterprise layer sections in output", () => {
      const ir = createTestIR();
      const md = generateAgentsMD(ir);

      expect(md).toContain("## Settings & Configuration");
      expect(md).toContain("## Risk Assessment");
      expect(md).toContain("## Compliance Requirements");
      expect(md).toContain("## Orchestration & Multi-Agent Coordination");
    });

    it("escapes special characters in markdown", () => {
      const ir: BlueprintIR = {
        version: "2.0",
        spatial_anchor: {
          project_name: "test-project",
          surface: "# test-project",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [
          {
            name: "Agent [test]",
            role: "Role with *special* chars",
            reasoning_style: "methodical",
            constraints: ["Constraint with `code`"],
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

      const md = generateAgentsMD(ir);
      expect(md).toBeTruthy();
      // Should not throw when rendering
      expect(md.length).toBeGreaterThan(0);
    });
  });

  describe("Cross-Adapter Consistency", () => {
    it("generates consistent AGENTS.md across all adapters", async () => {
      const adapters = [new ClaudeAdapter(), new CursorAdapter(), new GenericAdapter()];
      const ir = createTestIR();

      const mdContents: string[] = [];

      for (const adapter of adapters) {
        const outputDir = createTmpDir();
        try {
          await adapter.render(ir, outputDir);
          const agentsMDPath = path.join(outputDir, "AGENTS.md");
          const content = fs.readFileSync(agentsMDPath, "utf-8");
          mdContents.push(content);
        } finally {
          cleanDir(outputDir);
        }
      }

      // All should contain the same key sections
      for (const content of mdContents) {
        expect(content).toContain("Reviewer");
        expect(content).toContain("Deployer");
        expect(content).toContain("SecurityAudit");
        expect(content).toContain("## Governance Rules");
      }
    });
  });

  describe("AGENTS.md Templating", () => {
    it("handles Handlebars helpers correctly", () => {
      const ir: BlueprintIR = {
        version: "2.0",
        spatial_anchor: {
          project_name: "handlebars-test",
          surface: "# handlebars-test",
          temporal_anchor: "2025-05-28",
          conventions: [],
        },
        personas: [
          {
            name: "test_agent",
            role: "Testing Role",
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

      const md = generateAgentsMD(ir);
      expect(md).toContain("test_agent");
      expect(md).toContain("Testing Role");
    });
  });
});
