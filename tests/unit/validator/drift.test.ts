import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Fingerprint } from "../../../src/detector/fingerprint.js";
import {
  FINGERPRINT_FILE,
  computeFingerprintDelta,
  loadStoredFingerprint,
  storeFingerprint,
  validateDrift,
} from "../../../src/validator/drift.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-drift-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

const BASE_FINGERPRINT: Fingerprint = {
  version: "1.0",
  detected_at: "2026-01-01T00:00:00.000Z",
  project: { name: "test", root: "/tmp/test", type: "application", git_workflow: "unknown" },
  languages: [{ name: "typescript", confidence: 0.9, primary: true }],
  frameworks: [],
  entry_points: [],
  tooling: { package_manager: "npm", test_runner: "jest", test_command: "jest" },
  directory_topology: { src_dirs: [], test_dirs: [], config_dirs: [], package_dirs: [] },
  security_signals: { has_auth: false, has_external_apis: false, has_secrets_manager: false, has_docker: false },
  workspacePackages: [],
};

describe("drift utilities", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => cleanDir(tmpDir));

  describe("storeFingerprint / loadStoredFingerprint", () => {
    it("round-trips fingerprint to disk", async () => {
      await storeFingerprint(tmpDir, BASE_FINGERPRINT);
      const loaded = await loadStoredFingerprint(tmpDir);
      expect(loaded).not.toBeNull();
      expect(loaded?.project.name).toBe("test");
      expect(loaded?.tooling.test_command).toBe("jest");
    });

    it("returns null when no fingerprint file exists", async () => {
      const result = await loadStoredFingerprint(tmpDir);
      expect(result).toBeNull();
    });

    it("stores fingerprint at .bp-fingerprint.json", async () => {
      await storeFingerprint(tmpDir, BASE_FINGERPRINT);
      expect(fs.existsSync(path.join(tmpDir, FINGERPRINT_FILE))).toBe(true);
    });
  });

  describe("computeFingerprintDelta", () => {
    it("detects test command change (jest → vitest)", () => {
      const current: Fingerprint = {
        ...BASE_FINGERPRINT,
        tooling: { ...BASE_FINGERPRINT.tooling, test_command: "vitest run", test_runner: "vitest" },
      };
      const deltas = computeFingerprintDelta(BASE_FINGERPRINT, current);
      expect(deltas.some((d) => d.field === "tooling.test_command")).toBe(true);
      const delta = deltas.find((d) => d.field === "tooling.test_command");
      expect(delta?.old).toBe("jest");
      expect(delta?.current).toBe("vitest run");
    });

    it("detects primary language change", () => {
      const current: Fingerprint = {
        ...BASE_FINGERPRINT,
        languages: [{ name: "python", confidence: 0.9, primary: true }],
      };
      const deltas = computeFingerprintDelta(BASE_FINGERPRINT, current);
      expect(deltas.some((d) => d.field === "primary_language")).toBe(true);
    });

    it("detects new major framework", () => {
      const current: Fingerprint = {
        ...BASE_FINGERPRINT,
        frameworks: [{ name: "nextjs", confidence: 0.95 }],
      };
      const deltas = computeFingerprintDelta(BASE_FINGERPRINT, current);
      expect(deltas.some((d) => d.field === "frameworks.new" && d.current === "nextjs")).toBe(true);
    });

    it("returns empty array when no changes", () => {
      const deltas = computeFingerprintDelta(BASE_FINGERPRINT, BASE_FINGERPRINT);
      expect(deltas).toHaveLength(0);
    });
  });
});
