import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { readArtifact, verifyArtifact } from "../../../src/registry/artifact.js";
import { publishArtifact } from "../../../src/registry/publish.js";
import { generateKeyPair } from "../../../src/registry/signer.js";

const VALID_PACK = `schema: bp-pack/1
id: demo
name: Demo Pack
version: 1.0.0
kind: rules
framework: custom
description: Demo
author: demo@example.com
tags: []
rules:
  - id: r1
    scope: "src/**/*.ts"
    severity: soft
    action: "Do the thing"
`;

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-publish-test-"));
});
afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("bp pack publish (publishArtifact)", () => {
  it("publish → read-back → verify round trip for a rule pack", async () => {
    const keys = generateKeyPair();
    const packFile = path.join(tmpDir, "demo.bp-pack.yaml");
    fs.writeFileSync(packFile, VALID_PACK, "utf-8");

    const result = await publishArtifact({
      filePath: packFile,
      privateKeyPem: keys.privateKey,
      outDir: path.join(tmpDir, "out"),
    });

    expect(path.basename(result.artifactPath)).toBe("demo-1.0.0.bp-pack.tgz");
    expect(fs.existsSync(result.artifactPath)).toBe(true);
    expect(fs.existsSync(result.indexEntryPath)).toBe(true);

    const artifact = readArtifact(fs.readFileSync(result.artifactPath));
    expect(artifact.manifest.id).toBe("demo");
    expect(artifact.manifest.publisher).toBe("demo@example.com");
    const decision = verifyArtifact(artifact, [{ name: "k", publicKeyPem: keys.publicKey }]);
    expect(decision).toEqual({ status: "signed", keyName: "k" });

    const entry = JSON.parse(fs.readFileSync(result.indexEntryPath, "utf-8"));
    expect(entry).toMatchObject({
      id: "demo",
      version: "1.0.0",
      kind: "rules",
      url: "demo-1.0.0.bp-pack.tgz",
      sha256: result.built.artifactSha256,
    });
  });

  it("refuses to publish a pack that fails the bp-pack schema", async () => {
    const keys = generateKeyPair();
    const packFile = path.join(tmpDir, "broken.bp-pack.yaml");
    fs.writeFileSync(packFile, "schema: bp-pack/1\nid: broken\n", "utf-8");
    await expect(
      publishArtifact({ filePath: packFile, privateKeyPem: keys.privateKey, outDir: tmpDir })
    ).rejects.toThrowError(/PACK_INVALID/);
  });

  it("publishes a plugin bundle with explicit id/version/publisher", async () => {
    const keys = generateKeyPair();
    const pluginFile = path.join(tmpDir, "checker.mjs");
    fs.writeFileSync(pluginFile, "export default { name: 'checker' };\n", "utf-8");

    const result = await publishArtifact({
      filePath: pluginFile,
      privateKeyPem: keys.privateKey,
      outDir: tmpDir,
      pluginId: "checker",
      pluginVersion: "0.1.0",
      publisher: "plugins@example.com",
    });
    const artifact = readArtifact(fs.readFileSync(result.artifactPath));
    expect(artifact.manifest.kind).toBe("plugin");
    expect([...artifact.files.keys()]).toEqual(["checker.mjs"]);
  });

  it("plugin publish without id/version fails loud", async () => {
    const keys = generateKeyPair();
    const pluginFile = path.join(tmpDir, "checker.mjs");
    fs.writeFileSync(pluginFile, "export default {};\n", "utf-8");
    await expect(
      publishArtifact({ filePath: pluginFile, privateKeyPem: keys.privateKey, outDir: tmpDir })
    ).rejects.toThrowError(/PACK_INVALID/);
  });
});
