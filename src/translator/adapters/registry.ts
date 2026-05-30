import type { BlueprintAdapter } from "../index.js";
import { AntigravityAdapter } from "./antigravity.js";
import { ClaudeAdapter } from "./claude.js";
import { CodexAdapter } from "./codex.js";
import { CopilotAdapter } from "./copilot.js";
import { CursorAdapter } from "./cursor.js";
import { GeminiAdapter } from "./gemini.js";
import { GenericAdapter } from "./generic.js";
import { KiroAdapter } from "./kiro.js";
import { PIAdapter } from "./pi.js";

export type KnownBackend =
  | "claude"
  | "cursor"
  | "codex"
  | "pi"
  | "copilot"
  | "gemini"
  | "kiro"
  | "antigravity";

const adapterRegistryObject: Record<KnownBackend, () => BlueprintAdapter> = {
  claude: () => new ClaudeAdapter(),
  cursor: () => new CursorAdapter(),
  codex: () => new CodexAdapter(),
  pi: () => new PIAdapter(),
  copilot: () => new CopilotAdapter(),
  gemini: () => new GeminiAdapter(),
  kiro: () => new KiroAdapter(),
  antigravity: () => new AntigravityAdapter(),
};

export const adapterRegistry: Map<string, () => BlueprintAdapter> = new Map(
  Object.entries(adapterRegistryObject)
);

export function getRegisteredAdapter(backend: string): BlueprintAdapter {
  const factory = adapterRegistry.get(backend);
  return factory ? factory() : new GenericAdapter();
}
