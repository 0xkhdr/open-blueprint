import * as os from "node:os";
import * as path from "node:path";
import * as fs from "node:fs";
import { describe, expect, it } from "vitest";
import { listBackendIds } from "../../../src/backends/registry.js";
import { parseBlueprint, renderBlueprint } from "../../../src/translator/index.js";

describe("all backends resolve in translator", () => {
  it("parseBlueprint resolves without Unknown backend for all registered IDs", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-test-"));
    try {
      const ids = listBackendIds();
      for (const id of ids) {
        await expect(parseBlueprint(tmpDir, id)).resolves.toBeDefined();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("renderBlueprint resolves for all registered IDs with empty IR", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-test-"));
    const ids = listBackendIds();
    try {
      for (const id of ids) {
        const ir = await parseBlueprint(tmpDir, id);
        await expect(renderBlueprint(ir, tmpDir, id)).resolves.toBeDefined();
      }
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
