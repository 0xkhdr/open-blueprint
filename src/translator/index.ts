import type { BlueprintIR } from "./ir.js";

export interface BlueprintAdapter {
  parse(projectRoot: string): Promise<BlueprintIR>;
  render(ir: BlueprintIR, projectRoot: string): Promise<string[]>; // Returns list of written files
}

export type { BlueprintIR };

export async function parseBlueprint(projectRoot: string, backend: string): Promise<BlueprintIR> {
  const { ClaudeAdapter } = await import("./adapters/claude.js");
  const { CursorAdapter } = await import("./adapters/cursor.js");
  const { CodexAdapter } = await import("./adapters/codex.js");
  const { PIAdapter } = await import("./adapters/pi.js");
  const { KiroAdapter } = await import("./adapters/kiro.js");
  const { AntigravityAdapter } = await import("./adapters/antigravity.js");
  const { CopilotAdapter } = await import("./adapters/copilot.js");
  const { GeminiAdapter } = await import("./adapters/gemini.js");
  const { OpenDevAdapter } = await import("./adapters/opendev.js");
  const { GenericAdapter } = await import("./adapters/generic.js");

  const adapters: Record<string, BlueprintAdapter> = {
    claude: new ClaudeAdapter(),
    cursor: new CursorAdapter(),
    codex: new CodexAdapter(),
    pi: new PIAdapter(),
    kiro: new KiroAdapter(),
    antigravity: new AntigravityAdapter(),
    copilot: new CopilotAdapter(),
    gemini: new GeminiAdapter(),
    opendev: new OpenDevAdapter(),
    generic: new GenericAdapter(),
  };

  const adapter = adapters[backend.toLowerCase()];
  if (!adapter) throw new Error(`Unknown backend: ${backend}`);
  return adapter.parse(projectRoot);
}
