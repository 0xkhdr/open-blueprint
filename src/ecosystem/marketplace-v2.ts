export interface MarketplaceTemplate {
  name: string;
  version: string;
  author: string;
  verified: boolean;
  rating: number;
  downloads: number;
  dependencies: string[];
  backends: string[];
  frameworks: string[];
  risk_tiers: string[];
  compliance: string[];
  layers: number[];
  min_bp_version: string;
}

export interface MarketplaceRating {
  user: string;
  rating: number;
  comment: string;
  timestamp: string;
  version: string;
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
  verified_only?: boolean;
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

export async function searchMarketplace(
  query: string,
  filters?: MarketplaceFilters
): Promise<MarketplaceSearchResult> {
  const registry = "https://registry.npmjs.org";
  const searchUrl = `${registry}/-/v1/search?text=${encodeURIComponent(`${query} blueprint`)}&size=20`;

  let templates: MarketplaceTemplate[] = [];

  try {
    const response = await fetch(searchUrl);
    if (response.ok) {
      const data = (await response.json()) as { objects?: NpmSearchObject[] };
      templates = (data.objects || []).map((obj: NpmSearchObject) => ({
        name: obj.package?.name || "",
        version: obj.package?.version || "0.0.0",
        author: obj.package?.author?.name || "unknown",
        verified: Boolean(obj.package?.name?.startsWith("@bp-templates/")),
        rating: 0,
        downloads: obj.downloads?.monthly || 0,
        dependencies: Object.keys(obj.package?.dependencies || {}),
        backends: (obj.package?.keywords || [])
          .filter((k: string) => k.startsWith("backend:"))
          .map((k: string) => k.replace("backend:", "")),
        frameworks: (obj.package?.keywords || [])
          .filter((k: string) => k.startsWith("framework:"))
          .map((k: string) => k.replace("framework:", "")),
        risk_tiers: (obj.package?.keywords || [])
          .filter((k: string) => k.startsWith("risk:"))
          .map((k: string) => k.replace("risk:", "")),
        compliance: (obj.package?.keywords || [])
          .filter((k: string) => k.startsWith("compliance:"))
          .map((k: string) => k.replace("compliance:", "")),
        layers: [],
        min_bp_version: obj.package?.engines?.["@agentic/bp"] || "1.0.0",
      }));
    }
  } catch {
    // Return empty on network failure
  }

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
  if (filters?.verified_only) {
    templates = templates.filter((t) => t.verified);
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

export async function rateTemplate(
  templateName: string,
  rating: number,
  comment: string,
  authToken: string
): Promise<void> {
  if (rating < 1 || rating > 5) {
    throw new Error("Rating must be between 1 and 5");
  }

  const response = await fetch("https://marketplace.agentic.dev/api/ratings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    },
    body: JSON.stringify({ template: templateName, rating, comment }),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit rating: ${response.statusText}`);
  }
}

export async function getTemplateRatings(templateName: string): Promise<MarketplaceRating[]> {
  try {
    const response = await fetch(
      `https://marketplace.agentic.dev/api/ratings?template=${encodeURIComponent(templateName)}`
    );
    if (!response.ok) return [];
    return response.json() as Promise<MarketplaceRating[]>;
  } catch {
    return [];
  }
}
