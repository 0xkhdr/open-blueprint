import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detectTooling } from "../../../src/detector/tooling.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-tooling-test-"));
}

function touchFile(dir: string, name: string, content = ""): void {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe("detectTooling", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("package_manager", () => {
    it("detects bun from bun.lockb", () => {
      touchFile(tmpDir, "bun.lockb");
      expect(detectTooling(tmpDir).package_manager).toBe("bun");
    });

    it("detects pnpm from pnpm-lock.yaml", () => {
      touchFile(tmpDir, "pnpm-lock.yaml");
      expect(detectTooling(tmpDir).package_manager).toBe("pnpm");
    });

    it("detects yarn from yarn.lock", () => {
      touchFile(tmpDir, "yarn.lock");
      expect(detectTooling(tmpDir).package_manager).toBe("yarn");
    });

    it("detects npm from package-lock.json", () => {
      touchFile(tmpDir, "package-lock.json");
      expect(detectTooling(tmpDir).package_manager).toBe("npm");
    });

    it("detects poetry from poetry.lock", () => {
      touchFile(tmpDir, "poetry.lock");
      expect(detectTooling(tmpDir).package_manager).toBe("poetry");
    });

    it("detects go modules from go.mod", () => {
      touchFile(tmpDir, "go.mod");
      expect(detectTooling(tmpDir).package_manager).toBe("go modules");
    });

    it("detects cargo from Cargo.lock", () => {
      touchFile(tmpDir, "Cargo.lock");
      expect(detectTooling(tmpDir).package_manager).toBe("cargo");
    });
  });

  describe("test_runner", () => {
    it("detects vitest from vitest.config.ts", () => {
      touchFile(tmpDir, "vitest.config.ts");
      expect(detectTooling(tmpDir).test_runner).toBe("vitest");
    });

    it("detects jest from jest.config.js", () => {
      touchFile(tmpDir, "jest.config.js");
      expect(detectTooling(tmpDir).test_runner).toBe("jest");
    });

    it("detects pytest from pytest.ini", () => {
      touchFile(tmpDir, "pytest.ini");
      expect(detectTooling(tmpDir).test_runner).toBe("pytest");
    });

    it("detects go test from go.mod", () => {
      touchFile(tmpDir, "go.mod");
      expect(detectTooling(tmpDir).test_runner).toBe("go test");
    });

    it("detects cargo test from Cargo.toml", () => {
      touchFile(tmpDir, "Cargo.toml");
      expect(detectTooling(tmpDir).test_runner).toBe("cargo test");
    });
  });

  describe("build_tool", () => {
    it("detects vite", () => {
      touchFile(tmpDir, "vite.config.ts");
      expect(detectTooling(tmpDir).build_tool).toBe("vite");
    });

    it("detects webpack", () => {
      touchFile(tmpDir, "webpack.config.js");
      expect(detectTooling(tmpDir).build_tool).toBe("webpack");
    });

    it("detects turborepo from turbo.json", () => {
      touchFile(tmpDir, "turbo.json");
      expect(detectTooling(tmpDir).build_tool).toBe("turborepo");
    });

    it("detects nx from nx.json", () => {
      touchFile(tmpDir, "nx.json");
      expect(detectTooling(tmpDir).build_tool).toBe("nx");
    });
  });

  describe("linter", () => {
    it("detects biome", () => {
      touchFile(tmpDir, "biome.json");
      expect(detectTooling(tmpDir).linter).toBe("biome");
    });

    it("detects eslint from .eslintrc.json", () => {
      touchFile(tmpDir, ".eslintrc.json");
      expect(detectTooling(tmpDir).linter).toBe("eslint");
    });

    it("detects ruff from pyproject.toml", () => {
      touchFile(tmpDir, "pyproject.toml", "[tool.ruff]\nline-length = 88");
      expect(detectTooling(tmpDir).linter).toBe("ruff");
    });
  });

  describe("ci_system", () => {
    it("detects github actions", () => {
      touchFile(tmpDir, ".github/workflows/ci.yml", "name: CI");
      expect(detectTooling(tmpDir).ci_system).toBe("github-actions");
    });

    it("detects gitlab-ci", () => {
      touchFile(tmpDir, ".gitlab-ci.yml");
      expect(detectTooling(tmpDir).ci_system).toBe("gitlab-ci");
    });
  });

  it("returns empty object for bare directory", () => {
    const tooling = detectTooling(tmpDir);
    expect(tooling).toEqual({});
  });
});
