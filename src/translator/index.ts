import type { BlueprintIR } from "./ir.js";

export interface BlueprintAdapter {
  parse(projectRoot: string): Promise<BlueprintIR>;
  render(ir: BlueprintIR, projectRoot: string): Promise<string[]>;
}

export type { BlueprintIR };

export class UnsupportedBackendError extends Error {
  constructor(backend: string) {
    super(`Unknown backend: ${backend}`);
    this.name = "UnsupportedBackendError";
  }
}

// Allowlisted backends prevent path traversal via dynamic imports
const ADAPTER_LOADERS: Record<string, () => Promise<BlueprintAdapter>> = {
  claude: async () => { const m = await import("./adapters/claude.js"); return new m.ClaudeAdapter(); },
  cursor: async () => { const m = await import("./adapters/cursor.js"); return new m.CursorAdapter(); },
  codex: async () => { const m = await import("./adapters/codex.js"); return new m.CodexAdapter(); },
  pi: async () => { const m = await import("./adapters/pi.js"); return new m.PIAdapter(); },
  kiro: async () => { const m = await import("./adapters/kiro.js"); return new m.KiroAdapter(); },
  antigravity: async () => { const m = await import("./adapters/antigravity.js"); return new m.AntigravityAdapter(); },
  "github-copilot": async () => { const m = await import("./adapters/copilot.js"); return new m.CopilotAdapter(); },
  copilot: async () => { const m = await import("./adapters/copilot.js"); return new m.CopilotAdapter(); },
  gemini: async () => { const m = await import("./adapters/gemini.js"); return new m.GeminiAdapter(); },
  opendev: async () => { const m = await import("./adapters/opendev.js"); return new m.OpenDevAdapter(); },
  generic: async () => { const m = await import("./adapters/generic.js"); return new m.GenericAdapter(); },
  "amazon-q": async () => { const m = await import("./adapters/amazon-q.js"); return new m.AmazonQAdapter(); },
  auggie: async () => { const m = await import("./adapters/auggie.js"); return new m.AuggieAdapter(); },
  bob: async () => { const m = await import("./adapters/bob.js"); return new m.BobAdapter(); },
  cline: async () => { const m = await import("./adapters/cline.js"); return new m.ClineAdapter(); },
  codebuddy: async () => { const m = await import("./adapters/codebuddy.js"); return new m.CodeBuddyAdapter(); },
  continue: async () => { const m = await import("./adapters/continue.js"); return new m.ContinueAdapter(); },
  costrict: async () => { const m = await import("./adapters/costrict.js"); return new m.CostrictAdapter(); },
  crush: async () => { const m = await import("./adapters/crush.js"); return new m.CrushAdapter(); },
  factory: async () => { const m = await import("./adapters/factory.js"); return new m.FactoryAdapter(); },
  forgecode: async () => { const m = await import("./adapters/forgecode.js"); return new m.ForgeCodeAdapter(); },
  iflow: async () => { const m = await import("./adapters/iflow.js"); return new m.IFlowAdapter(); },
  junie: async () => { const m = await import("./adapters/junie.js"); return new m.JunieAdapter(); },
  kilocode: async () => { const m = await import("./adapters/kilocode.js"); return new m.KiloCodeAdapter(); },
  kimi: async () => { const m = await import("./adapters/kimi.js"); return new m.KimiAdapter(); },
  lingma: async () => { const m = await import("./adapters/lingma.js"); return new m.LingmaAdapter(); },
  opencode: async () => { const m = await import("./adapters/opencode.js"); return new m.OpenCodeAdapter(); },
  qoder: async () => { const m = await import("./adapters/qoder.js"); return new m.QoderAdapter(); },
  qwen: async () => { const m = await import("./adapters/qwen.js"); return new m.QwenAdapter(); },
  roocode: async () => { const m = await import("./adapters/roocode.js"); return new m.RooCodeAdapter(); },
  trae: async () => { const m = await import("./adapters/trae.js"); return new m.TraeAdapter(); },
  windsurf: async () => { const m = await import("./adapters/windsurf.js"); return new m.WindsurfAdapter(); },
};

export async function getAdapter(backend: string): Promise<BlueprintAdapter> {
  const normalized = backend.toLowerCase();
  const loader = ADAPTER_LOADERS[normalized];
  if (!loader) {
    throw new UnsupportedBackendError(normalized);
  }
  return loader();
}

export async function parseBlueprint(projectRoot: string, backend: string): Promise<BlueprintIR> {
  const adapter = await getAdapter(backend);
  return adapter.parse(projectRoot);
}

export async function renderBlueprint(
  ir: BlueprintIR,
  projectRoot: string,
  backend: string
): Promise<string[]> {
  const adapter = await getAdapter(backend);
  return adapter.render(ir, projectRoot);
}
