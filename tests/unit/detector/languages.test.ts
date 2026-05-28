import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detectLanguages } from "../../../src/detector/languages.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-test-"));
}

function touchFile(dir: string, name: string, content = ""): void {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe("detectLanguages", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects TypeScript from tsconfig.json", () => {
    touchFile(tmpDir, "tsconfig.json", "{}");
    const langs = detectLanguages(tmpDir);
    const ts = langs.find((l) => l.name === "typescript");
    expect(ts).toBeDefined();
    expect(ts?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(ts?.primary).toBe(true);
  });

  it("detects Python from requirements.txt", () => {
    touchFile(tmpDir, "requirements.txt", "fastapi\npydantic");
    const langs = detectLanguages(tmpDir);
    const py = langs.find((l) => l.name === "python");
    expect(py).toBeDefined();
    expect(py?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects Go from go.mod", () => {
    touchFile(tmpDir, "go.mod", "module example.com/app\n\ngo 1.21");
    const langs = detectLanguages(tmpDir);
    const go = langs.find((l) => l.name === "go");
    expect(go).toBeDefined();
    expect(go?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(go?.primary).toBe(true);
  });

  it("detects Rust from Cargo.toml", () => {
    touchFile(tmpDir, "Cargo.toml", '[package]\nname = "myapp"\nversion = "0.1.0"');
    const langs = detectLanguages(tmpDir);
    const rust = langs.find((l) => l.name === "rust");
    expect(rust).toBeDefined();
    expect(rust?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects Java from pom.xml", () => {
    touchFile(tmpDir, "pom.xml", "<project></project>");
    const langs = detectLanguages(tmpDir);
    const java = langs.find((l) => l.name === "java");
    expect(java).toBeDefined();
    expect(java?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects Ruby from Gemfile", () => {
    touchFile(tmpDir, "Gemfile", "source 'https://rubygems.org'");
    const langs = detectLanguages(tmpDir);
    const ruby = langs.find((l) => l.name === "ruby");
    expect(ruby).toBeDefined();
    expect(ruby?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects Python from pyproject.toml", () => {
    touchFile(tmpDir, "pyproject.toml", "[tool.poetry]\nname = 'app'");
    const langs = detectLanguages(tmpDir);
    const py = langs.find((l) => l.name === "python");
    expect(py).toBeDefined();
    expect(py?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("returns empty array for empty dir", () => {
    const langs = detectLanguages(tmpDir);
    expect(langs).toEqual([]);
  });

  it("marks highest confidence as primary", () => {
    touchFile(tmpDir, "tsconfig.json", "{}");
    touchFile(tmpDir, "requirements.txt", "flask");
    const langs = detectLanguages(tmpDir);
    const primaryLangs = langs.filter((l) => l.primary);
    expect(primaryLangs).toHaveLength(1);
  });

  it("returns sorted by confidence descending", () => {
    touchFile(tmpDir, "tsconfig.json", "{}");
    touchFile(tmpDir, "Gemfile", "source 'https://rubygems.org'");
    const langs = detectLanguages(tmpDir);
    for (let i = 0; i < langs.length - 1; i++) {
      const a = langs[i];
      const b = langs[i + 1];
      if (a !== undefined && b !== undefined) {
        expect(a.confidence).toBeGreaterThanOrEqual(b.confidence);
      }
    }
  });

  it("does not double-count JavaScript when TypeScript is primary", () => {
    touchFile(tmpDir, "tsconfig.json", "{}");
    touchFile(tmpDir, "package.json", '{"name":"app"}');
    const langs = detectLanguages(tmpDir);
    const js = langs.find((l) => l.name === "javascript");
    // JS should have reduced confidence or be absent
    if (js !== undefined) {
      expect(js.confidence).toBeLessThan(0.9);
    }
  });

  it("detects C# from root .csproj file", () => {
    touchFile(tmpDir, "MyAwesomeProject.csproj", "<Project></Project>");
    const langs = detectLanguages(tmpDir);
    const cs = langs.find((l) => l.name === "csharp");
    expect(cs).toBeDefined();
    expect(cs?.confidence).toBeGreaterThanOrEqual(0.9);
    expect(cs?.primary).toBe(true);
  });

  it("detects C# from root .sln file", () => {
    touchFile(tmpDir, "Solution.sln", "Microsoft Visual Studio Solution File");
    const langs = detectLanguages(tmpDir);
    const cs = langs.find((l) => l.name === "csharp");
    expect(cs).toBeDefined();
    expect(cs?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("handles TS JS splicing and directory read failures safely", () => {
    // 1. Trigger the catch block in countFilesWithExtensions by making 'src' a file instead of a directory
    touchFile(tmpDir, "tsconfig.json", "{}");
    touchFile(tmpDir, "src", "not a directory"); // countFilesWithExtensions will throw on fs.readdirSync
    
    const langs = detectLanguages(tmpDir);
    // TS should be detected, JS should be completely absent
    expect(langs.find((l) => l.name === "typescript")).toBeDefined();
    expect(langs.find((l) => l.name === "javascript")).toBeUndefined();
  });
});
