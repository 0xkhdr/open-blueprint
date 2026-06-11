import { describe, expect, it } from "vitest";
import {
  allKnownToolNames,
  BACKEND_TOOL_ALIASES,
  CANONICAL_TOOLS,
  canonicalToBackend,
  isCanonicalTool,
  isMcpToolRef,
  toCanonical,
} from "../../../src/translator/tools.js";

describe("canonical tool vocabulary", () => {
  it("recognizes every canonical tool", () => {
    for (const tool of CANONICAL_TOOLS) {
      expect(isCanonicalTool(tool)).toBe(true);
    }
    expect(isCanonicalTool("teleport")).toBe(false);
  });

  it("recognizes mcp tool refs", () => {
    expect(isMcpToolRef("mcp:github")).toBe(true);
    expect(isMcpToolRef("mcp:")).toBe(false);
    expect(isMcpToolRef("read_file")).toBe(false);
  });
});

describe("canonicalToBackend", () => {
  it("resolves canonical names to backend aliases", () => {
    expect(canonicalToBackend("read_file", "claude")).toBe("read");
    expect(canonicalToBackend("run_command", "claude")).toBe("bash");
    expect(canonicalToBackend("search", "cursor")).toBe("codebase_search");
    expect(canonicalToBackend("read_file", "opendev")).toBe("file_read");
  });

  it("passes mcp refs through unchanged", () => {
    expect(canonicalToBackend("mcp:github", "claude")).toBe("mcp:github");
  });

  it("falls back to the canonical name for unknown backends or missing aliases", () => {
    expect(canonicalToBackend("read_file", "no-such-backend")).toBe("read_file");
    // cursor has no web_fetch alias
    expect(canonicalToBackend("web_fetch", "cursor")).toBe("web_fetch");
  });
});

describe("toCanonical", () => {
  it("accepts canonical names as-is", () => {
    expect(toCanonical("read_file", "claude")).toBe("read_file");
  });

  it("resolves backend aliases back to canonical (both directions with canonicalToBackend)", () => {
    for (const [backend, aliases] of Object.entries(BACKEND_TOOL_ALIASES)) {
      for (const canonical of Object.keys(aliases)) {
        const native = canonicalToBackend(canonical, backend);
        const roundTripped = toCanonical(native, backend);
        // Some natives are shared (bash covers run_command + run_tests);
        // the round trip must land on a canonical that maps to the same native.
        expect(roundTripped).toBeDefined();
        expect(canonicalToBackend(roundTripped as string, backend)).toBe(native);
      }
    }
  });

  it("is case-insensitive for native tool names", () => {
    expect(toCanonical("Read", "claude")).toBe("read_file");
    expect(toCanonical("Bash", "claude")).toBe("run_command");
  });

  it("resolves aliases from other backends when the given backend has none", () => {
    expect(toCanonical("file_read", "claude")).toBe("read_file");
  });

  it("passes mcp refs through and rejects unknown tools", () => {
    expect(toCanonical("mcp:jira", "claude")).toBe("mcp:jira");
    expect(toCanonical("teleport", "claude")).toBeUndefined();
  });
});

describe("allKnownToolNames", () => {
  it("contains the canonical vocabulary and all native aliases", () => {
    const names = allKnownToolNames();
    for (const tool of CANONICAL_TOOLS) expect(names.has(tool)).toBe(true);
    expect(names.has("bash")).toBe(true);
    expect(names.has("codebase_search")).toBe(true);
    expect(names.has("file_read")).toBe(true);
  });
});
