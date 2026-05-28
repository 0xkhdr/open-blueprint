import { describe, it, expect } from "vitest";
import {
  validateSettings,
  validateCommands,
  validateMCPServers,
  validateIdentity,
  validateAudit,
  validateCompliance,
  validateRisk,
  validateRegistry,
  validateOrchestration,
} from "../../../src/validator/layers.js";

describe("Layer Validators", () => {
  describe("validateSettings", () => {
    it("passes valid settings object", () => {
      const settings = {
        approval_mode: "confirm",
        cost_controls: { monthly_budget: 1000 },
        safety_modes: ["injection_protection"],
      };
      const errors = validateSettings(settings);
      expect(errors).toHaveLength(0);
    });

    it("passes empty settings object", () => {
      const errors = validateSettings({});
      expect(errors).toHaveLength(0);
    });

    it("rejects invalid approval_mode", () => {
      const settings = { approval_mode: "invalid_mode" };
      const errors = validateSettings(settings);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("validateCommands", () => {
    it("passes array of valid commands", () => {
      const commands = [
        {
          name: "deploy",
          description: "Deploy the app",
          tools_required: ["bash", "git"],
          approval_scope: "admin",
        },
      ];
      const errors = validateCommands(commands);
      expect(errors).toHaveLength(0);
    });

    it("passes empty commands array", () => {
      const errors = validateCommands([]);
      expect(errors).toHaveLength(0);
    });

    it("rejects non-array input", () => {
      const errors = validateCommands("not an array");
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message).toContain("array");
    });

    it("rejects command with invalid approval_scope", () => {
      const commands = [
        {
          name: "test",
          tools_required: [],
          approval_scope: "invalid_scope",
        },
      ];
      const errors = validateCommands(commands);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("validateMCPServers", () => {
    it("passes valid MCP servers", () => {
      const servers = [
        {
          name: "memory-server",
          endpoint: "http://localhost:3000",
          auth_scope: ["read:memory", "write:memory"],
          tools: ["save_memory", "load_memory"],
          risk_level: "low",
        },
      ];
      const errors = validateMCPServers(servers);
      expect(errors).toHaveLength(0);
    });

    it("passes empty servers array", () => {
      const errors = validateMCPServers([]);
      expect(errors).toHaveLength(0);
    });

    it("rejects non-array input", () => {
      const errors = validateMCPServers({ invalid: "object" });
      expect(errors.length).toBeGreaterThan(0);
    });

    it("rejects invalid risk_level", () => {
      const servers = [
        {
          name: "test-server",
          endpoint: "http://localhost",
          tools: [],
          risk_level: "critical", // must be low/medium/high
        },
      ];
      const errors = validateMCPServers(servers);
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe("validateIdentity", () => {
    it("passes valid identity configuration", () => {
      const identity = {
        rbac_enabled: true,
        roles: [
          { name: "admin", permissions: ["read", "write"] },
          { name: "viewer", permissions: ["read"] },
        ],
        agent_owner: "admin@example.com",
        iam_policy: { "read:agents": "allow" },
      };
      const errors = validateIdentity(identity);
      expect(errors).toHaveLength(0);
    });

    it("passes identity with no RBAC", () => {
      const identity = { rbac_enabled: false };
      const errors = validateIdentity(identity);
      expect(errors).toHaveLength(0);
    });

    it("passes empty identity object", () => {
      const errors = validateIdentity({});
      expect(errors).toHaveLength(0);
    });
  });

  describe("validateAudit", () => {
    it("passes valid audit configuration", () => {
      const audit = {
        audit_enabled: true,
        log_level: "info",
        correlation_id_format: "uuid",
        retention_days: 90,
        compliance_checkpoints: ["gdpr", "hipaa"],
      };
      const errors = validateAudit(audit);
      expect(errors).toHaveLength(0);
    });

    it("rejects invalid log_level", () => {
      const audit = { log_level: "invalid_level" };
      const errors = validateAudit(audit);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("passes minimal audit configuration", () => {
      const audit = { audit_enabled: true };
      const errors = validateAudit(audit);
      expect(errors).toHaveLength(0);
    });
  });

  describe("validateCompliance", () => {
    it("passes valid compliance configuration", () => {
      const compliance = {
        frameworks: ["gdpr", "hipaa", "soc2"],
        compliance_gaps: [
          { framework: "gdpr", gap: "Missing audit trail", remediation: "Enable audit logging" },
        ],
        certified: true,
      };
      const errors = validateCompliance(compliance);
      expect(errors).toHaveLength(0);
    });

    it("rejects invalid framework enum", () => {
      const compliance = { frameworks: ["invalid_framework"] };
      const errors = validateCompliance(compliance);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("passes minimal compliance configuration", () => {
      const compliance = { frameworks: ["eu_ai_act"] };
      const errors = validateCompliance(compliance);
      expect(errors).toHaveLength(0);
    });

    it("accepts all valid frameworks", () => {
      const compliance = {
        frameworks: ["eu_ai_act", "iso_42001", "nist_ai_rmf", "gdpr", "hipaa", "soc2"],
      };
      const errors = validateCompliance(compliance);
      expect(errors).toHaveLength(0);
    });
  });

  describe("validateRisk", () => {
    it("passes valid risk configuration", () => {
      const risk = {
        risk_tier: "high",
        risk_signals: {
          has_external_apis: true,
          has_secrets_manager: true,
          has_auth_layer: false,
          has_data_sensitive: true,
        },
        escalation_rules: [{ condition: "On detect", action: "Notify team" }],
      };
      const errors = validateRisk(risk);
      expect(errors).toHaveLength(0);
    });

    it("rejects invalid risk_tier", () => {
      const risk = { risk_tier: "extremely_critical" };
      const errors = validateRisk(risk);
      expect(errors.length).toBeGreaterThan(0);
    });

    it("passes minimal risk configuration", () => {
      const risk = { risk_tier: "medium" };
      const errors = validateRisk(risk);
      expect(errors).toHaveLength(0);
    });

    it("accepts all valid risk tiers", () => {
      for (const tier of ["low", "medium", "high", "critical"]) {
        const errors = validateRisk({ risk_tier: tier });
        expect(errors).toHaveLength(0);
      }
    });
  });

  describe("validateRegistry", () => {
    it("passes valid registry configuration", () => {
      const registry = {
        registry_name: "my-registry",
        published_version: "1.0.0",
        dependencies: ["base-blueprint@^1.0", "utils-blueprint@^2.0"],
        verified_publisher: true,
      };
      const errors = validateRegistry(registry);
      expect(errors).toHaveLength(0);
    });

    it("passes minimal registry configuration", () => {
      const registry = { registry_name: "my-registry" };
      const errors = validateRegistry(registry);
      expect(errors).toHaveLength(0);
    });

    it("passes empty registry object", () => {
      const errors = validateRegistry({});
      expect(errors).toHaveLength(0);
    });
  });

  describe("validateOrchestration", () => {
    it("passes valid orchestration configuration", () => {
      const orchestration = {
        agent_teams: [
          {
            team_name: "review-team",
            agents: ["reviewer-1", "reviewer-2"],
          },
        ],
        agent_chains: [
          {
            chain_name: "review-deploy-chain",
            sequence: ["reviewer", "deployer"],
            parallel_mode: false,
          },
        ],
        persistent_memory: {
          enabled: true,
          retention_policy: "7d",
        },
      };
      const errors = validateOrchestration(orchestration);
      expect(errors).toHaveLength(0);
    });

    it("passes minimal orchestration configuration", () => {
      const orchestration = {};
      const errors = validateOrchestration(orchestration);
      expect(errors).toHaveLength(0);
    });
  });

  describe("Layer Validator Error Messages", () => {
    it("includes field paths in error messages", () => {
      const commands = [
        {
          name: "test",
          tools_required: [],
          approval_scope: "invalid",
        },
      ];
      const errors = validateCommands(commands);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.field).toBeTruthy();
    });

    it("includes issue codes in error messages", () => {
      const audit = { log_level: "invalid" };
      const errors = validateAudit(audit);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]?.message).toMatch(/invalid_value|enum|expected/i);
    });
  });
});
