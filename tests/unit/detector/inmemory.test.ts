import { describe, expect, it } from "vitest";
import { detect } from "../../../src/detector/index.js";
import { InMemoryFileSystem } from "../../../src/utils/fs.js";

const BASE_PACKAGE = JSON.stringify({ name: "test-project", version: "1.0.0" });
const TS_PACKAGE = JSON.stringify({
  name: "ts-project",
  version: "1.0.0",
  devDependencies: { typescript: "^5.0.0" },
});
const MONO_PACKAGE = JSON.stringify({ name: "monorepo", version: "1.0.0" });

describe("detect() with InMemoryFileSystem", () => {
  it("throws DetectorError when project root is missing", async () => {
    const fs = new InMemoryFileSystem({});
    await expect(detect("/nonexistent", fs)).rejects.toThrow("Project root does not exist");
  });

  it("detects project name from package.json", async () => {
    const fs = new InMemoryFileSystem({
      "/project/package.json": BASE_PACKAGE,
    });
    const fp = await detect("/project", fs);
    expect(fp.project.name).toBe("test-project");
  });

  it("falls back to directory name when no package.json", async () => {
    const fs = new InMemoryFileSystem({
      "/project/some-file.ts": "// code",
    });
    const fp = await detect("/project", fs);
    expect(fp.project.name).toBe("project");
  });

  it("detects monorepo project type when packages dir exists", async () => {
    const fs = new InMemoryFileSystem({
      "/monorepo/package.json": MONO_PACKAGE,
      "/monorepo/packages/app/package.json": "{}",
    });
    const fp = await detect("/monorepo", fs);
    expect(fp.project.type).toBe("monorepo");
  });

  it("returns fingerprint with correct version", async () => {
    const fs = new InMemoryFileSystem({
      "/project/package.json": BASE_PACKAGE,
    });
    const fp = await detect("/project", fs);
    expect(fp.version).toBe("1.0");
    expect(fp.detected_at).toBeTruthy();
  });

  it("returns empty directory topology when no known dirs exist", async () => {
    const fs = new InMemoryFileSystem({
      "/project/package.json": BASE_PACKAGE,
    });
    const fp = await detect("/project", fs);
    expect(fp.directory_topology.src_dirs).toEqual([]);
    expect(fp.directory_topology.test_dirs).toEqual([]);
  });

  it("detects src directory in topology", async () => {
    const fs = new InMemoryFileSystem({
      "/project/package.json": BASE_PACKAGE,
      "/project/src/index.ts": "// code",
    });
    const fp = await detect("/project", fs);
    expect(fp.directory_topology.src_dirs).toContain("src");
  });

  it("detects github-flow workflow from .github/workflows", async () => {
    const fs = new InMemoryFileSystem({
      "/project/package.json": BASE_PACKAGE,
      "/project/.github/workflows/ci.yml": "name: CI",
    });
    const fp = await detect("/project", fs);
    expect(fp.project.git_workflow).toBe("github-flow");
  });
});
