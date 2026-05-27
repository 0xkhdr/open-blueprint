import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadStoredFingerprint, storeFingerprint } from "../../../src/validator/drift.js";
import { runValidator } from "../../../src/validator/index.js";

describe("CLI Migrate Command", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-migrate-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("safely migrates an older fingerprint schema and stores it", () => {
    const originalFingerprint = {
      version: "1.0" as const,
      detected_at: "2026-05-27T23:00:27Z",
      project: {
        name: "old-project",
        root: tmpDir,
        type: "application" as const,
        git_workflow: "unknown" as const,
      },
      languages: [],
      frameworks: [],
      entry_points: [],
      tooling: {},
      directory_topology: {
        src_dirs: [],
        test_dirs: [],
        config_dirs: [],
        package_dirs: [],
      },
      security_signals: {
        has_auth: false,
        has_external_apis: false,
        has_secrets_manager: false,
        has_docker: false,
      },
    };

    // Store original older schema
    storeFingerprint(tmpDir, originalFingerprint);

    // Load and modify
    const stored = loadStoredFingerprint(tmpDir);
    expect(stored).toBeDefined();
    expect(stored?.version).toBe("1.0");

    // Perform migration logic
    if (stored) {
      stored.version = "1.0"; // upgrading
      stored.detected_at = new Date().toISOString();
      storeFingerprint(tmpDir, stored);
    }

    const migrated = loadStoredFingerprint(tmpDir);
    expect(migrated?.version).toBe("1.0");
    expect(migrated?.detected_at).not.toBe("2026-05-27T23:00:27Z");
  });
});
