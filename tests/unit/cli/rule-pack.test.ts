import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRuleCommand } from "../../../src/cli/commands/rule.js";
import { BpError } from "../../../src/errors.js";

let tmpDir: string;
let prevCwd: string;

const VALID_PACK_YAML = `schema: bp-pack/1
id: acme
name: ACME Internal
version: 1.0.0
kind: rules
framework: custom
description: House rules
author: platform@acme.test
tags: [security]
rules:
  - id: docs-required
    scope: "**/*"
    severity: soft
    action: "Keep README updated"
  - id: security-policy
    scope: "**/*"
    severity: hard
    action: "SECURITY.md must exist"
    check:
      type: file-exists
      glob: "SECURITY.md"
`;

function write(rel: string, content: string): string {
  const file = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf-8");
  return file;
}

async function run(...args: string[]): Promise<void> {
  await createRuleCommand().parseAsync(args, { from: "user" });
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-pack-cli-"));
  fs.writeFileSync(path.join(tmpDir, "package.json"), JSON.stringify({ name: "fixture" }));
  fs.writeFileSync(path.join(tmpDir, "README.md"), "# Fixture\n");
  prevCwd = process.cwd();
  process.chdir(tmpDir);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.chdir(prevCwd);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

describe("bp rule pack:create", () => {
  it("scaffolds a lintable pack file in .bp/packs/", async () => {
    await run("pack:create", "my-pack");
    const file = path.join(tmpDir, ".bp/packs/my-pack.bp-pack.yaml");
    expect(fs.existsSync(file)).toBe(true);
    // The scaffold must itself pass pack:lint.
    await expect(run("pack:lint", file)).resolves.toBeUndefined();
  });

  it("rejects invalid ids", async () => {
    await expect(run("pack:create", "Bad Id!")).rejects.toBeInstanceOf(BpError);
  });

  it("refuses to overwrite without --force", async () => {
    await run("pack:create", "my-pack");
    await expect(run("pack:create", "my-pack")).rejects.toBeInstanceOf(BpError);
    await expect(run("pack:create", "my-pack", "--force")).resolves.toBeUndefined();
  });

  it("harvests existing rule files with --from-rules", async () => {
    write(
      ".claude/rules/style.md",
      '---\nid: style\nscope: "src/**/*.ts"\nseverity: soft\naction: "Follow style"\n---\nBody\n'
    );
    await run("pack:create", "harvested", "--from-rules", ".claude/rules/*.md");
    const content = fs.readFileSync(path.join(tmpDir, ".bp/packs/harvested.bp-pack.yaml"), "utf-8");
    expect(content).toContain("id: style");
    expect(content).toContain("schema: bp-pack/1");
  });
});

describe("bp rule pack:lint", () => {
  it("passes a valid pack", async () => {
    const file = write(".bp/packs/acme.bp-pack.yaml", VALID_PACK_YAML);
    await expect(run("pack:lint", file)).resolves.toBeUndefined();
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining("PASS"));
  });

  it("fails non-zero with the Zod issue path for a broken severity", async () => {
    const file = write(
      ".bp/packs/bad.bp-pack.yaml",
      VALID_PACK_YAML.replace("severity: soft", "severity: fatal")
    );
    await expect(run("pack:lint", file)).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.exitCode === 1
    );
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining("rules.0.severity"));
  });

  it("fails for duplicate rule ids", async () => {
    const file = write(
      ".bp/packs/dup.bp-pack.yaml",
      VALID_PACK_YAML.replace("id: security-policy", "id: docs-required")
    );
    await expect(run("pack:lint", file)).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_DUPLICATE_RULE"
    );
  });

  it("supports --json output", async () => {
    const file = write(".bp/packs/acme.bp-pack.yaml", VALID_PACK_YAML);
    await run("pack:lint", file, "--json");
    const call = vi.mocked(console.log).mock.calls.find((c) => String(c[0]).includes('"valid"'));
    expect(call).toBeDefined();
    expect(JSON.parse(String(call?.[0]))).toMatchObject({ valid: true, id: "acme", rules: 2 });
  });
});

describe("bp rule pack:install / pack:remove", () => {
  it("installs a project pack as rule files and updates the lockfile", async () => {
    write(".bp/packs/acme.bp-pack.yaml", VALID_PACK_YAML);
    await run("pack:install", "acme");

    expect(fs.existsSync(path.join(tmpDir, ".claude/rules/pack-acme-docs-required.md"))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, ".claude/rules/pack-acme-security-policy.md"))).toBe(
      true
    );
    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, ".bp/packs.lock.json"), "utf-8"));
    expect(lock.installed[0]).toMatchObject({ id: "acme", version: "1.0.0", rules_count: 2 });
  });

  it("install is idempotent", async () => {
    write(".bp/packs/acme.bp-pack.yaml", VALID_PACK_YAML);
    await run("pack:install", "acme");
    const file = path.join(tmpDir, ".claude/rules/pack-acme-docs-required.md");
    const before = fs.readFileSync(file, "utf-8");
    await run("pack:install", "acme");
    expect(fs.readFileSync(file, "utf-8")).toBe(before);
  });

  it("fails with PACK_NOT_FOUND for unknown refs", async () => {
    await expect(run("pack:install", "ghost")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_NOT_FOUND"
    );
  });

  it("blocks installing a project pack that shadows a built-in id unless --force", async () => {
    write(
      ".bp/packs/shadow.bp-pack.yaml",
      VALID_PACK_YAML.replace("id: acme", "id: gdpr-baseline")
    );
    await expect(run("pack:install", "gdpr-baseline")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_ID_COLLISION"
    );
    await expect(run("pack:install", "gdpr-baseline", "--force")).resolves.toBeUndefined();
  });

  it("installs built-in packs", async () => {
    await run("pack:install", "soc2-type2");
    const files = fs.readdirSync(path.join(tmpDir, ".claude/rules"));
    expect(files.some((f) => f.startsWith("pack-soc2-type2-"))).toBe(true);
  });

  it("removes a pack's files and lock entry", async () => {
    write(".bp/packs/acme.bp-pack.yaml", VALID_PACK_YAML);
    await run("pack:install", "acme");
    await run("pack:remove", "acme");

    expect(fs.existsSync(path.join(tmpDir, ".claude/rules/pack-acme-docs-required.md"))).toBe(
      false
    );
    const lock = JSON.parse(fs.readFileSync(path.join(tmpDir, ".bp/packs.lock.json"), "utf-8"));
    expect(lock.installed).toHaveLength(0);
  });

  it("blocks removal of hand-edited files without --force", async () => {
    write(".bp/packs/acme.bp-pack.yaml", VALID_PACK_YAML);
    await run("pack:install", "acme");
    fs.appendFileSync(
      path.join(tmpDir, ".claude/rules/pack-acme-docs-required.md"),
      "\nTampered.\n"
    );

    await expect(run("pack:remove", "acme")).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_FILE_MODIFIED"
    );
    await expect(run("pack:remove", "acme", "--force")).resolves.toBeUndefined();
  });
});

describe("bp rule pack:list / pack:info / pack:search", () => {
  it("lists built-in, project, and installed packs", async () => {
    write(".bp/packs/acme.bp-pack.yaml", VALID_PACK_YAML);
    await run("pack:install", "acme");
    vi.mocked(console.log).mockClear();

    await run("pack:list");
    const output = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .join("\n");
    expect(output).toContain("gdpr-baseline");
    expect(output).toContain("acme");
    expect(output).toContain("Installed");
  });

  it("shows pack info for a file path ref", async () => {
    const file = write(".bp/packs/acme.bp-pack.yaml", VALID_PACK_YAML);
    await run("pack:info", file);
    const output = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .join("\n");
    expect(output).toContain("ACME Internal");
    expect(output).toContain("docs-required");
  });

  it("pack:info fails for unknown packs", async () => {
    await expect(run("pack:info", "ghost")).rejects.toBeInstanceOf(BpError);
  });

  it("searches across built-in and project packs", async () => {
    write(".bp/packs/acme.bp-pack.yaml", VALID_PACK_YAML);
    await run("pack:search", "house");
    const output = vi
      .mocked(console.log)
      .mock.calls.map((c) => String(c[0]))
      .join("\n");
    expect(output).toContain("acme");
  });
});
