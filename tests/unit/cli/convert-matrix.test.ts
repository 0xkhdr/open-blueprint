import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { parseBlueprint, renderBlueprint } from "../../../src/translator/index.js";

function mkTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-convert-test-"));
}

describe("convert matrix", () => {
  let srcDir: string;
  let outDir: string;

  beforeEach(() => {
    srcDir = mkTmpDir();
    outDir = mkTmpDir();
  });

  afterEach(() => {
    fs.rmSync(srcDir, { recursive: true, force: true });
    fs.rmSync(outDir, { recursive: true, force: true });
  });

  it("claude → windsurf conversion produces files", async () => {
    const ir = await parseBlueprint(srcDir, "claude");
    const files = await renderBlueprint(ir, outDir, "windsurf");
    expect(Array.isArray(files)).toBe(true);
  });

  it("claude → kimi (skill-only) conversion produces files without commands", async () => {
    const ir = await parseBlueprint(srcDir, "claude");
    const files = await renderBlueprint(ir, outDir, "kimi");
    expect(Array.isArray(files)).toBe(true);
    for (const f of files) {
      expect(f).not.toContain("commands");
    }
  });

  it("claude → gemini (TOML) conversion", async () => {
    const ir = await parseBlueprint(srcDir, "claude");
    const files = await renderBlueprint(ir, outDir, "gemini");
    expect(Array.isArray(files)).toBe(true);
  });

  it("forgecode → claude (skill-only source) conversion", async () => {
    const ir = await parseBlueprint(srcDir, "forgecode");
    const files = await renderBlueprint(ir, outDir, "claude");
    expect(Array.isArray(files)).toBe(true);
  });

  it("roocode → windsurf conversion works", async () => {
    const ir = await parseBlueprint(srcDir, "roocode");
    const files = await renderBlueprint(ir, outDir, "windsurf");
    expect(Array.isArray(files)).toBe(true);
  });
});
