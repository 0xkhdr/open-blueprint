import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  hasTemplateMetadata,
  parseTemplateMetadata,
  stripMetadata,
} from "../../../src/templater/metadata.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-meta-test-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function writeTemplate(name: string, content: string): string {
  const p = path.join(tmpDir, name);
  fs.writeFileSync(p, content, "utf-8");
  return p;
}

describe("parseTemplateMetadata", () => {
  it("returns empty object when no frontmatter", () => {
    const p = writeTemplate("no-fm.hbs", "# Hello\nworld");
    expect(parseTemplateMetadata(p)).toEqual({});
  });

  it("parses render_if.risk_tier", () => {
    const p = writeTemplate(
      "risk.hbs",
      "---\nrender_if:\n  risk_tier: [high, critical]\n---\n# Content"
    );
    const meta = parseTemplateMetadata(p);
    expect(meta.render_if?.risk_tier).toEqual(["high", "critical"]);
  });

  it("parses render_if.languages", () => {
    const p = writeTemplate(
      "lang.hbs",
      "---\nrender_if:\n  languages: [typescript, javascript]\n---\n# Content"
    );
    const meta = parseTemplateMetadata(p);
    expect(meta.render_if?.languages).toEqual(["typescript", "javascript"]);
  });

  it("parses render_if.frameworks", () => {
    const p = writeTemplate(
      "fw.hbs",
      "---\nrender_if:\n  frameworks: [nextjs]\n---\n# Content"
    );
    expect(parseTemplateMetadata(p).render_if?.frameworks).toEqual(["nextjs"]);
  });

  it("parses render_if.project_types", () => {
    const p = writeTemplate(
      "pt.hbs",
      "---\nrender_if:\n  project_types: [monorepo, library]\n---\n# Content"
    );
    expect(parseTemplateMetadata(p).render_if?.project_types).toEqual(["monorepo", "library"]);
  });

  it("parses render_if.min_bp_version", () => {
    const p = writeTemplate(
      "ver.hbs",
      "---\nrender_if:\n  min_bp_version: '2.0'\n---\n# Content"
    );
    expect(parseTemplateMetadata(p).render_if?.min_bp_version).toBe("2.0");
  });

  it("parses render_if.backend_features", () => {
    const p = writeTemplate(
      "feat.hbs",
      "---\nrender_if:\n  backend_features: [rules, skills]\n---\n# Content"
    );
    expect(parseTemplateMetadata(p).render_if?.backend_features).toEqual(["rules", "skills"]);
  });

  it("parses inherit_from", () => {
    const p = writeTemplate(
      "inh.hbs",
      "---\ninherit_from: base.md.hbs\n---\n# Content"
    );
    expect(parseTemplateMetadata(p).inherit_from).toBe("base.md.hbs");
  });

  it("parses layers", () => {
    const p = writeTemplate("lay.hbs", "---\nlayers: [1, 2, 3]\n---\n# Content");
    expect(parseTemplateMetadata(p).layers).toEqual([1, 2, 3]);
  });

  it("parses priority", () => {
    const p = writeTemplate("pri.hbs", "---\npriority: 42\n---\n# Content");
    expect(parseTemplateMetadata(p).priority).toBe(42);
  });

  it("ignores non-template frontmatter keys", () => {
    const p = writeTemplate(
      "rule.hbs",
      "---\nscope: '**/*'\nseverity: hard\ntags: [security]\n---\n# Content"
    );
    const meta = parseTemplateMetadata(p);
    expect(meta.render_if).toBeUndefined();
    expect(meta.inherit_from).toBeUndefined();
    expect((meta as Record<string, unknown>).scope).toBeUndefined();
  });

  it("returns empty on parse error", () => {
    const p = writeTemplate("bad.hbs", "---\n: invalid: yaml: [\n---\n# Content");
    expect(parseTemplateMetadata(p)).toEqual({});
  });
});

describe("hasTemplateMetadata", () => {
  it("returns false for empty metadata", () => {
    expect(hasTemplateMetadata({})).toBe(false);
  });

  it("returns true when render_if present", () => {
    expect(hasTemplateMetadata({ render_if: { risk_tier: ["low"] } })).toBe(true);
  });

  it("returns true when inherit_from present", () => {
    expect(hasTemplateMetadata({ inherit_from: "base.hbs" })).toBe(true);
  });

  it("returns true when layers present", () => {
    expect(hasTemplateMetadata({ layers: [1, 2] })).toBe(true);
  });

  it("returns true when priority present", () => {
    expect(hasTemplateMetadata({ priority: 0 })).toBe(true);
  });
});

describe("stripMetadata", () => {
  it("returns content unchanged when no frontmatter", () => {
    const content = "# Hello\nworld";
    expect(stripMetadata(content)).toBe(content);
  });

  it("strips render_if from frontmatter, keeps non-template keys", () => {
    const content =
      "---\nrender_if:\n  risk_tier: [high]\nscope: '**/*'\nseverity: hard\n---\n# Body";
    const result = stripMetadata(content);
    expect(result).not.toContain("render_if");
    expect(result).toContain("scope");
    expect(result).toContain("severity");
    expect(result).toContain("# Body");
  });

  it("removes entire frontmatter block when only template keys present", () => {
    const content = "---\nrender_if:\n  risk_tier: [low]\npriority: 10\n---\n# Body";
    const result = stripMetadata(content);
    expect(result).not.toContain("---");
    expect(result).toContain("# Body");
  });

  it("strips inherit_from from frontmatter", () => {
    const content = "---\ninherit_from: base.hbs\nscope: '**/*'\n---\n# Body";
    const result = stripMetadata(content);
    expect(result).not.toContain("inherit_from");
    expect(result).toContain("scope");
  });

  it("strips layers and priority when alone", () => {
    const content = "---\nlayers: [1, 2]\npriority: 5\n---\n# Body";
    const result = stripMetadata(content);
    expect(result).not.toContain("layers");
    expect(result).not.toContain("priority");
  });

  it("preserves body content after strip", () => {
    const content = "---\nrender_if:\n  risk_tier: [high]\n---\n# Security\n\nContent here.";
    const result = stripMetadata(content);
    expect(result).toContain("# Security");
    expect(result).toContain("Content here.");
  });
});
