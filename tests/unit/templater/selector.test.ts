import { describe, it, expect } from "vitest";
import * as path from "node:path";
import * as fs from "node:fs";
import { resolveTemplatePack, getTemplatesRoot } from "../../../src/templater/selector.js";
import type { Fingerprint } from "../../../src/detector/fingerprint.js";

const MOCK_FINGERPRINT: Fingerprint = {
  version: "1.0",
  detected_at: "2026-01-01T00:00:00.000Z",
  project: { name: "test", root: "/tmp/test", type: "application", git_workflow: "unknown" },
  languages: [{ name: "typescript", confidence: 0.9, primary: true }],
  frameworks: [],
  entry_points: [],
  tooling: { package_manager: "npm", test_runner: "jest", test_command: "jest" },
  directory_topology: { src_dirs: [], test_dirs: [], config_dirs: [], package_dirs: [] },
  security_signals: { has_auth: false, has_external_apis: false, has_secrets_manager: false, has_docker: false },
};

describe("templater selector", () => {
  it("can get templates root folder", () => {
    const root = getTemplatesRoot();
    expect(root).toBeDefined();
    expect(typeof root).toBe("string");
  });

  it("resolves the template pack for a backend", () => {
    const pack = resolveTemplatePack(MOCK_FINGERPRINT, "claude");
    expect(pack).toBeDefined();
    expect(pack.manifest.backend).toBe("claude");
    expect(fs.existsSync(pack.directory)).toBe(true);
  });

  it("handles template overrides correctly", () => {
    const pack = resolveTemplatePack(MOCK_FINGERPRINT, "claude");
    // Pass same folder path as override
    const overridden = resolveTemplatePack(MOCK_FINGERPRINT, "claude", pack.directory);
    expect(overridden.directory).toBe(pack.directory);
  });

  it("throws error when backend manifest is completely missing", () => {
    expect(() => resolveTemplatePack(MOCK_FINGERPRINT, "nonexistent-backend")).toThrow();
  });

  it("resolves template pack for php/laravel with fallback", () => {
    const fingerprint: Fingerprint = {
      ...MOCK_FINGERPRINT,
      languages: [{ name: "php", confidence: 0.9, primary: true }],
      frameworks: [{ name: "laravel", confidence: 0.9 }],
    };
    const pack = resolveTemplatePack(fingerprint, "claude");
    expect(pack).toBeDefined();
    expect(pack.manifest.backend).toBe("claude");
  });
});
