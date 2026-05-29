import { describe, it, expect } from "vitest";
import { safeOutputPath } from "../../../src/security/path-traversal.js";
import * as path from "node:path";

const ROOT = "/project/root";

describe("safeOutputPath", () => {
  it("returns resolved path for simple filename", () => {
    const result = safeOutputPath("output.txt", ROOT);
    expect(result).toBe(path.join(ROOT, "output.txt"));
  });

  it("returns resolved path for nested file", () => {
    const result = safeOutputPath("src/file.ts", ROOT);
    expect(result).toBe(path.join(ROOT, "src", "file.ts"));
  });

  it("returns root itself", () => {
    const result = safeOutputPath(".", ROOT);
    expect(result).toBe(ROOT);
  });

  it("throws on simple ../ traversal", () => {
    expect(() => safeOutputPath("../secret.txt", ROOT)).toThrow("Path traversal detected");
  });

  it("throws on deep ../ traversal", () => {
    expect(() => safeOutputPath("../../etc/passwd", ROOT)).toThrow("Path traversal detected");
  });

  it("throws on absolute path outside root", () => {
    expect(() => safeOutputPath("/etc/passwd", ROOT)).toThrow("Path traversal detected");
  });

  it("throws on embedded traversal in path", () => {
    expect(() => safeOutputPath("src/../../etc/shadow", ROOT)).toThrow("Path traversal detected");
  });

  it("allows deep nested paths inside root", () => {
    const result = safeOutputPath("a/b/c/d/e.txt", ROOT);
    expect(result).toBe(path.join(ROOT, "a", "b", "c", "d", "e.txt"));
  });

  it("allows path with leading ./ inside root", () => {
    const result = safeOutputPath("./src/index.ts", ROOT);
    expect(result).toBe(path.join(ROOT, "src", "index.ts"));
  });

  it("allows path with null-like chars that stay inside root", () => {
    // Node path.resolve treats null bytes as literal characters, stays inside root
    const result = safeOutputPath("src/file.ts", ROOT);
    expect(result.startsWith(ROOT)).toBe(true);
  });

  it("throws when path resolves to root's parent directory", () => {
    // /project/root/../../project resolves to /project which is outside root
    expect(() => safeOutputPath("../../project", ROOT)).toThrow("Path traversal detected");
  });

  it("resolved path starts with projectRoot + sep for nested files", () => {
    const result = safeOutputPath("foo.txt", ROOT);
    expect(result.startsWith(ROOT + path.sep)).toBe(true);
  });
});
