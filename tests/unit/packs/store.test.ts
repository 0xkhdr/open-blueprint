import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BpError } from "../../../src/errors.js";
import {
  assertNoBuiltinCollision,
  isPathRef,
  loadPackFromFile,
  loadProjectPacks,
  resolvePack,
} from "../../../src/packs/store.js";

let tmpDir: string;

const VALID_YAML = `schema: bp-pack/1
id: acme
name: ACME Internal
version: 1.0.0
kind: rules
framework: custom
description: House rules
author: platform@acme.test
tags: [security]
rules:
  - id: no-console
    scope: "src/**/*.ts"
    severity: hard
    action: "No console.log"
`;

function write(rel: string, content: string): string {
  const file = path.join(tmpDir, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf-8");
  return file;
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-pack-store-"));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("isPathRef", () => {
  it("treats ids as ids and paths as paths", () => {
    expect(isPathRef("acme")).toBe(false);
    expect(isPathRef("gdpr-baseline")).toBe(false);
    expect(isPathRef("./acme.bp-pack.yaml")).toBe(true);
    expect(isPathRef("packs/acme.bp-pack.json")).toBe(true);
    expect(isPathRef("acme.bp-pack.yaml")).toBe(true);
  });
});

describe("loadPackFromFile", () => {
  it("loads a valid YAML pack", async () => {
    const file = write("acme.bp-pack.yaml", VALID_YAML);
    const loaded = await loadPackFromFile(file);
    expect(loaded.pack.id).toBe("acme");
    expect(loaded.source).toBe("path");
    expect(loaded.path).toBe(file);
  });

  it("loads a valid JSON pack", async () => {
    const data = {
      schema: "bp-pack/1",
      id: "acme-json",
      name: "ACME JSON",
      version: "2.0.0",
      kind: "rules",
      skills: [],
      framework: "custom",
      description: "JSON pack",
      author: "x@acme.test",
      tags: [],
      rules: [{ id: "r1", scope: "**/*", severity: "soft", action: "Do the thing" }],
    };
    const file = write("acme.bp-pack.json", JSON.stringify(data));
    const loaded = await loadPackFromFile(file);
    expect(loaded.pack.id).toBe("acme-json");
  });

  it("fails with PACK_NOT_FOUND for a missing file", async () => {
    await expect(loadPackFromFile(path.join(tmpDir, "nope.bp-pack.yaml"))).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_NOT_FOUND"
    );
  });

  it("fails loud with PACK_INVALID for malformed YAML", async () => {
    const file = write("broken.bp-pack.yaml", "schema: [unclosed\n  - bad");
    await expect(loadPackFromFile(file)).rejects.toSatisfy(
      (e: unknown) => e instanceof BpError && e.code === "PACK_INVALID"
    );
  });

  it("fails with PACK_INVALID listing the Zod issue path for a broken severity", async () => {
    const file = write("badsev.bp-pack.yaml", VALID_YAML.replace("severity: hard", "severity: fatal"));
    await expect(loadPackFromFile(file)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof BpError &&
        e.code === "PACK_INVALID" &&
        e.message.includes("rules.0.severity")
    );
  });

  it("fails with PACK_DUPLICATE_RULE for duplicate rule ids", async () => {
    const dup = `${VALID_YAML}  - id: no-console
    scope: "src/**/*.ts"
    severity: soft
    action: "Duplicate id"
`;
    const file = write("dup.bp-pack.yaml", dup);
    await expect(loadPackFromFile(file)).rejects.toSatisfy(
      (e: unknown) =>
        e instanceof BpError && e.code === "PACK_DUPLICATE_RULE" && e.message.includes("no-console")
    );
  });
});

describe("resolvePack resolution order", () => {
  it("resolves path refs first", async () => {
    const file = write("somewhere/acme.bp-pack.yaml", VALID_YAML);
    const loaded = await resolvePack(path.relative(tmpDir, file), tmpDir);
    expect(loaded?.source).toBe("path");
  });

  it("resolves project packs by id from .bp/packs/", async () => {
    write(".bp/packs/acme.bp-pack.yaml", VALID_YAML);
    const loaded = await resolvePack("acme", tmpDir);
    expect(loaded?.source).toBe("project");
    expect(loaded?.pack.name).toBe("ACME Internal");
  });

  it("project packs shadow built-ins with the same id", async () => {
    write(
      ".bp/packs/gdpr-baseline.bp-pack.yaml",
      VALID_YAML.replace("id: acme", "id: gdpr-baseline")
    );
    const loaded = await resolvePack("gdpr-baseline", tmpDir);
    expect(loaded?.source).toBe("project");
  });

  it("falls back to built-ins", async () => {
    const loaded = await resolvePack("gdpr-baseline", tmpDir);
    expect(loaded?.source).toBe("built-in");
    expect(loaded?.pack.framework).toBe("gdpr");
  });

  it("returns undefined for unknown refs", async () => {
    expect(await resolvePack("does-not-exist", tmpDir)).toBeUndefined();
  });
});

describe("loadProjectPacks", () => {
  it("collects valid packs and reports failures separately", async () => {
    write(".bp/packs/good.bp-pack.yaml", VALID_YAML.replace("id: acme", "id: good"));
    write(".bp/packs/bad.bp-pack.yaml", "schema: bp-pack/1\nid: 'BAD ID!'\n");
    const { packs, failures } = await loadProjectPacks(tmpDir);
    expect(packs.map((p) => p.pack.id)).toEqual(["good"]);
    expect(failures).toHaveLength(1);
    expect(failures[0]?.message).toContain("PACK_INVALID");
  });
});

describe("assertNoBuiltinCollision", () => {
  it("throws PACK_ID_COLLISION for built-in ids", async () => {
    const file = write(
      "shadow.bp-pack.yaml",
      VALID_YAML.replace("id: acme", "id: gdpr-baseline")
    );
    const loaded = await loadPackFromFile(file);
    expect(() => assertNoBuiltinCollision(loaded.pack)).toThrowError(/PACK_ID_COLLISION/);
  });

  it("passes for non-colliding ids", async () => {
    const loaded = await loadPackFromFile(write("ok.bp-pack.yaml", VALID_YAML));
    expect(() => assertNoBuiltinCollision(loaded.pack)).not.toThrow();
  });
});
