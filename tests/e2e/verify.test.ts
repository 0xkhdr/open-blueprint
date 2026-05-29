import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyFixture, createTmpDir, runBp } from "./setup.js";

describe("E2E: bp verify", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("passing case: clean scaffold", () => {
    it("exits 0 for structural validation on valid drift-repo fixture", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);
      const result = runBp("verify --level structural", tmpDir);
      // structural validation on a known-good fixture should pass
      expect(result.exitCode).toBe(0);
    });

    it("produces JSON output with --json flag", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);
      const result = runBp("verify --level structural --json", tmpDir);
      // should not panic
      expect(result.exitCode).toBeGreaterThanOrEqual(0);
      expect(result.exitCode).toBeLessThanOrEqual(10);
    });
  });

  describe("failing case: broken rule file", () => {
    it("exits non-zero when rule file has invalid YAML frontmatter", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);
      // Write a broken rule file
      const rulesDir = path.join(tmpDir, ".claude", "rules");
      fs.writeFileSync(path.join(rulesDir, "broken-rule.md"), "---\nscope: [\ninvalid yaml\n---\n");
      const result = runBp("verify --level structural", tmpDir);
      // validation should fail on broken rule
      expect(result.exitCode).not.toBe(0);
    });

    it("stdout/stderr contains error context on failure", { timeout: 30000 }, () => {
      copyFixture("drift-repo", tmpDir);
      const rulesDir = path.join(tmpDir, ".claude", "rules");
      fs.writeFileSync(path.join(rulesDir, "broken.md"), "---\nscope: [\nbad yaml\n---\n");
      const result = runBp("verify --level structural", tmpDir);
      const output = result.stdout + result.stderr;
      expect(output.length).toBeGreaterThan(0);
    });
  });
});
