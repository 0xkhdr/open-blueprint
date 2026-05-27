import { describe, it, expect } from "vitest";
import * as path from "node:path";
import { writeFile } from "../../../src/templater/writer.js";

describe("Path Traversal Protection", () => {
  it("throws error when trying to write outside the project root", async () => {
    const projectRoot = "/tmp/bp-safe-project";
    const outsidePath = "/tmp/outside-file.txt";

    await expect(
      writeFile(outsidePath, "malicious data", {
        projectRoot,
        dryRun: true,
      })
    ).rejects.toThrow("Path traversal detected");
  });

  it("allows writing inside the project root", async () => {
    const projectRoot = "/tmp/bp-safe-project";
    const insidePath = "/tmp/bp-safe-project/subfolder/file.txt";

    // Should not throw path traversal error (will run up to writing/dry-run checks)
    const result = await writeFile(insidePath, "safe data", {
      projectRoot,
      dryRun: true,
    });
    expect(result.action).toBe("dry-run");
  });
});
