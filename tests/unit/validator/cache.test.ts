import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runValidator } from "../../../src/validator/index.js";
import { getCachePath, loadCacheAsync, saveCacheAsync } from "../../../src/validator/cache.js";
import type { BackendManifest } from "../../../src/templater/selector.js";

const MOCK_MANIFEST: BackendManifest = {
  backend: "claude",
  version: "2026.1",
  supported_features: {
    anchors: true,
    rules: true,
    skills: true,
    agents: true,
    hooks: true,
  },
  file_patterns: {
    anchor: ["CLAUDE.md"],
    rules: ".claude/rules/*.md",
    skills: ".claude/skills/*.md",
    agents: ".claude/agents/*.md",
    hooks: ".claude/hooks/*",
  },
  max_file_sizes: {
    anchor: 5000,
    rules: 10000,
    skills: 15000,
    agents: 8000,
  },
  frontmatter_schema: {
    rules: {
      required: ["scope", "severity"],
      optional: ["action", "rationale", "tags"],
      severity_values: ["hard", "soft", "info"],
    },
    skills: {
      required: ["name", "description"],
      optional: ["tools_required", "when_to_use"],
    },
    agents: {
      required: ["name"],
      optional: ["role", "allowed_tools"],
    },
  },
};

describe("Incremental validation cache", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-cache-test-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads default empty cache if cache file does not exist", async () => {
    const cache = await loadCacheAsync(tmpDir, "2026.1");
    expect(cache.version).toBe("1.0");
    expect(cache.manifestVersion).toBe("2026.1");
    expect(cache.files).toEqual({});
  });

  it("saves and loads validation cache successfully", async () => {
    const cache = {
      version: "1.0",
      manifestVersion: "2026.1",
      files: {
        "file1.md": {
          mtime: 12345678,
          errors: [],
        },
      },
    };
    await saveCacheAsync(tmpDir, cache);
    const loaded = await loadCacheAsync(tmpDir, "2026.1");
    expect(loaded).toEqual(cache);
  });

  it("skips cached files and runs validation on new/changed files", async () => {
    // Scaffold initial CLAUDE.md
    const anchorPath = path.join(tmpDir, "CLAUDE.md");
    fs.writeFileSync(anchorPath, "# Test anchor\n- Entry: src/index.ts\n- Test command: `npm test`\n", "utf-8");

    // Scaffold initial rule
    const rulePath = path.join(tmpDir, ".claude/rules/rule1.md");
    fs.mkdirSync(path.dirname(rulePath), { recursive: true });
    fs.writeFileSync(rulePath, "---\nscope: \"**/*\"\nseverity: soft\n---\nRule body\n", "utf-8");

    // Perform first validation run
    const result1 = await runValidator({
      level: "all",
      projectRoot: tmpDir,
      manifest: MOCK_MANIFEST,
    });
    expect(result1.passed).toBe(true);

    const cachePath = getCachePath(tmpDir);
    expect(fs.existsSync(cachePath)).toBe(true);

    // Read cache to check rule1.md is present
    const cache1 = await loadCacheAsync(tmpDir, "2026.1");
    expect(cache1.files[rulePath]).toBeDefined();
    const oldMtime = cache1.files[rulePath]?.mtime;

    // Mutate the cache in-memory to inject a fake error for verification
    const fakeError = {
      file: rulePath,
      type: "MOCK_ERROR",
      severity: "error" as const,
      message: "Fake injected cached error",
      resolution: "None",
    };
    cache1.files[rulePath]!.errors = [fakeError];
    await saveCacheAsync(tmpDir, cache1);

    // Run validation again. Because rule1.md mtime has NOT changed, it should reuse cache and fail!
    const result2 = await runValidator({
      level: "all",
      projectRoot: tmpDir,
      manifest: MOCK_MANIFEST,
    });
    expect(result2.passed).toBe(false);
    expect(result2.errors).toHaveLength(1);
    expect(result2.errors[0]?.type).toBe("MOCK_ERROR");

    // Now modify the rule file (which changes its mtime)
    fs.writeFileSync(rulePath, "---\nscope: \"**/*\"\nseverity: hard\n---\nRule body changed\n", "utf-8");

    // Run validation again. It should detect change, skip cache, re-validate, and pass!
    const result3 = await runValidator({
      level: "all",
      projectRoot: tmpDir,
      manifest: MOCK_MANIFEST,
    });
    expect(result3.passed).toBe(true);
    expect(result3.errors).toHaveLength(0);
  });
});
