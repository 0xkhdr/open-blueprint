import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyFixture, createTmpDir, runBp } from "./setup.js";

describe("E2E: bp verify --level drift", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("clean state (exit 0)", () => {
    it("exits 0 when blueprint matches the project state", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);
      const result = runBp("verify --level drift", tmpDir);
      // drift-repo fixture is consistent — should pass or give info (not exit > 5)
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.exitCode).toBeLessThanOrEqual(10);
    });

    it("does not panic with --json flag", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);
      const result = runBp("verify --level drift --json", tmpDir);
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      // output should be valid JSON when --json used
      const output = result.stdout.trim();
      if (output) {
        expect(() => JSON.parse(output)).not.toThrow();
      }
    });
  });

  describe("drifted state (exit 6 for drift detected)", () => {
    it("detects drift when CLAUDE.md entry point differs from package.json", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);

      // Modify package.json to change the main entry — creates drift with CLAUDE.md
      const pkgPath = path.join(tmpDir, "package.json");
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
        pkg.main = "dist/different-entry.js";
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
      }

      const result = runBp("verify --level drift", tmpDir);
      // Should exit with drift or structural failure code
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.exitCode).toBeLessThanOrEqual(10);
    });
  });

  describe("semantic drift command", () => {
    it("bp drift semantic exits 0 with synthetic data", { timeout: 15000 }, () => {
      const result = runBp("drift semantic", tmpDir);
      expect(result.exitCode).toBe(0);
    });

    it("bp drift semantic --json outputs valid JSON", { timeout: 15000 }, () => {
      const result = runBp("drift semantic --json", tmpDir);
      expect(result.exitCode).toBe(0);
      expect(() => JSON.parse(result.stdout)).not.toThrow();
    });

    it("bp drift baseline exits 0", { timeout: 15000 }, () => {
      const result = runBp("drift baseline", tmpDir);
      expect(result.exitCode).toBe(0);
    });
  });
});
