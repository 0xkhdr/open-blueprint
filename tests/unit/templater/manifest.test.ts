import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  classifyFile,
  computeContentHash,
  createEmptyManifest,
  getManifestStatus,
  loadManifest,
  MANIFEST_FILE,
  recordFile,
  saveManifest,
  toManifestKey,
} from "../../../src/templater/manifest.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-manifest-test-"));
}

describe("computeContentHash", () => {
  it("is deterministic", () => {
    expect(computeContentHash("hello")).toBe(computeContentHash("hello"));
  });

  it("differs for different content", () => {
    expect(computeContentHash("a")).not.toBe(computeContentHash("b"));
  });

  it("produces a sha256 hex digest", () => {
    expect(computeContentHash("x")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("toManifestKey", () => {
  it("produces a posix-style relative key", () => {
    const root = path.join(path.sep, "project");
    const file = path.join(root, "sub", "file.md");
    expect(toManifestKey(root, file)).toBe("sub/file.md");
  });
});

describe("recordFile / classifyFile", () => {
  it("classifies untracked files", () => {
    const m = createEmptyManifest("1.0.0");
    expect(classifyFile(m, "a.md", "content").state).toBe("untracked");
  });

  it("classifies a recorded, unchanged file as managed", () => {
    const m = createEmptyManifest("1.0.0");
    recordFile(m, "a.md", "content", "generated");
    expect(classifyFile(m, "a.md", "content").state).toBe("managed");
  });

  it("classifies a recorded, edited file as modified", () => {
    const m = createEmptyManifest("1.0.0");
    recordFile(m, "a.md", "content", "generated");
    expect(classifyFile(m, "a.md", "EDITED").state).toBe("modified");
  });

  it("classifies a recorded, deleted file as missing", () => {
    const m = createEmptyManifest("1.0.0");
    recordFile(m, "a.md", "content", "adopted");
    const status = classifyFile(m, "a.md", null);
    expect(status.state).toBe("missing");
    expect(status.origin).toBe("adopted");
  });

  it("treats a null manifest as all-untracked", () => {
    expect(classifyFile(null, "a.md", "x").state).toBe("untracked");
  });

  it("records the origin and template", () => {
    const m = createEmptyManifest("1.0.0");
    recordFile(m, "a.md", "x", "generated", "rules/01.md.hbs");
    expect(m.files["a.md"]?.origin).toBe("generated");
    expect(m.files["a.md"]?.template).toBe("rules/01.md.hbs");
  });
});

describe("persistence", () => {
  let dir: string;
  beforeEach(() => {
    dir = createTmpDir();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns null when no manifest exists", async () => {
    expect(await loadManifest(dir)).toBeNull();
  });

  it("round-trips a saved manifest", async () => {
    const m = createEmptyManifest("1.0.0");
    recordFile(m, "rules/a.md", "body", "generated", "t.hbs");
    await saveManifest(dir, m);

    expect(fs.existsSync(path.join(dir, MANIFEST_FILE))).toBe(true);
    const loaded = await loadManifest(dir);
    expect(loaded?.files["rules/a.md"]?.hash).toBe(computeContentHash("body"));
  });

  it("throws a clear error on a corrupt manifest", async () => {
    fs.mkdirSync(path.join(dir, ".bp"), { recursive: true });
    fs.writeFileSync(path.join(dir, MANIFEST_FILE), "{ not json", "utf-8");
    await expect(loadManifest(dir)).rejects.toThrow(/corrupt/);
  });
});

describe("getManifestStatus", () => {
  let dir: string;
  beforeEach(() => {
    dir = createTmpDir();
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("reports managed, modified, and untracked files together", async () => {
    fs.mkdirSync(path.join(dir, "rules"), { recursive: true });
    fs.writeFileSync(path.join(dir, "rules/managed.md"), "M", "utf-8");
    fs.writeFileSync(path.join(dir, "rules/edited.md"), "EDITED", "utf-8");
    fs.writeFileSync(path.join(dir, "rules/new.md"), "N", "utf-8");

    const m = createEmptyManifest("1.0.0");
    recordFile(m, "rules/managed.md", "M", "generated");
    recordFile(m, "rules/edited.md", "ORIGINAL", "generated");
    await saveManifest(dir, m);

    const statuses = await getManifestStatus(dir, [
      path.join(dir, "rules/managed.md"),
      path.join(dir, "rules/edited.md"),
      path.join(dir, "rules/new.md"),
    ]);
    const byPath = Object.fromEntries(statuses.map((s) => [s.path, s.state]));
    expect(byPath["rules/managed.md"]).toBe("managed");
    expect(byPath["rules/edited.md"]).toBe("modified");
    expect(byPath["rules/new.md"]).toBe("untracked");
  });

  it("surfaces tracked-but-deleted files as missing", async () => {
    const m = createEmptyManifest("1.0.0");
    recordFile(m, "rules/gone.md", "X", "generated");
    await saveManifest(dir, m);

    const statuses = await getManifestStatus(dir, []);
    expect(statuses.find((s) => s.path === "rules/gone.md")?.state).toBe("missing");
  });
});
