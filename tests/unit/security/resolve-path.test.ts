import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveAndValidatePath } from "../../../src/utils/paths.js";
import { PermissionError } from "../../../src/errors.js";

describe("resolveAndValidatePath", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-paths-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns resolved path for valid file inside base", () => {
    const result = resolveAndValidatePath("output.txt", tmpDir);
    expect(result).toBe(path.join(tmpDir, "output.txt"));
  });

  it("returns resolved path for nested path inside base", () => {
    const result = resolveAndValidatePath("src/file.ts", tmpDir);
    expect(result).toBe(path.join(tmpDir, "src", "file.ts"));
  });

  it("returns base itself when input is '.'", () => {
    const result = resolveAndValidatePath(".", tmpDir);
    expect(result).toBe(tmpDir);
  });

  it("throws PermissionError on simple ../ path traversal", () => {
    expect(() => resolveAndValidatePath("../secret.txt", tmpDir)).toThrow(PermissionError);
  });

  it("throws PermissionError on deep ../ traversal", () => {
    expect(() => resolveAndValidatePath("../../etc/passwd", tmpDir)).toThrow(PermissionError);
  });

  it("throws PermissionError on embedded traversal", () => {
    expect(() => resolveAndValidatePath("src/../../etc/shadow", tmpDir)).toThrow(PermissionError);
  });

  it("throws PermissionError on absolute path outside base", () => {
    expect(() => resolveAndValidatePath("/etc/passwd", tmpDir)).toThrow(PermissionError);
  });

  it("symlink escape blocked when symlink points outside base", () => {
    const outsideTarget = path.join(os.tmpdir(), "outside-target.txt");
    fs.writeFileSync(outsideTarget, "secret");
    const symlinkPath = path.join(tmpDir, "escape.txt");
    fs.symlinkSync(outsideTarget, symlinkPath);

    expect(() => resolveAndValidatePath("escape.txt", tmpDir)).toThrow(PermissionError);

    fs.unlinkSync(outsideTarget);
  });

  it("allows non-existent output path within base (no realpath check for missing files)", () => {
    const result = resolveAndValidatePath("new-output/file.txt", tmpDir);
    expect(result).toBe(path.join(tmpDir, "new-output", "file.txt"));
  });

  it("error message includes input and base in traversal case", () => {
    try {
      resolveAndValidatePath("../outside.txt", tmpDir);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(PermissionError);
      expect((e as PermissionError).message).toContain("../outside.txt");
    }
  });

  it("uses process.cwd() as default allowedBase when not provided", () => {
    const cwd = process.cwd();
    const result = resolveAndValidatePath("some-file.txt");
    expect(result).toBe(path.join(cwd, "some-file.txt"));
  });
});
