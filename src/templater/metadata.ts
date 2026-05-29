import * as fs from "node:fs";
import matter from "gray-matter";

export interface TemplateMetadata {
  render_if?: {
    risk_tier?: ("low" | "medium" | "high" | "critical")[];
    backend_features?: string[];
    min_bp_version?: string;
    languages?: string[];
    frameworks?: string[];
    project_types?: ("monorepo" | "polyrepo" | "library" | "application" | "service")[];
  };
  inherit_from?: string;
  layers?: number[];
  priority?: number;
}

const TEMPLATE_KEYS = new Set(["render_if", "inherit_from", "layers", "priority"]);

export function parseTemplateMetadata(templatePath: string): TemplateMetadata {
  const content = fs.readFileSync(templatePath, "utf-8");
  try {
    const parsed = matter(content);
    const meta: TemplateMetadata = {};
    if (parsed.data.render_if)
      meta.render_if = parsed.data.render_if as Exclude<TemplateMetadata["render_if"], undefined>;
    if (parsed.data.inherit_from) meta.inherit_from = parsed.data.inherit_from as string;
    if (parsed.data.layers) meta.layers = parsed.data.layers as number[];
    if (parsed.data.priority !== undefined) meta.priority = parsed.data.priority as number;
    return meta;
  } catch {
    return {};
  }
}

export function hasTemplateMetadata(meta: TemplateMetadata): boolean {
  return !!(meta.render_if || meta.inherit_from || meta.layers || meta.priority !== undefined);
}

export function stripMetadata(content: string): string {
  try {
    const parsed = matter(content);
    // Keep non-template keys in output frontmatter
    const remaining: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(parsed.data)) {
      if (!TEMPLATE_KEYS.has(key)) {
        remaining[key] = val;
      }
    }
    if (Object.keys(remaining).length === 0) {
      return parsed.content.replace(/^\n/, "");
    }
    return matter.stringify(parsed.content, remaining);
  } catch {
    return content;
  }
}
