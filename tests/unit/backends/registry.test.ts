import { describe, expect, it } from "vitest";
import {
  BACKENDS,
  getBackend,
  getSkillOnlyBackends,
  listBackendIds,
} from "../../../src/backends/registry.js";

describe("backend registry", () => {
  it("all backend IDs resolve via getBackend()", () => {
    for (const backend of BACKENDS) {
      expect(() => getBackend(backend.id)).not.toThrow();
      expect(getBackend(backend.id).id).toBe(backend.id);
    }
  });

  it("unknown ID throws with message containing the ID", () => {
    expect(() => getBackend("unknown-tool")).toThrow(/unknown-tool/i);
  });

  it("listBackendIds() returns all registered IDs", () => {
    const ids = listBackendIds();
    expect(ids.length).toBe(BACKENDS.length);
    for (const b of BACKENDS) {
      expect(ids).toContain(b.id);
    }
  });

  it("getSkillOnlyBackends() returns only backends where supportsCommands === false", () => {
    const skillOnly = getSkillOnlyBackends();
    for (const b of skillOnly) {
      expect(b.supportsCommands).toBe(false);
    }
    const allNonSkillOnly = BACKENDS.filter((b) => b.supportsCommands);
    for (const b of allNonSkillOnly) {
      expect(skillOnly).not.toContainEqual(b);
    }
  });

  it("skill-only backends have null commandsPath", () => {
    for (const b of getSkillOnlyBackends()) {
      expect(b.commandsPath).toBeNull();
    }
  });

  it("known skill-only backends are kimi, trae, forgecode", () => {
    const ids = getSkillOnlyBackends().map((b) => b.id);
    expect(ids).toContain("kimi");
    expect(ids).toContain("trae");
    expect(ids).toContain("forgecode");
  });

  it("TOML backends have .toml fileExtension", () => {
    const tomlBackends = BACKENDS.filter((b) => b.fileExtension === ".toml");
    const ids = tomlBackends.map((b) => b.id);
    expect(ids).toContain("gemini");
    expect(ids).toContain("qwen");
  });

  it("global path backends have globalHomeEnv set", () => {
    const codex = getBackend("codex");
    expect(codex.globalHomeEnv).toBe("CODEX_HOME");
    expect(codex.fallbackGlobalPath).toBeTruthy();
  });
});
