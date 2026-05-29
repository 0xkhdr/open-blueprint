import type { BlueprintIR } from "./ir.js";

export interface BlueprintAdapter {
  parse(projectRoot: string): Promise<BlueprintIR>;
  render(ir: BlueprintIR, projectRoot: string): Promise<string[]>;
}

export type { BlueprintIR };

async function buildAdapterMap(): Promise<Record<string, BlueprintAdapter>> {
  const [
    { ClaudeAdapter },
    { CursorAdapter },
    { CodexAdapter },
    { PIAdapter },
    { KiroAdapter },
    { AntigravityAdapter },
    { CopilotAdapter },
    { GeminiAdapter },
    { OpenDevAdapter },
    { GenericAdapter },
    { AmazonQAdapter },
    { AuggieAdapter },
    { BobAdapter },
    { ClineAdapter },
    { CodeBuddyAdapter },
    { ContinueAdapter },
    { CostrictAdapter },
    { CrushAdapter },
    { FactoryAdapter },
    { ForgeCodeAdapter },
    { IFlowAdapter },
    { JunieAdapter },
    { KiloCodeAdapter },
    { KimiAdapter },
    { LingmaAdapter },
    { OpenCodeAdapter },
    { QoderAdapter },
    { QwenAdapter },
    { RooCodeAdapter },
    { TraeAdapter },
    { WindsurfAdapter },
  ] = await Promise.all([
    import("./adapters/claude.js"),
    import("./adapters/cursor.js"),
    import("./adapters/codex.js"),
    import("./adapters/pi.js"),
    import("./adapters/kiro.js"),
    import("./adapters/antigravity.js"),
    import("./adapters/copilot.js"),
    import("./adapters/gemini.js"),
    import("./adapters/opendev.js"),
    import("./adapters/generic.js"),
    import("./adapters/amazon-q.js"),
    import("./adapters/auggie.js"),
    import("./adapters/bob.js"),
    import("./adapters/cline.js"),
    import("./adapters/codebuddy.js"),
    import("./adapters/continue.js"),
    import("./adapters/costrict.js"),
    import("./adapters/crush.js"),
    import("./adapters/factory.js"),
    import("./adapters/forgecode.js"),
    import("./adapters/iflow.js"),
    import("./adapters/junie.js"),
    import("./adapters/kilocode.js"),
    import("./adapters/kimi.js"),
    import("./adapters/lingma.js"),
    import("./adapters/opencode.js"),
    import("./adapters/qoder.js"),
    import("./adapters/qwen.js"),
    import("./adapters/roocode.js"),
    import("./adapters/trae.js"),
    import("./adapters/windsurf.js"),
  ]);

  return {
    claude: new ClaudeAdapter(),
    cursor: new CursorAdapter(),
    codex: new CodexAdapter(),
    pi: new PIAdapter(),
    kiro: new KiroAdapter(),
    antigravity: new AntigravityAdapter(),
    "github-copilot": new CopilotAdapter(),
    copilot: new CopilotAdapter(),
    gemini: new GeminiAdapter(),
    opendev: new OpenDevAdapter(),
    generic: new GenericAdapter(),
    "amazon-q": new AmazonQAdapter(),
    auggie: new AuggieAdapter(),
    bob: new BobAdapter(),
    cline: new ClineAdapter(),
    codebuddy: new CodeBuddyAdapter(),
    continue: new ContinueAdapter(),
    costrict: new CostrictAdapter(),
    crush: new CrushAdapter(),
    factory: new FactoryAdapter(),
    forgecode: new ForgeCodeAdapter(),
    iflow: new IFlowAdapter(),
    junie: new JunieAdapter(),
    kilocode: new KiloCodeAdapter(),
    kimi: new KimiAdapter(),
    lingma: new LingmaAdapter(),
    opencode: new OpenCodeAdapter(),
    qoder: new QoderAdapter(),
    qwen: new QwenAdapter(),
    roocode: new RooCodeAdapter(),
    trae: new TraeAdapter(),
    windsurf: new WindsurfAdapter(),
  };
}

export async function parseBlueprint(projectRoot: string, backend: string): Promise<BlueprintIR> {
  const adapters = await buildAdapterMap();
  const adapter = adapters[backend.toLowerCase()];
  if (!adapter) throw new Error(`Unknown backend: ${backend}`);
  return adapter.parse(projectRoot);
}

export async function renderBlueprint(
  ir: BlueprintIR,
  projectRoot: string,
  backend: string
): Promise<string[]> {
  const adapters = await buildAdapterMap();
  const adapter = adapters[backend.toLowerCase()];
  if (!adapter) throw new Error(`Unknown backend: ${backend}`);
  return adapter.render(ir, projectRoot);
}
