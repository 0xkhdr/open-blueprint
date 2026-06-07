export interface MarketplaceTemplate {
  name: string;
  version: string;
  author: string;
  /**
   * True when the package lives under the official `@bp-templates/` npm scope.
   * This is a namespace check only — it is not an audit or endorsement.
   */
  official: boolean;
  downloads: number;
  dependencies: string[];
  backends: string[];
  frameworks: string[];
  risk_tiers: string[];
  compliance: string[];
  min_bp_version: string;
}

export interface MarketplaceSearchResult {
  templates: MarketplaceTemplate[];
  total: number;
  filters: {
    backends: string[];
    frameworks: string[];
    risk_tiers: string[];
    compliance: string[];
  };
}

export interface MarketplaceFilters {
  backend?: string;
  framework?: string;
  risk_tier?: string;
  compliance?: string;
  official_only?: boolean;
}

interface NpmSearchObject {
  package?: {
    name?: string;
    version?: string;
    author?: { name?: string };
    keywords?: string[];
    dependencies?: Record<string, string>;
    engines?: Record<string, string>;
  };
  downloads?: { monthly?: number };
}

/**
 * Search the public npm registry for blueprint template packages. Templates are
 * ordinary npm packages tagged with `backend:`, `framework:`, `risk:`, and
 * `compliance:` keywords; this function queries the live registry and maps the
 * results. Network/registry errors are surfaced to the caller (not swallowed),
 * so an offline run reports a failure rather than an empty — and misleading —
 * result set.
 */
export async function searchMarketplace(
  query: string,
  filters?: MarketplaceFilters
): Promise<MarketplaceSearchResult> {
  const registry = "https://registry.npmjs.org";
  const searchUrl = `${registry}/-/v1/search?text=${encodeURIComponent(`${query} blueprint`)}&size=20`;

  const response = await fetch(searchUrl);
  if (!response.ok) {
    throw new Error(`npm registry search failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as { objects?: NpmSearchObject[] };
  let templates: MarketplaceTemplate[] = (data.objects || []).map((obj: NpmSearchObject) => ({
    name: obj.package?.name || "",
    version: obj.package?.version || "0.0.0",
    author: obj.package?.author?.name || "unknown",
    official: Boolean(obj.package?.name?.startsWith("@bp-templates/")),
    downloads: obj.downloads?.monthly || 0,
    dependencies: Object.keys(obj.package?.dependencies || {}),
    backends: keywordValues(obj.package?.keywords, "backend:"),
    frameworks: keywordValues(obj.package?.keywords, "framework:"),
    risk_tiers: keywordValues(obj.package?.keywords, "risk:"),
    compliance: keywordValues(obj.package?.keywords, "compliance:"),
    min_bp_version: obj.package?.engines?.["@agentic/bp"] || "1.0.0",
  }));

  if (filters?.backend) {
    const backend = filters.backend;
    templates = templates.filter((t) => t.backends.includes(backend));
  }
  if (filters?.framework) {
    const framework = filters.framework;
    templates = templates.filter((t) => t.frameworks.includes(framework));
  }
  if (filters?.risk_tier) {
    const risk_tier = filters.risk_tier;
    templates = templates.filter((t) => t.risk_tiers.includes(risk_tier));
  }
  if (filters?.compliance) {
    const compliance = filters.compliance;
    templates = templates.filter((t) => t.compliance.includes(compliance));
  }
  if (filters?.official_only) {
    templates = templates.filter((t) => t.official);
  }

  return {
    templates,
    total: templates.length,
    filters: {
      backends: [...new Set(templates.flatMap((t) => t.backends))],
      frameworks: [...new Set(templates.flatMap((t) => t.frameworks))],
      risk_tiers: [...new Set(templates.flatMap((t) => t.risk_tiers))],
      compliance: [...new Set(templates.flatMap((t) => t.compliance))],
    },
  };
}

function keywordValues(keywords: string[] | undefined, prefix: string): string[] {
  return (keywords || []).filter((k) => k.startsWith(prefix)).map((k) => k.replace(prefix, ""));
}
