/**
 * Stage 5 integration: full signed-distribution lifecycle against a local
 * HTTP server — keygen → publish → serve → trust → install — plus the
 * tamper/unsigned/index failure paths from the acceptance criteria.
 */

import * as fs from "node:fs";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { detect } from "../../src/detector/index.js";
import { BpError } from "../../src/errors.js";
import { loadPackLock } from "../../src/packs/materialize.js";
import { buildArtifact } from "../../src/registry/artifact.js";
import { canonicalJson } from "../../src/registry/canonical.js";
import { installRemoteArtifact, resolvePluginArtifactPath } from "../../src/registry/install.js";
import { publishArtifact } from "../../src/registry/publish.js";
import { type RegistryIndex, signIndex } from "../../src/registry/registry-index.js";
import { addTrustedKey, generateKeyFiles } from "../../src/registry/trust.js";
import { resolveTemplatePack } from "../../src/templater/selector.js";
import { validatePackIntegrity } from "../../src/validator/pack-integrity.js";

const VALID_PACK = `schema: bp-pack/1
id: acme-remote
name: ACME Remote Pack
version: 1.0.0
kind: rules
framework: custom
description: Distributed over the wire
author: platform@acme.test
tags: [security]
rules:
  - id: no-console
    scope: "src/**/*.ts"
    severity: soft
    action: "Avoid console.log"
`;

let tmpDir: string;
let projectRoot: string;
let serveDir: string;
let server: http.Server;
let baseUrl: string;
let prevBpHome: string | undefined;

async function startServer(): Promise<void> {
  server = http.createServer((req, res) => {
    const target = path.join(serveDir, path.normalize(req.url ?? "/").replace(/^\/+/, ""));
    try {
      const data = fs.readFileSync(target);
      res.writeHead(200);
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

beforeEach(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-dist-int-"));
  projectRoot = path.join(tmpDir, "project");
  serveDir = path.join(tmpDir, "serve");
  fs.mkdirSync(projectRoot, { recursive: true });
  fs.mkdirSync(serveDir, { recursive: true });
  fs.mkdirSync(path.join(projectRoot, "src"), { recursive: true });
  fs.writeFileSync(path.join(projectRoot, "src/index.ts"), "export const x = 1;\n");
  fs.writeFileSync(path.join(projectRoot, "package.json"), JSON.stringify({ name: "p" }));

  prevBpHome = process.env.BP_HOME;
  process.env.BP_HOME = path.join(tmpDir, "bp-home");
  await startServer();
});

afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (prevBpHome === undefined) delete process.env.BP_HOME;
  else process.env.BP_HOME = prevBpHome;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

async function claudeManifest() {
  const fingerprint = await detect(projectRoot);
  return resolveTemplatePack(fingerprint, "claude").manifest;
}

interface PublishedFixture {
  artifactName: string;
  sha256: string;
  privateKeyPem: string;
  publicKeyPath: string;
}

/** keygen → publish into the served dir → trust the key. */
async function publishAndTrust(trust = true): Promise<PublishedFixture> {
  const keyFiles = await generateKeyFiles("publisher");
  const privateKeyPem = fs.readFileSync(keyFiles.privateKeyPath, "utf-8");
  const packFile = path.join(tmpDir, "acme-remote.bp-pack.yaml");
  fs.writeFileSync(packFile, VALID_PACK, "utf-8");
  const published = await publishArtifact({ filePath: packFile, privateKeyPem, outDir: serveDir });
  if (trust) {
    await addTrustedKey("acme", fs.readFileSync(keyFiles.publicKeyPath, "utf-8"));
  }
  return {
    artifactName: path.basename(published.artifactPath),
    sha256: published.built.artifactSha256,
    privateKeyPem,
    publicKeyPath: keyFiles.publicKeyPath,
  };
}

function expectNoPartialFiles(): void {
  expect(fs.existsSync(path.join(projectRoot, ".claude/rules"))).toBe(false);
  expect(fs.existsSync(path.join(projectRoot, ".bp/packs.lock.json"))).toBe(false);
}

async function expectInstallFailure(ref: string, code: string): Promise<void> {
  try {
    await installRemoteArtifact(ref, {
      projectRoot,
      manifest: await claudeManifest(),
      expectKind: "rules",
    });
    expect.unreachable(`expected ${code}`);
  } catch (err) {
    expect(err).toBeInstanceOf(BpError);
    expect((err as BpError).code).toBe(code);
  }
  expectNoPartialFiles();
}

describe("signed distribution round trip", () => {
  it("keygen → publish → serve → trust add → install over http succeeds", async () => {
    const fixture = await publishAndTrust();
    const result = await installRemoteArtifact(`${baseUrl}/${fixture.artifactName}`, {
      projectRoot,
      manifest: await claudeManifest(),
      expectKind: "rules",
    });

    expect(result.trust).toBe("signed:acme");
    expect(result.artifactSha256).toBe(fixture.sha256);
    expect(result.materialize?.written).toContain(".claude/rules/pack-acme-remote-no-console.md");
    expect(
      fs.existsSync(path.join(projectRoot, ".claude/rules/pack-acme-remote-no-console.md"))
    ).toBe(true);

    const lock = await loadPackLock(projectRoot);
    const entry = lock.installed.find((e) => e.id === "acme-remote");
    expect(entry?.trust).toBe("signed:acme");
    expect(entry?.artifact_sha256).toBe(fixture.sha256);
    expect(entry?.publisher).toBe("platform@acme.test");
    expect(entry?.source).toBe(`${baseUrl}/${fixture.artifactName}`);
  });

  it("a tampered tarball aborts with PACK_HASH_MISMATCH and no partial files", async () => {
    const fixture = await publishAndTrust();
    const artifactPath = path.join(serveDir, fixture.artifactName);
    const bytes = fs.readFileSync(artifactPath);
    const idx = Math.floor(bytes.length / 2);
    bytes[idx] = (bytes[idx] ?? 0) ^ 0xff;
    fs.writeFileSync(artifactPath, bytes);

    await expectInstallFailure(`${baseUrl}/${fixture.artifactName}`, "PACK_HASH_MISMATCH");
  });

  it("a wrong signing key aborts with PACK_SIGNATURE_INVALID", async () => {
    // Publish signed with one key, but trust a different one.
    const fixture = await publishAndTrust(false);
    const otherKeys = await generateKeyFiles("other");
    await addTrustedKey("other", fs.readFileSync(otherKeys.publicKeyPath, "utf-8"));

    await expectInstallFailure(`${baseUrl}/${fixture.artifactName}`, "PACK_SIGNATURE_INVALID");
  });

  it("a pinned sha256 mismatch aborts before extraction", async () => {
    const fixture = await publishAndTrust();
    try {
      await installRemoteArtifact(`${baseUrl}/${fixture.artifactName}`, {
        projectRoot,
        manifest: await claudeManifest(),
        expectedSha256: "0".repeat(64),
      });
      expect.unreachable("expected PACK_HASH_MISMATCH");
    } catch (err) {
      expect((err as BpError).code).toBe("PACK_HASH_MISMATCH");
    }
  });
});

describe("unsigned artifacts", () => {
  function serveUnsigned(): string {
    const built = buildArtifact({
      id: "unsigned-pack",
      version: "1.0.0",
      kind: "rules",
      files: new Map([["pack.yaml", Buffer.from(VALID_PACK.replace("acme-remote", "unsigned-pack"))]]),
      publisher: "anon",
    });
    const name = "unsigned-pack-1.0.0.bp-pack.tgz";
    fs.writeFileSync(path.join(serveDir, name), built.tarball);
    return name;
  }

  it("is rejected by default with PACK_UNSIGNED", async () => {
    const name = serveUnsigned();
    await expectInstallFailure(`${baseUrl}/${name}`, "PACK_UNSIGNED");
  });

  it("--allow-unsigned installs and records trust: unsigned-accepted", async () => {
    const name = serveUnsigned();
    const result = await installRemoteArtifact(`${baseUrl}/${name}`, {
      projectRoot,
      manifest: await claudeManifest(),
      allowUnsigned: true,
      expectKind: "rules",
    });
    expect(result.unsignedAccepted).toBe(true);
    expect(result.trust).toBe("unsigned-accepted");

    const lock = await loadPackLock(projectRoot);
    expect(lock.installed.find((e) => e.id === "unsigned-pack")?.trust).toBe("unsigned-accepted");
  });
});

describe("validation is never bypassed by signing", () => {
  it("a correctly signed artifact with an invalid pack schema fails install", async () => {
    const keyFiles = await generateKeyFiles("signer");
    await addTrustedKey("signer", fs.readFileSync(keyFiles.publicKeyPath, "utf-8"));
    const built = buildArtifact({
      id: "badpack",
      version: "1.0.0",
      kind: "rules",
      // kind: rules with zero rules — violates the bp-pack/1 schema.
      files: new Map([
        [
          "pack.yaml",
          Buffer.from(
            "schema: bp-pack/1\nid: badpack\nname: Bad\nversion: 1.0.0\nkind: rules\nframework: custom\ndescription: x\nauthor: x\nrules: []\n"
          ),
        ],
      ]),
      publisher: "signer@acme.test",
      privateKeyPem: fs.readFileSync(keyFiles.privateKeyPath, "utf-8"),
    });
    const name = "badpack-1.0.0.bp-pack.tgz";
    fs.writeFileSync(path.join(serveDir, name), built.tarball);

    await expectInstallFailure(`${baseUrl}/${name}`, "PACK_INVALID");
  });
});

describe("signed registry index", () => {
  it("installs by id through the index and flags PACK_OUTDATED on upgrade", async () => {
    const fixture = await publishAndTrust();

    const index: RegistryIndex = {
      schema: "bp-index/1",
      packs: [
        {
          id: "acme-remote",
          version: "1.0.0",
          kind: "rules",
          url: `${baseUrl}/${fixture.artifactName}`,
          sha256: fixture.sha256,
        },
      ],
    };
    fs.writeFileSync(path.join(serveDir, "index.json"), canonicalJson(index), "utf-8");
    fs.writeFileSync(
      path.join(serveDir, "index.sig"),
      signIndex(index, fixture.privateKeyPem),
      "utf-8"
    );

    // Point the (BP_HOME-scoped) user config at the index.
    const { saveUserConfig } = await import("../../src/config/user.js");
    saveUserConfig({ registry_url: `${baseUrl}/index.json` });

    const result = await installRemoteArtifact("acme-remote", {
      projectRoot,
      manifest: await claudeManifest(),
      expectKind: "rules",
    });
    expect(result.trust).toBe("signed:acme");
    expect(result.source).toBe(`registry:${baseUrl}/index.json`);

    // Upstream advertises a newer version → PACK_OUTDATED info finding.
    const newerIndex: RegistryIndex = {
      schema: "bp-index/1",
      packs: [{ ...index.packs[0]!, version: "1.1.0" }],
    };
    const findings = await validatePackIntegrity(projectRoot, { registryIndex: newerIndex });
    const outdated = findings.find((f) => f.type === "PACK_OUTDATED");
    expect(outdated?.severity).toBe("info");
    expect(outdated?.message).toContain("v1.1.0");
  });

  it("rejects an index whose signature does not verify", async () => {
    await publishAndTrust();
    const index: RegistryIndex = { schema: "bp-index/1", packs: [] };
    fs.writeFileSync(path.join(serveDir, "index.json"), canonicalJson(index), "utf-8");
    fs.writeFileSync(path.join(serveDir, "index.sig"), "deadbeef", "utf-8");

    const { fetchRegistryIndex } = await import("../../src/registry/client.js");
    await expect(fetchRegistryIndex(`${baseUrl}/index.json`)).rejects.toThrowError(
      /PACK_SIGNATURE_INVALID/
    );
  });
});

describe("plugin artifacts", () => {
  const PLUGIN_SOURCE = `export default {
  name: "remote-checker",
  version: "1.0.0",
  validators: [
    {
      id: "always-runs",
      level: "semantic",
      check(ctx) {
        for (const file of ctx.files) {
          ctx.error(file.path, 1, "remote plugin ran", "no action needed");
        }
      },
    },
  ],
};
`;

  it("installs a signed plugin artifact and it runs through the plugin loader", async () => {
    const keyFiles = await generateKeyFiles("plugins");
    await addTrustedKey("plugins", fs.readFileSync(keyFiles.publicKeyPath, "utf-8"));
    const pluginFile = path.join(tmpDir, "remote-checker.mjs");
    fs.writeFileSync(pluginFile, PLUGIN_SOURCE, "utf-8");
    const published = await publishArtifact({
      filePath: pluginFile,
      privateKeyPem: fs.readFileSync(keyFiles.privateKeyPath, "utf-8"),
      outDir: serveDir,
      pluginId: "remote-checker",
      pluginVersion: "1.0.0",
      publisher: "plugins@acme.test",
    });

    const result = await installRemoteArtifact(
      `${baseUrl}/${path.basename(published.artifactPath)}`,
      { projectRoot, expectKind: "plugin" }
    );
    expect(result.kind).toBe("plugin");
    expect(result.pluginFiles).toEqual([".bp/plugins/remote-checker/remote-checker.mjs"]);
    expect(
      fs.existsSync(path.join(projectRoot, ".bp/plugins/remote-checker/remote-checker.mjs"))
    ).toBe(true);

    const lock = await loadPackLock(projectRoot);
    const entry = lock.installed.find((e) => e.id === "remote-checker");
    expect(entry?.kind).toBe("plugin");
    expect(entry?.trust).toBe("signed:plugins");

    // `.bp.json` artifact ref resolves to the installed bundle…
    const resolved = await resolvePluginArtifactPath(projectRoot, "remote-checker");
    expect(resolved).toBe(".bp/plugins/remote-checker/remote-checker.mjs");

    // …and the bundle actually executes through the Stage 4 plugin engine.
    const { loadPlugins } = await import("../../src/plugins/loader.js");
    const outcomes = await loadPlugins(
      [{ path: resolved as string, mode: "inline" }],
      {
        blueprint: {
          version: "2.0",
          spatial_anchor: { project_name: "p", surface: "", temporal_anchor: "", conventions: [] },
          personas: [],
          rules: [],
          skills: [],
          hooks: [],
          meta: {
            rule_precedence: [],
            conflict_resolution: "",
            source_backend: "claude",
            target_backend: "claude",
          },
        },
        files: [],
        levels: ["semantic"],
      },
      projectRoot
    );
    expect(outcomes[0]?.kind).toBe("ok");
  });

  it("unsigned plugin artifacts are double-gated behind --allow-unsigned", async () => {
    const built = buildArtifact({
      id: "sketchy",
      version: "0.0.1",
      kind: "plugin",
      files: new Map([["sketchy.mjs", Buffer.from("export default {};\n")]]),
      publisher: "anon",
    });
    const name = "sketchy-0.0.1.bp-pack.tgz";
    fs.writeFileSync(path.join(serveDir, name), built.tarball);

    try {
      await installRemoteArtifact(`${baseUrl}/${name}`, { projectRoot, expectKind: "plugin" });
      expect.unreachable("expected PACK_UNSIGNED");
    } catch (err) {
      expect((err as BpError).code).toBe("PACK_UNSIGNED");
    }
    expect(fs.existsSync(path.join(projectRoot, ".bp/plugins/sketchy"))).toBe(false);

    const result = await installRemoteArtifact(`${baseUrl}/${name}`, {
      projectRoot,
      expectKind: "plugin",
      allowUnsigned: true,
    });
    expect(result.trust).toBe("unsigned-accepted");
  });

  it("kind mismatches are refused", async () => {
    const fixture = await publishAndTrust();
    try {
      await installRemoteArtifact(`${baseUrl}/${fixture.artifactName}`, {
        projectRoot,
        expectKind: "plugin",
      });
      expect.unreachable("expected PACK_WRONG_KIND");
    } catch (err) {
      expect((err as BpError).code).toBe("PACK_WRONG_KIND");
    }
  });
});
