import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createDefaultStrategies, detect } from "../../../src/detector/index.js";

describe("detector strategy composition", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-detector-strategy-"));
    fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "probe" }));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("default strategies produce the same fingerprint as a direct detect call", async () => {
    const viaDefault = await detect(tmpDir);
    const viaExplicit = await detect(tmpDir, undefined, createDefaultStrategies());
    // detected_at differs by clock; everything else must be identical
    const strip = ({ detected_at: _, ...rest }: typeof viaDefault) => rest;
    expect(strip(viaExplicit)).toEqual(strip(viaDefault));
  });

  it("orchestrator consumes injected strategies through the interface (OCP seam)", async () => {
    const strategies = createDefaultStrategies();
    strategies.languages = {
      name: "languages",
      detect: async () => [{ name: "python", confidence: 1, files_count: 42 }],
    };

    const fp = await detect(tmpDir, undefined, strategies);
    expect(fp.languages).toEqual([{ name: "python", confidence: 1, files_count: 42 }]);
  });
});
