import type { TemplateMetadata } from "./metadata.js";
import type { BackendManifest } from "./selector.js";

export interface RenderContext {
  risk_tier: "low" | "medium" | "high" | "critical";
  primary_language: string;
  primary_framework: string;
  project_type: string;
  backend_manifest: BackendManifest;
  bp_version: string;
}

export function shouldRenderTemplate(
  meta: TemplateMetadata,
  context: RenderContext
): { render: boolean; reason?: string } {
  if (!meta.render_if) return { render: true };

  if (meta.render_if.risk_tier && !meta.render_if.risk_tier.includes(context.risk_tier)) {
    return {
      render: false,
      reason: `Risk tier '${context.risk_tier}' not in [${meta.render_if.risk_tier.join(", ")}]`,
    };
  }

  if (meta.render_if.backend_features) {
    for (const feat of meta.render_if.backend_features) {
      const supported =
        context.backend_manifest.supported_features?.[
          feat as keyof typeof context.backend_manifest.supported_features
        ];
      if (!supported) {
        return {
          render: false,
          reason: `Backend does not support feature: ${feat}`,
        };
      }
    }
  }

  if (meta.render_if.languages && !meta.render_if.languages.includes(context.primary_language)) {
    return {
      render: false,
      reason: `Language '${context.primary_language}' not in [${meta.render_if.languages.join(", ")}]`,
    };
  }

  if (meta.render_if.frameworks && !meta.render_if.frameworks.includes(context.primary_framework)) {
    return {
      render: false,
      reason: `Framework '${context.primary_framework}' not in [${meta.render_if.frameworks.join(", ")}]`,
    };
  }

  if (
    meta.render_if.project_types &&
    !meta.render_if.project_types.includes(
      context.project_type as "monorepo" | "polyrepo" | "library" | "application" | "service"
    )
  ) {
    return {
      render: false,
      reason: `Project type '${context.project_type}' not in [${meta.render_if.project_types.join(", ")}]`,
    };
  }

  if (meta.render_if.min_bp_version) {
    if (context.bp_version < meta.render_if.min_bp_version) {
      return {
        render: false,
        reason: `Requires bp >= ${meta.render_if.min_bp_version}, have ${context.bp_version}`,
      };
    }
  }

  return { render: true };
}
