/**
 * Shared LSP contract suite: every registered backend adapter must be
 * substitutable behind `BlueprintAdapter` (see src/translator/adapter.ts for
 * the documented pre/postconditions this suite enforces).
 */

import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { listBackendIds } from "../../../src/backends/registry.js";
import { getAdapter } from "../../../src/translator/index.js";
import { BlueprintIRSchema, type BlueprintIR } from "../../../src/translator/ir.js";

const FIXTURE_IR: BlueprintIR = {
  version: "2.0",
  spatial_anchor: {
    project_name: "bp-contract-test",
    surface: "CLI tool",
    temporal_anchor: "development",
    conventions: ["use TypeScript strict mode"],
  },
  personas: [],
  rules: [
    {
      id: "no-sync-fs",
      scope: "src/**/*.ts",
      severity: "hard",
      action: "Use node:fs/promises instead of sync fs calls",
      rationale: "Keeps the CLI responsive",
      tags: ["style"],
    },
  ],
  skills: [
    {
      id: "release",
      name: "release",
      description: "Cut a release",
      procedure: "1. Bump version\n2. Tag\n3. Publish",
      tools_required: [],
      when_to_use: "When shipping a new version",
    },
  ],
  hooks: [],
  meta: {
    rule_precedence: [],
    conflict_resolution: "precedence-based",
    source_backend: "ir",
    target_backend: "generic",
  },
};

const tmpDirs: string[] = [];
function scratchDir(label: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `bp-adapter-contract-${label}-`));
  tmpDirs.push(dir);
  return dir;
}

afterAll(() => {
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function contentDigest(root: string, files: string[]): Map<string, string> {
  const digests = new Map<string, string>();
  for (const file of files) {
    const rel = path.relative(root, file);
    // Generation-timestamp lines (AGENTS.md `**Generated:**`, settings-file
    // `# Generated:` comments) are the one sanctioned nondeterminism — see
    // the BlueprintAdapter contract docs.
    const normalized = fs
      .readFileSync(file, "utf-8")
      .replace(/^(\*\*Generated:\*\*|# Generated:|\/\/ Generated:) .*$/gm, "$1 <normalized>");
    digests.set(rel, crypto.createHash("sha256").update(normalized).digest("hex"));
  }
  return digests;
}

describe.each(listBackendIds())("BlueprintAdapter contract — %s", (backend) => {
  it("parse of an empty project returns a schema-valid minimal IR", async () => {
    const adapter = await getAdapter(backend);
    const ir = await adapter.parse(scratchDir(`${backend}-empty`));
    expect(() => BlueprintIRSchema.parse(ir)).not.toThrow();
  });

  it("render returns existing files inside the project root", async () => {
    const adapter = await getAdapter(backend);
    const root = scratchDir(`${backend}-render`);
    const written = await adapter.render(structuredClone(FIXTURE_IR), root);

    expect(Array.isArray(written)).toBe(true);
    for (const file of written) {
      expect(fs.existsSync(file), `${backend} reported unwritten file ${file}`).toBe(true);
      const rel = path.relative(root, file);
      expect(rel.startsWith(".."), `${backend} wrote outside project root: ${file}`).toBe(false);
    }
  });

  it("render is deterministic and idempotent for the same IR", async () => {
    const adapter = await getAdapter(backend);
    const rootA = scratchDir(`${backend}-det-a`);
    const rootB = scratchDir(`${backend}-det-b`);

    const writtenA = await adapter.render(structuredClone(FIXTURE_IR), rootA);
    const writtenB = await adapter.render(structuredClone(FIXTURE_IR), rootB);
    expect(contentDigest(rootB, writtenB)).toEqual(contentDigest(rootA, writtenA));

    // Re-render into a directory that already holds the output (idempotency)
    const writtenAgain = await adapter.render(structuredClone(FIXTURE_IR), rootA);
    expect(contentDigest(rootA, writtenAgain)).toEqual(contentDigest(rootA, writtenA));
  });

  it("round-trip: rendered output parses back into a schema-valid IR", async () => {
    const adapter = await getAdapter(backend);
    const root = scratchDir(`${backend}-roundtrip`);
    await adapter.render(structuredClone(FIXTURE_IR), root);
    const ir = await adapter.parse(root);
    expect(() => BlueprintIRSchema.parse(ir)).not.toThrow();
  });
});
