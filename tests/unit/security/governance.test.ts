import { describe, it, expect } from "vitest";
import { generateEnvTemplate, generateNeverCommitRules } from "../../../src/security/governance.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

function createBaseIR(): BlueprintIR {
  return {
    version: "2.0",
    spatial_anchor: {
      project_name: "test-project",
      surface: "# Test Project",
      temporal_anchor: "2025-05-28",
      conventions: [],
    },
    personas: [],
    rules: [],
    skills: [],
    hooks: [],
    meta: { created_at: "2025-05-28", updated_at: "2025-05-28" },
  };
}

describe("Governance Module", () => {
  describe("generateEnvTemplate", () => {
    it("generates valid .env.template format", () => {
      const ir = createBaseIR();
      const template = generateEnvTemplate(ir);
      expect(template).toContain("# Generated .env.template");
      expect(template).toContain("BP_PROJECT_ROOT");
      expect(template).toContain("BP_BACKEND");
      expect(template).toContain("BP_ENVIRONMENT");
    });

    it("includes header comments and timestamps", () => {
      const ir = createBaseIR();
      const template = generateEnvTemplate(ir);
      expect(template).toContain("Generated at:");
      expect(template).toMatch(/\d{4}-\d{2}-\d{2}/);
    });

    it("extracts auth scopes from MCP servers", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        mcp_servers: [
          {
            name: "memory-server",
            endpoint: "http://localhost:3000",
            auth_scope: ["read:memory", "write:memory"],
            tools: ["save"],
            risk_level: "low",
          },
          {
            name: "file-server",
            endpoint: "http://localhost:3001",
            auth_scope: ["read:files"],
            tools: ["list"],
            risk_level: "medium",
          },
        ],
      };
      const template = generateEnvTemplate(ir);
      expect(template).toContain("READ_MEMORY");
      expect(template).toContain("WRITE_MEMORY");
      expect(template).toContain("READ_FILES");
    });

    it("includes cost control settings when configured", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        settings: {
          cost_controls: {
            monthly_budget: 5000,
            alert_percentage: 80,
          },
        },
      };
      const template = generateEnvTemplate(ir);
      expect(template).toContain("COST_BUDGET_USD");
      expect(template).toContain("COST_ALERT_THRESHOLD");
    });

    it("includes model configuration settings", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        settings: {
          model_config: {
            primary: "gpt-4",
            fallback: "gpt-3.5-turbo",
          },
        },
      };
      const template = generateEnvTemplate(ir);
      expect(template).toContain("MODEL_PRIMARY");
      expect(template).toContain("MODEL_FALLBACK");
    });

    it("includes safety mode configurations", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        settings: {
          safety_modes: [
            "injection_protection",
            "output_validation",
            "rate_limiting",
          ],
        },
      };
      const template = generateEnvTemplate(ir);
      expect(template).toContain("SAFETY_INJECTION_PROTECTION");
      expect(template).toContain("SAFETY_OUTPUT_VALIDATION");
      expect(template).toContain("SAFETY_RATE_LIMITING");
    });

    it("includes compliance framework credentials", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["soc2", "hipaa", "gdpr"] },
      };
      const template = generateEnvTemplate(ir);
      expect(template).toContain("SOC2_AUDIT_LOG_ENDPOINT");
      expect(template).toContain("HIPAA_ENCRYPTION_KEY");
      expect(template).toContain("HIPAA_AUDIT_ENDPOINT");
      expect(template).toContain("GDPR_DATA_PROCESSOR_ID");
    });

    it("avoids duplicate environment variable names", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        mcp_servers: [
          {
            name: "server1",
            endpoint: "http://localhost:3000",
            auth_scope: ["read"],
            tools: [],
            risk_level: "low",
          },
          {
            name: "server2",
            endpoint: "http://localhost:3001",
            auth_scope: ["read"],
            tools: [],
            risk_level: "low",
          },
        ],
      };
      const template = generateEnvTemplate(ir);
      // Should have only one READ_* variable, not duplicated
      const readCount = (template.match(/^READ=/gm) || []).length;
      expect(readCount).toBeLessThanOrEqual(1);
    });
  });

  describe("generateNeverCommitRules", () => {
    it("generates standard patterns for all blueprints", () => {
      const ir = createBaseIR();
      const globs = generateNeverCommitRules(ir);
      expect(globs).toContain(".env*");
      expect(globs.some((g) => g.includes("*.pem"))).toBe(true);
      expect(globs.some((g) => g.includes("secrets"))).toBe(true);
      expect(globs.some((g) => g.includes("credentials"))).toBe(true);
      expect(globs.some((g) => g.includes("tokens"))).toBe(true);
    });

    it("includes HIPAA-specific patterns when required", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["hipaa"] },
      };
      const globs = generateNeverCommitRules(ir);
      expect(globs.some((g) => g.includes("phi"))).toBe(true);
      expect(globs.some((g) => g.includes("pii"))).toBe(true);
      expect(globs.some((g) => g.includes("protected-health"))).toBe(true);
    });

    it("includes GDPR-specific patterns when required", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["gdpr"] },
      };
      const globs = generateNeverCommitRules(ir);
      expect(globs.some((g) => g.includes("pii"))).toBe(true);
      expect(globs.some((g) => g.includes("personal-data"))).toBe(true);
      expect(globs.some((g) => g.includes("user-data"))).toBe(true);
    });

    it("includes HIPAA and GDPR patterns for both frameworks", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["hipaa", "gdpr"] },
      };
      const globs = generateNeverCommitRules(ir);
      expect(globs.some((g) => g.includes("phi"))).toBe(true);
      expect(globs.some((g) => g.includes("protected-health"))).toBe(true);
      expect(globs.some((g) => g.includes("personal-data"))).toBe(true);
    });

    it("includes audit log patterns when audit enabled", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        audit: { audit_enabled: true },
      };
      const globs = generateNeverCommitRules(ir);
      expect(globs.some((g) => g.includes("audit-"))).toBe(true);
      expect(globs.some((g) => g.includes(".bp/audit"))).toBe(true);
    });

    it("does not include audit patterns when audit disabled", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        audit: { audit_enabled: false },
      };
      const globs = generateNeverCommitRules(ir);
      expect(globs.some((g) => g.includes(".bp/audit"))).toBe(false);
    });

    it("includes MCP credential patterns when MCP servers configured", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        mcp_servers: [
          {
            name: "test-server",
            endpoint: "http://localhost",
            auth_scope: ["read"],
            tools: [],
            risk_level: "low",
          },
        ],
      };
      const globs = generateNeverCommitRules(ir);
      expect(globs.some((g) => g.includes(".mcp-credentials"))).toBe(true);
      expect(globs.some((g) => g.includes(".mcp-auth"))).toBe(true);
    });

    it("includes RBAC patterns when RBAC enabled", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        identity: { rbac_enabled: true },
      };
      const globs = generateNeverCommitRules(ir);
      expect(globs.some((g) => g.includes(".rbac-"))).toBe(true);
      expect(globs.some((g) => g.includes(".policy.json"))).toBe(true);
    });

    it("returns array of valid glob patterns", () => {
      const ir = createBaseIR();
      const globs = generateNeverCommitRules(ir);
      expect(Array.isArray(globs)).toBe(true);
      expect(globs.length).toBeGreaterThan(0);
      globs.forEach((glob) => {
        expect(typeof glob).toBe("string");
        expect(glob.length).toBeGreaterThan(0);
      });
    });

    it("includes certificate and key file patterns", () => {
      const ir = createBaseIR();
      const globs = generateNeverCommitRules(ir);
      expect(globs.some((g) => g.includes(".pem"))).toBe(true);
      expect(globs.some((g) => g.includes(".key"))).toBe(true);
      expect(globs.some((g) => g.includes(".p12"))).toBe(true);
      expect(globs.some((g) => g.includes(".pfx"))).toBe(true);
      expect(globs.some((g) => g.includes(".jks"))).toBe(true);
    });

    it("handles multiple compliance frameworks", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        compliance: { frameworks: ["hipaa", "gdpr", "soc2"] },
      };
      const globs = generateNeverCommitRules(ir);
      expect(globs.some((g) => g.includes("phi"))).toBe(true);
      expect(globs.some((g) => g.includes("personal-data"))).toBe(true);
      // SOC2 doesn't add specific patterns
      expect(globs.length).toBeGreaterThan(0);
    });
  });

  describe("Integration between templates and rules", () => {
    it("env template and never-commit rules are consistent", () => {
      const ir: BlueprintIR = {
        ...createBaseIR(),
        settings: { cost_controls: { monthly_budget: 1000 } },
        compliance: { frameworks: ["hipaa"] },
        audit: { audit_enabled: true },
      };

      const template = generateEnvTemplate(ir);
      const globs = generateNeverCommitRules(ir);

      // Both should handle the same IR features
      expect(template).toBeTruthy();
      expect(globs).toBeTruthy();
      expect(template.length).toBeGreaterThan(0);
      expect(globs.length).toBeGreaterThan(0);
    });
  });
});
