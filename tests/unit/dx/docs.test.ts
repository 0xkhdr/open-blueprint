import { describe, expect, it } from "vitest";
import { generateMarkdownDocs } from "../../../src/dx/docs.js";
import type { BlueprintIR } from "../../../src/translator/ir.js";

const minimalIR: BlueprintIR = {
  spatial_anchor: {
    project_name: "test-project",
    surface: "claude",
    temporal_anchor: "2026-05-29",
    conventions: [],
  },
  personas: [],
  rules: [],
  skills: [],
  hooks: [],
  meta: {},
};

const fullIR: BlueprintIR = {
  spatial_anchor: {
    project_name: "full-project",
    surface: "claude",
    temporal_anchor: "2026-05-29",
    conventions: ["Use TypeScript", "No any types"],
  },
  personas: [
    {
      name: "Senior Engineer",
      role: "Lead",
      reasoning_style: "analytical",
      constraints: ["no deletion without review"],
      allowed_tools: ["Read", "Edit", "Bash"],
    },
  ],
  rules: [
    {
      id: "rule-001",
      scope: "src/**/*.ts",
      severity: "hard",
      action: "Always add tests for new functions",
    },
  ],
  skills: [
    {
      name: "code-review",
      description: "Review code for quality and security issues in depth",
      when_to_use: "When reviewing PRs",
      procedure: "1. Read the diff\n2. Check for issues",
    },
  ],
  hooks: [],
  settings: {
    approval_mode: "confirm",
    safety_modes: ["strict"],
    model_config: {
      model: "claude-sonnet-4-6",
      temperature: 0.7,
    },
    cost_controls: {
      monthly_budget_usd: 100,
      per_session_limit_usd: 5,
    },
  },
  risk: {
    risk_tier: "medium",
    risk_signals: {
      has_external_integrations: true,
      has_database: false,
    },
    escalation_rules: ["Alert on critical tier changes"],
  },
  compliance: {
    frameworks: ["gdpr", "soc2"],
    certified: false,
    compliance_gaps: [
      { framework: "gdpr", gap: "Missing data retention policy", remediation: "Add retention config" },
    ],
  },
  mcp_servers: [
    {
      name: "filesystem",
      risk_level: "low",
      endpoint: "stdio",
      auth_scope: ["read"],
    },
  ],
  audit: {
    audit_enabled: true,
    log_level: "info",
    retention_days: 90,
    correlation_id_format: "uuid-v4",
  },
  meta: { source_backend: "claude" },
};

describe("generateMarkdownDocs - minimal IR", () => {
  it("includes project name in header", () => {
    const docs = generateMarkdownDocs(minimalIR);
    expect(docs).toContain("test-project");
  });

  it("includes all 9 sections in table of contents", () => {
    const docs = generateMarkdownDocs(minimalIR);
    expect(docs).toContain("Project Overview");
    expect(docs).toContain("Risk Assessment");
    expect(docs).toContain("Agent Governance");
    expect(docs).toContain("Rule Registry");
    expect(docs).toContain("Skill Registry");
    expect(docs).toContain("Compliance Mapping");
    expect(docs).toContain("Settings");
    expect(docs).toContain("MCP Servers");
    expect(docs).toContain("Audit Trail");
  });

  it("shows no agents configured for empty personas", () => {
    const docs = generateMarkdownDocs(minimalIR);
    expect(docs).toContain("No agents configured.");
  });

  it("shows no rules configured for empty rules", () => {
    const docs = generateMarkdownDocs(minimalIR);
    expect(docs).toContain("No rules configured.");
  });

  it("shows no skills configured for empty skills", () => {
    const docs = generateMarkdownDocs(minimalIR);
    expect(docs).toContain("No skills configured.");
  });

  it("shows no compliance mapping for absent compliance", () => {
    const docs = generateMarkdownDocs(minimalIR);
    expect(docs).toContain("No compliance mapping configured.");
  });

  it("shows no settings configured for absent settings", () => {
    const docs = generateMarkdownDocs(minimalIR);
    expect(docs).toContain("No settings configured.");
  });

  it("shows no MCP servers for absent mcp_servers", () => {
    const docs = generateMarkdownDocs(minimalIR);
    expect(docs).toContain("No MCP servers configured.");
  });

  it("shows no audit configuration for absent audit", () => {
    const docs = generateMarkdownDocs(minimalIR);
    expect(docs).toContain("No audit configuration.");
  });
});

describe("generateMarkdownDocs - full IR", () => {
  it("includes project name", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("full-project");
  });

  it("includes conventions", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("Use TypeScript");
    expect(docs).toContain("No any types");
  });

  it("includes agent table with correct data", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("Senior Engineer");
    expect(docs).toContain("Lead");
    expect(docs).toContain("analytical");
    expect(docs).toContain("Read, Edit, Bash");
  });

  it("includes rule table with correct data", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("rule-001");
    expect(docs).toContain("hard");
    expect(docs).toContain("src/**/*.ts");
  });

  it("truncates long rule actions", () => {
    const longRule: BlueprintIR = {
      ...minimalIR,
      rules: [{ id: "r1", scope: "**", severity: "soft", action: "A".repeat(100) }],
    };
    const docs = generateMarkdownDocs(longRule);
    expect(docs).toContain("...");
  });

  it("includes skill table with correct data", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("code-review");
    expect(docs).toContain("Review code for quality and security");
  });

  it("truncates long skill descriptions", () => {
    const longSkill: BlueprintIR = {
      ...minimalIR,
      skills: [{
        name: "test", description: "D".repeat(100), when_to_use: "always", procedure: "do it",
      }],
    };
    const docs = generateMarkdownDocs(longSkill);
    expect(docs).toContain("...");
  });

  it("includes compliance frameworks", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("gdpr");
    expect(docs).toContain("soc2");
  });

  it("includes compliance gaps", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("Missing data retention policy");
    expect(docs).toContain("Add retention config");
  });

  it("includes settings approval mode", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("confirm");
  });

  it("includes settings model config", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("claude-sonnet-4-6");
    expect(docs).toContain("0.7");
  });

  it("includes cost controls", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("$100");
    expect(docs).toContain("$5");
  });

  it("includes MCP server table", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("filesystem");
    expect(docs).toContain("stdio");
    expect(docs).toContain("low");
    expect(docs).toContain("read");
  });

  it("includes audit config", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("✅ Yes");
    expect(docs).toContain("info");
    expect(docs).toContain("90 days");
    expect(docs).toContain("uuid-v4");
  });

  it("includes risk tier", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("medium");
  });

  it("includes risk signals", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("has_external_integrations");
    expect(docs).toContain("has_database");
  });

  it("includes escalation rules", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(docs).toContain("Alert on critical tier changes");
  });

  it("returns a string", () => {
    const docs = generateMarkdownDocs(fullIR);
    expect(typeof docs).toBe("string");
    expect(docs.length).toBeGreaterThan(100);
  });
});
