import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detect, DetectorError } from "../../../src/detector/index.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-det-idx-test-"));
}

function touchFile(dir: string, name: string, content = ""): void {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe("detector index", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("throws DetectorError if project root does not exist", async () => {
    const nonExistent = path.join(tmpDir, "nonexistent-dir");
    await expect(detect(nonExistent)).rejects.toThrow(DetectorError);
  });

  it("detects basic project name and structure successfully", async () => {
    touchFile(tmpDir, "package.json", JSON.stringify({ name: "my-custom-test-proj" }));
    touchFile(tmpDir, "src/index.ts", "// index");
    touchFile(tmpDir, "package-lock.json", "{}");

    const fingerprint = await detect(tmpDir);
    expect(fingerprint.project.name).toBe("my-custom-test-proj");
    expect(fingerprint.project.type).toBe("application");
  });

  it("identifies monorepos correctly via workspace structures", async () => {
    touchFile(tmpDir, "package.json", JSON.stringify({ name: "monorepo-parent" }));
    touchFile(tmpDir, "pnpm-workspace.yaml", "packages:\n  - 'packages/*'");
    touchFile(tmpDir, "packages/a/package.json", "{}");

    const fingerprint = await detect(tmpDir);
    expect(fingerprint.project.type).toBe("monorepo");
  });

  it("detects Git workflow types (github-flow vs gitflow)", async () => {
    touchFile(tmpDir, "package.json", "{}");
    // github-flow: presence of .github/workflows
    touchFile(tmpDir, ".github/workflows/ci.yml", "test");

    const fingerprint = await detect(tmpDir);
    expect(fingerprint.project.git_workflow).toBe("github-flow");
  });
});
