import { describe, expect, it } from "vitest";
import { shouldRenderTemplate } from "../../../src/templater/conditional.js";
import type { RenderContext } from "../../../src/templater/conditional.js";
import type { TemplateMetadata } from "../../../src/templater/metadata.js";

const baseManifest = {
  backend: "claude",
  version: "1.0.0",
  supported_features: {
    anchors: true,
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
  },
  file_patterns: {
    anchor: [".claude/CLAUDE.md"],
    rules: ".claude/rules/*.md",
    skills: ".claude/skills/*.md",
    agents: ".claude/agents/*.md",
    hooks: ".claude/hooks/*.js",
  },
  max_file_sizes: { anchor: 50000, rules: 10000, skills: 10000, agents: 10000 },
  frontmatter_schema: {
    rules: { required: ["scope", "severity", "action"], optional: ["tags", "rationale"], severity_values: ["hard", "soft"] },
    skills: { required: ["name"], optional: ["description"] },
    agents: { required: ["name"], optional: ["description"] },
  },
};

const baseContext: RenderContext = {
  risk_tier: "medium",
  primary_language: "typescript",
  primary_framework: "express",
  project_type: "application",
  backend_manifest: baseManifest,
  bp_version: "1.0.0",
};

describe("shouldRenderTemplate — no conditions", () => {
  it("renders when no render_if", () => {
    expect(shouldRenderTemplate({}, baseContext).render).toBe(true);
  });

  it("renders when render_if is empty object", () => {
    expect(shouldRenderTemplate({ render_if: {} }, baseContext).render).toBe(true);
  });
});

describe("shouldRenderTemplate — risk_tier", () => {
  it("renders when risk_tier matches", () => {
    const meta: TemplateMetadata = { render_if: { risk_tier: ["medium", "high"] } };
    expect(shouldRenderTemplate(meta, baseContext).render).toBe(true);
  });

  it("skips when risk_tier does not match", () => {
    const meta: TemplateMetadata = { render_if: { risk_tier: ["high", "critical"] } };
    const result = shouldRenderTemplate(meta, baseContext);
    expect(result.render).toBe(false);
    expect(result.reason).toContain("medium");
  });

  it("renders for critical tier matching critical list", () => {
    const ctx = { ...baseContext, risk_tier: "critical" as const };
    const meta: TemplateMetadata = { render_if: { risk_tier: ["high", "critical"] } };
    expect(shouldRenderTemplate(meta, ctx).render).toBe(true);
  });

  it("skips low tier for medium+ only template", () => {
    const ctx = { ...baseContext, risk_tier: "low" as const };
    const meta: TemplateMetadata = { render_if: { risk_tier: ["medium", "high", "critical"] } };
    expect(shouldRenderTemplate(meta, ctx).render).toBe(false);
  });
});

describe("shouldRenderTemplate — backend_features", () => {
  it("renders when all features supported", () => {
    const meta: TemplateMetadata = { render_if: { backend_features: ["rules", "skills"] } };
    expect(shouldRenderTemplate(meta, baseContext).render).toBe(true);
  });

  it("skips when feature not supported", () => {
    const manifest = {
      ...baseManifest,
      supported_features: { ...baseManifest.supported_features, hooks: false },
    };
    const ctx = { ...baseContext, backend_manifest: manifest };
    const meta: TemplateMetadata = { render_if: { backend_features: ["hooks"] } };
    const result = shouldRenderTemplate(meta, ctx);
    expect(result.render).toBe(false);
    expect(result.reason).toContain("hooks");
  });
});

describe("shouldRenderTemplate — languages", () => {
  it("renders when language matches", () => {
    const meta: TemplateMetadata = { render_if: { languages: ["typescript", "javascript"] } };
    expect(shouldRenderTemplate(meta, baseContext).render).toBe(true);
  });

  it("skips when language does not match", () => {
    const meta: TemplateMetadata = { render_if: { languages: ["python", "go"] } };
    const result = shouldRenderTemplate(meta, baseContext);
    expect(result.render).toBe(false);
    expect(result.reason).toContain("typescript");
  });
});

describe("shouldRenderTemplate — frameworks", () => {
  it("renders when framework matches", () => {
    const meta: TemplateMetadata = { render_if: { frameworks: ["express", "fastapi"] } };
    expect(shouldRenderTemplate(meta, baseContext).render).toBe(true);
  });

  it("skips when framework does not match", () => {
    const meta: TemplateMetadata = { render_if: { frameworks: ["nextjs"] } };
    const result = shouldRenderTemplate(meta, baseContext);
    expect(result.render).toBe(false);
    expect(result.reason).toContain("express");
  });
});

describe("shouldRenderTemplate — project_types", () => {
  it("renders when project type matches", () => {
    const meta: TemplateMetadata = {
      render_if: { project_types: ["application", "service"] },
    };
    expect(shouldRenderTemplate(meta, baseContext).render).toBe(true);
  });

  it("skips when project type does not match", () => {
    const meta: TemplateMetadata = { render_if: { project_types: ["library"] } };
    const result = shouldRenderTemplate(meta, baseContext);
    expect(result.render).toBe(false);
    expect(result.reason).toContain("application");
  });
});

describe("shouldRenderTemplate — min_bp_version", () => {
  it("renders when version meets minimum", () => {
    const meta: TemplateMetadata = { render_if: { min_bp_version: "1.0.0" } };
    expect(shouldRenderTemplate(meta, baseContext).render).toBe(true);
  });

  it("renders when version exceeds minimum", () => {
    const ctx = { ...baseContext, bp_version: "2.0.0" };
    const meta: TemplateMetadata = { render_if: { min_bp_version: "1.0.0" } };
    expect(shouldRenderTemplate(meta, ctx).render).toBe(true);
  });

  it("skips when version below minimum", () => {
    const ctx = { ...baseContext, bp_version: "0.9.0" };
    const meta: TemplateMetadata = { render_if: { min_bp_version: "1.0.0" } };
    const result = shouldRenderTemplate(meta, ctx);
    expect(result.render).toBe(false);
    expect(result.reason).toContain("1.0.0");
  });
});

describe("shouldRenderTemplate — combined conditions", () => {
  it("renders when all conditions pass", () => {
    const meta: TemplateMetadata = {
      render_if: {
        risk_tier: ["medium", "high"],
        languages: ["typescript"],
        backend_features: ["rules"],
      },
    };
    expect(shouldRenderTemplate(meta, baseContext).render).toBe(true);
  });

  it("skips when first condition fails (risk_tier)", () => {
    const meta: TemplateMetadata = {
      render_if: {
        risk_tier: ["critical"],
        languages: ["typescript"],
      },
    };
    const result = shouldRenderTemplate(meta, baseContext);
    expect(result.render).toBe(false);
  });

  it("skips when second condition fails (language)", () => {
    const meta: TemplateMetadata = {
      render_if: {
        risk_tier: ["medium"],
        languages: ["python"],
      },
    };
    const result = shouldRenderTemplate(meta, baseContext);
    expect(result.render).toBe(false);
  });
});
