import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { writeFile } from "../../../src/templater/writer.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-writer-test-"));
}

describe("templater writer", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("writes new files successfully when they do not exist", async () => {
    const file = path.join(tmpDir, "CLAUDE.md");
    const res = await writeFile(file, "# New Content", { dryRun: false, projectRoot: tmpDir });
    expect(res.action).toBe("created");
    expect(fs.readFileSync(file, "utf-8")).toBe("# New Content");
  });

  it("skips writing if existing content matches exactly", async () => {
    const file = path.join(tmpDir, "CLAUDE.md");
    fs.writeFileSync(file, "# Matching Content", "utf-8");
    const res = await writeFile(file, "# Matching Content", { dryRun: false, projectRoot: tmpDir });
    expect(res.action).toBe("skipped");
  });

  it("performs dryRun with no writes and generates unified diffs", async () => {
    const file = path.join(tmpDir, "CLAUDE.md");
    const res = await writeFile(file, "# New Content", { dryRun: true, projectRoot: tmpDir });
    expect(res.action).toBe("dry-run");
    expect(fs.existsSync(file)).toBe(false);
  });

  it("merges content with markers automatically", async () => {
    const file = path.join(tmpDir, "CLAUDE.md");
    const existing = `<!-- bp-generated:begin pos -->
old
<!-- bp-generated:end pos -->
<!-- bp:preserve -->
my notes
<!-- bp:end-preserve -->`;
    fs.writeFileSync(file, existing, "utf-8");

    const incoming = `<!-- bp-generated:begin pos -->
new
<!-- bp-generated:end pos -->`;

    const res = await writeFile(file, incoming, { dryRun: false, projectRoot: tmpDir });
    expect(res.action).toBe("updated");
    const current = fs.readFileSync(file, "utf-8");
    expect(current).toContain("new");
    expect(current).toContain("my notes");
  });

  it("overwrites existing files without markers when force option is set", async () => {
    const file = path.join(tmpDir, "CLAUDE.md");
    fs.writeFileSync(file, "original text", "utf-8");
    const res = await writeFile(file, "new text", { dryRun: false, force: true, projectRoot: tmpDir });
    expect(res.action).toBe("updated");
    expect(fs.readFileSync(file, "utf-8")).toBe("new text");
  });

  it("skips overwrite without markers when conflictResolution is skip", async () => {
    const file = path.join(tmpDir, "CLAUDE.md");
    fs.writeFileSync(file, "original text", "utf-8");
    const res = await writeFile(file, "new text", {
      dryRun: false,
      force: false,
      projectRoot: tmpDir,
    }, "skip");
    expect(res.action).toBe("skipped");
    expect(fs.readFileSync(file, "utf-8")).toBe("original text");
  });
});
