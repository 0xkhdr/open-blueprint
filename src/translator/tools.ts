/**
 * Canonical tool vocabulary (Stage 3, GAP-3).
 *
 * Skills declare `tools_required` in this backend-neutral vocabulary; each
 * backend manifest lists which canonical tools it supports (`tools` in
 * `templates/<backend>/manifest.json`), and the alias maps below translate
 * canonical names to the backend's native tool names. Both the skill
 * validator (`src/validator/skills.ts`) and `bp skill test` resolve through
 * this module so validation and translation can never disagree.
 *
 * `mcp:<server-or-tool>` references are part of the vocabulary: they pass
 * through untranslated because MCP tool names are backend-independent.
 */

export const CANONICAL_TOOLS = [
  "read_file",
  "write_file",
  "edit_file",
  "run_command",
  "run_tests",
  "search",
  "web_fetch",
] as const;

export type CanonicalTool = (typeof CANONICAL_TOOLS)[number];

export const MCP_TOOL_PREFIX = "mcp:";

export function isMcpToolRef(name: string): boolean {
  return name.startsWith(MCP_TOOL_PREFIX) && name.length > MCP_TOOL_PREFIX.length;
}

export function isCanonicalTool(name: string): name is CanonicalTool {
  return (CANONICAL_TOOLS as readonly string[]).includes(name);
}

/**
 * Native tool name per backend for each canonical tool. A missing entry means
 * the backend has no native equivalent — translation falls back to the
 * canonical name and `bp skill test` reports it as a fidelity gap.
 */
export const BACKEND_TOOL_ALIASES: Record<string, Partial<Record<CanonicalTool, string>>> = {
  claude: {
    read_file: "read",
    write_file: "write",
    edit_file: "edit",
    run_command: "bash",
    run_tests: "bash",
    search: "grep",
    web_fetch: "web_fetch",
  },
  cursor: {
    read_file: "read_file",
    write_file: "edit_file",
    edit_file: "edit_file",
    run_command: "run_terminal_cmd",
    run_tests: "run_terminal_cmd",
    search: "codebase_search",
  },
  opendev: {
    read_file: "file_read",
    write_file: "file_write",
    edit_file: "file_write",
    run_command: "terminal",
    run_tests: "terminal",
    search: "search",
  },
  generic: {
    read_file: "read_file",
    write_file: "write_file",
    edit_file: "edit_file",
    run_command: "run_command",
    run_tests: "run_tests",
    search: "search",
    web_fetch: "web_fetch",
  },
};

/**
 * Resolve a canonical tool to the backend's native name. MCP refs pass
 * through. Unknown backends (or canonical tools the backend has no alias
 * for) fall back to the canonical name.
 */
export function canonicalToBackend(tool: string, backend: string): string {
  if (isMcpToolRef(tool)) return tool;
  if (!isCanonicalTool(tool)) return tool;
  return BACKEND_TOOL_ALIASES[backend]?.[tool] ?? tool;
}

/**
 * Map a tool name back to the canonical vocabulary. Accepts canonical names,
 * MCP refs, and backend-native aliases (the given backend first, then any
 * backend, so files moved between backends still resolve). Returns undefined
 * for names outside the vocabulary.
 */
export function toCanonical(tool: string, backend?: string): string | undefined {
  if (isMcpToolRef(tool)) return tool;
  // Case-insensitive: native tool names appear TitleCased in the wild
  // (e.g. Claude's "Read", "Bash").
  const needle = tool.toLowerCase();
  if (isCanonicalTool(needle)) return needle;

  const searchOrder = backend
    ? [backend, ...Object.keys(BACKEND_TOOL_ALIASES).filter((b) => b !== backend)]
    : Object.keys(BACKEND_TOOL_ALIASES);

  for (const b of searchOrder) {
    const aliases = BACKEND_TOOL_ALIASES[b];
    if (!aliases) continue;
    for (const canonical of CANONICAL_TOOLS) {
      if (aliases[canonical]?.toLowerCase() === needle) return canonical;
    }
  }
  return undefined;
}

/** Every name the vocabulary accepts: canonical tools plus all native aliases. */
export function allKnownToolNames(): Set<string> {
  const names = new Set<string>(CANONICAL_TOOLS);
  for (const aliases of Object.values(BACKEND_TOOL_ALIASES)) {
    for (const alias of Object.values(aliases)) names.add(alias);
  }
  return names;
}
