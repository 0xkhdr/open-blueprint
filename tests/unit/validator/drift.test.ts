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
};

describe("drift utilities", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => cleanDir(tmpDir));

  describe("storeFingerprint / loadStoredFingerprint", () => {
    it("round-trips fingerprint to disk", () => {
      storeFingerprint(tmpDir, BASE_FINGERPRINT);
      const loaded = loadStoredFingerprint(tmpDir);
      expect(loaded).not.toBeNull();
      expect(loaded?.project.name).toBe("test");
      expect(loaded?.tooling.test_command).toBe("jest");
    });

    it("returns null when no fingerprint file exists", () => {
      const result = loadStoredFingerprint(tmpDir);
      expect(result).toBeNull();
    });

    it("stores fingerprint at .bp-fingerprint.json", () => {
      storeFingerprint(tmpDir, BASE_FINGERPRINT);
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

describe("validateDrift", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    fs.mkdirSync(path.join(tmpDir, ".claude", "rules"), { recursive: true });
  });

  afterEach(() => cleanDir(tmpDir));

  describe("fingerprint delta detection", () => {
    it("emits FINGERPRINT_DELTA when test_command changed", async () => {
      // Store old fingerprint (jest)
      storeFingerprint(tmpDir, BASE_FINGERPRINT);

      // Current fingerprint says vitest
      const current: Fingerprint = {
        ...BASE_FINGERPRINT,
        tooling: { ...BASE_FINGERPRINT.tooling, test_command: "vitest run" },
      };

      const errors = await validateDrift([], {
        projectRoot: tmpDir,
        currentFingerprint: current,
      });

      expect(errors.some((e) => e.type === "FINGERPRINT_DELTA")).toBe(true);
      const delta = errors.find((e) => e.type === "FINGERPRINT_DELTA");
      expect(delta?.message).toContain("jest");
      expect(delta?.message).toContain("vitest run");
    });

    it("no FINGERPRINT_DELTA when nothing changed", async () => {
      storeFingerprint(tmpDir, BASE_FINGERPRINT);

      const errors = await validateDrift([], {
        projectRoot: tmpDir,
        currentFingerprint: BASE_FINGERPRINT,
      });

      expect(errors.some((e) => e.type === "FINGERPRINT_DELTA")).toBe(false);
    });

    it("no errors when no fingerprint file exists", async () => {
      const errors = await validateDrift([], {
        projectRoot: tmpDir,
        currentFingerprint: BASE_FINGERPRINT,
      });

      // No stored fingerprint → no delta errors (first run)
      expect(errors.filter((e) => e.type === "FINGERPRINT_DELTA")).toHaveLength(0);
    });
  });

  describe("test command drift", () => {
    it("detects TEST_COMMAND_DRIFT when anchor has stale test command", async () => {
      // Write anchor with old test command
      const anchorPath = path.join(tmpDir, "CLAUDE.md");
      fs.writeFileSync(
        anchorPath,
        `<!-- bp-generated:begin position -->\n# Position: test\n- Language: typescript\n- Entry: src/index.ts\n- Test command: \`jest\`\n<!-- bp-generated:end position -->\n`
      );

      const current: Fingerprint = {
        ...BASE_FINGERPRINT,
        tooling: { ...BASE_FINGERPRINT.tooling, test_command: "vitest run" },
      };

      const errors = await validateDrift([anchorPath], {
        projectRoot: tmpDir,
        currentFingerprint: current,
      });

      expect(errors.some((e) => e.type === "TEST_COMMAND_DRIFT")).toBe(true);
      const err = errors.find((e) => e.type === "TEST_COMMAND_DRIFT");
      expect(err?.message).toContain("jest");
      expect(err?.message).toContain("vitest run");
    });
  });

  describe("entry point drift", () => {
    it("detects ENTRY_POINT_DRIFT when declared entry file deleted", async () => {
      const anchorPath = path.join(tmpDir, "CLAUDE.md");
      fs.writeFileSync(
        anchorPath,
        `<!-- bp-generated:begin position -->\n# Position: test\n- Entry: src/main.ts\n<!-- bp-generated:end position -->\n`
      );

      // Do NOT create src/main.ts — simulate file deletion

      const errors = await validateDrift([anchorPath], {
        projectRoot: tmpDir,
        currentFingerprint: BASE_FINGERPRINT,
      });

      expect(errors.some((e) => e.type === "ENTRY_POINT_DRIFT")).toBe(true);
    });

    it("no ENTRY_POINT_DRIFT when declared entry file exists", async () => {
      const anchorPath = path.join(tmpDir, "CLAUDE.md");
      fs.writeFileSync(
        anchorPath,
        `<!-- bp-generated:begin position -->\n# Position: test\n- Entry: src/index.ts\n<!-- bp-generated:end position -->\n`
      );

      // Create the file
      fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "src", "index.ts"), "// code");

      const errors = await validateDrift([anchorPath], {
        projectRoot: tmpDir,
        currentFingerprint: BASE_FINGERPRINT,
      });

      expect(errors.some((e) => e.type === "ENTRY_POINT_DRIFT")).toBe(false);
    });
  });

  describe("all errors include resolution path", () => {
    it("each error has a non-empty resolution field", async () => {
      storeFingerprint(tmpDir, BASE_FINGERPRINT);
      const current: Fingerprint = {
        ...BASE_FINGERPRINT,
        tooling: { ...BASE_FINGERPRINT.tooling, test_command: "bun test" },
      };

      const errors = await validateDrift([], {
        projectRoot: tmpDir,
        currentFingerprint: current,
      });

      for (const err of errors) {
        expect(err.resolution).toBeTruthy();
        expect(err.resolution.length).toBeGreaterThan(10);
      }
    });
  });
});
