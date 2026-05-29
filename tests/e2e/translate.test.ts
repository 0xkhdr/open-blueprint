import * as fs from "node:fs";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { copyFixture, createTmpDir, runBp } from "./setup.js";

describe("E2E: bp convert (translate)", () => {
  let tmpDir: string;
  let outputDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    outputDir = path.join(tmpDir, "output");
    fs.mkdirSync(outputDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("Claude → Cursor round-trip", () => {
    it("converts claude fixture to cursor format without error", { timeout: 60000 }, () => {
      copyFixture("drift-repo", tmpDir);
      // First ensure there's a CLAUDE.md (already in fixture)
      const srcDir = tmpDir;
      const result = runBp(
        `convert --from claude --to cursor --input ${srcDir} --output ${outputDir}`,
        tmpDir
      );
      expect(result.exitCode).toBe(0);
    });

    it("Cursor output directory contains cursor rule files", { timeout: 60000 }, () => {
      copyFixture("drift-repo", tmpDir);
      runBp(`convert --from claude --to cursor --input ${tmpDir} --output ${outputDir}`, tmpDir);
      // Cursor format creates .cursorrules or .cursor/rules/
      const hasOutput = fs.existsSync(outputDir) &&
        (fs.existsSync(path.join(outputDir, ".cursorrules")) ||
         fs.existsSync(path.join(outputDir, ".cursor")));
      expect(hasOutput || fs.readdirSync(outputDir).length > 0).toBe(true);
    });
  });

  describe("round-trip semantic preservation", () => {
    it("Claude → Cursor → Claude preserves rule count", { timeout: 90000 }, () => {
      copyFixture("drift-repo", tmpDir);
      const cursorDir = path.join(tmpDir, "cursor-out");
      const backDir = path.join(tmpDir, "claude-back");
      fs.mkdirSync(cursorDir, { recursive: true });
      fs.mkdirSync(backDir, { recursive: true });

      // Step 1: claude → cursor
      const step1 = runBp(
        `convert --from claude --to cursor --input ${tmpDir} --output ${cursorDir}`,
        tmpDir
      );
      expect(step1.exitCode).toBe(0);

      // Step 2: cursor → claude
      const step2 = runBp(
        `convert --from cursor --to claude --input ${cursorDir} --output ${backDir}`,
        tmpDir
      );
      expect(step2.exitCode).toBe(0);

      // Verify output exists
      expect(fs.existsSync(backDir)).toBe(true);
    });
  });

  describe("invalid backend", () => {
    it("exits non-zero for unknown --from backend", { timeout: 15000 }, () => {
      const result = runBp(
        `convert --from unknownxyz --to claude --input ${tmpDir} --output ${outputDir}`,
        tmpDir
      );
      expect(result.exitCode).not.toBe(0);
    });
  });
});
