import { describe, expect, it } from "vitest";
import { getBackend, listBackendIds } from "../../../src/backends/registry.js";

describe("init multi-backend", () => {
  it("listBackendIds includes all expected new backends", () => {
    const ids = listBackendIds();
    const expected = [
      "claude", "cursor", "windsurf", "cline", "kilocode", "roocode",
      "kimi", "trae", "forgecode", "amazon-q", "qwen", "gemini",
    ];
    for (const id of expected) {
      expect(ids).toContain(id);
    }
  });

  it("all backend IDs resolve in registry", () => {
    for (const id of listBackendIds()) {
      expect(() => getBackend(id)).not.toThrow();
    }
  });
});
