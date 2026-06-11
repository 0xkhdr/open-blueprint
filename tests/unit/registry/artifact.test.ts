import { describe, expect, it } from "vitest";
import { BpError } from "../../../src/errors.js";
import {
  artifactFileName,
  buildArtifact,
  readArtifact,
  sha256Of,
  verifyArtifact,
} from "../../../src/registry/artifact.js";
import { generateKeyPair } from "../../../src/registry/signer.js";
import { createTarGz } from "../../../src/registry/tar.js";

const PACK_YAML = Buffer.from("schema: bp-pack/1\nid: demo\n");

function build(privateKeyPem?: string) {
  const options: Parameters<typeof buildArtifact>[0] = {
    id: "demo",
    version: "1.2.3",
    kind: "rules",
    files: new Map([["pack.yaml", PACK_YAML]]),
    publisher: "tests@example.com",
  };
  if (privateKeyPem !== undefined) options.privateKeyPem = privateKeyPem;
  return buildArtifact(options);
}

function expectCode(fn: () => unknown, code: string): void {
  try {
    fn();
    expect.unreachable(`expected ${code}`);
  } catch (err) {
    expect(err).toBeInstanceOf(BpError);
    expect((err as BpError).code).toBe(code);
  }
}

describe("artifact build/read/verify", () => {
  it("round-trips a signed artifact and verifies against the right key", () => {
    const keys = generateKeyPair();
    const built = build(keys.privateKey);

    expect(artifactFileName("demo", "1.2.3")).toBe("demo-1.2.3.bp-pack.tgz");
    expect(built.artifactSha256).toBe(sha256Of(built.tarball));

    const artifact = readArtifact(built.tarball);
    expect(artifact.manifest.id).toBe("demo");
    expect(artifact.manifest.kind).toBe("rules");
    expect(artifact.manifest.publisher).toBe("tests@example.com");
    expect(artifact.files.get("pack.yaml")?.equals(PACK_YAML)).toBe(true);

    const decision = verifyArtifact(artifact, [
      { name: "acme", publicKeyPem: keys.publicKey },
    ]);
    expect(decision).toEqual({ status: "signed", keyName: "acme" });
  });

  it("verifies against any key in a multi-key keyring", () => {
    const signer = generateKeyPair();
    const other = generateKeyPair();
    const artifact = readArtifact(build(signer.privateKey).tarball);
    const decision = verifyArtifact(artifact, [
      { name: "other", publicKeyPem: other.publicKey },
      { name: "signer", publicKeyPem: signer.publicKey },
    ]);
    expect(decision).toEqual({ status: "signed", keyName: "signer" });
  });

  it("returns unsigned for artifacts built without a key", () => {
    const artifact = readArtifact(build().tarball);
    expect(artifact.signature).toBeUndefined();
    expect(verifyArtifact(artifact, [])).toEqual({ status: "unsigned" });
  });

  it("rejects a wrong key with PACK_SIGNATURE_INVALID", () => {
    const signer = generateKeyPair();
    const wrong = generateKeyPair();
    const artifact = readArtifact(build(signer.privateKey).tarball);
    expectCode(
      () => verifyArtifact(artifact, [{ name: "wrong", publicKeyPem: wrong.publicKey }]),
      "PACK_SIGNATURE_INVALID"
    );
  });

  it("rejects a signed artifact when no keys are trusted", () => {
    const signer = generateKeyPair();
    const artifact = readArtifact(build(signer.privateKey).tarball);
    expectCode(() => verifyArtifact(artifact, []), "PACK_SIGNATURE_INVALID");
  });

  it("rejects tampered payload content with PACK_HASH_MISMATCH", () => {
    const keys = generateKeyPair();
    const built = build(keys.privateKey);
    const artifact = readArtifact(built.tarball);

    // Rebuild the tarball with one byte of payload changed but the original
    // manifest/signature kept — the per-file hash check must catch it.
    const tampered = Buffer.from(PACK_YAML);
    tampered[0] = (tampered[0] ?? 0) ^ 0xff;
    const entries = [
      { path: "pack.yaml", data: tampered },
      { path: "MANIFEST.json", data: Buffer.from(JSON.stringify(artifact.manifest)) },
      { path: "MANIFEST.sig", data: Buffer.from(artifact.signature ?? "", "utf-8") },
    ];
    const evil = readArtifact(createTarGz(entries));
    expectCode(
      () => verifyArtifact(evil, [{ name: "k", publicKeyPem: keys.publicKey }]),
      "PACK_HASH_MISMATCH"
    );
  });

  it("rejects smuggled extra files and missing manifest files", () => {
    const keys = generateKeyPair();
    const artifact = readArtifact(build(keys.privateKey).tarball);

    const smuggled = {
      ...artifact,
      files: new Map([...artifact.files, ["extra.sh", Buffer.from("rm -rf /")]]),
    };
    expectCode(
      () => verifyArtifact(smuggled, [{ name: "k", publicKeyPem: keys.publicKey }]),
      "PACK_HASH_MISMATCH"
    );

    const missing = { ...artifact, files: new Map<string, Buffer>() };
    expectCode(
      () => verifyArtifact(missing, [{ name: "k", publicKeyPem: keys.publicKey }]),
      "PACK_HASH_MISMATCH"
    );
  });

  it("a modified manifest invalidates the signature", () => {
    const keys = generateKeyPair();
    const artifact = readArtifact(build(keys.privateKey).tarball);
    const tamperedPayload = Buffer.from("schema: bp-pack/1\nid: evil\n");
    const forged = {
      ...artifact,
      manifest: {
        ...artifact.manifest,
        files: [{ path: "pack.yaml", sha256: sha256Of(tamperedPayload) }],
      },
      files: new Map([["pack.yaml", tamperedPayload]]),
    };
    expectCode(
      () => verifyArtifact(forged, [{ name: "k", publicKeyPem: keys.publicKey }]),
      "PACK_SIGNATURE_INVALID"
    );
  });

  it("rejects archives missing MANIFEST.json", () => {
    const archive = createTarGz([{ path: "pack.yaml", data: PACK_YAML }]);
    expectCode(() => readArtifact(archive), "PACK_HASH_MISMATCH");
  });

  it("refuses payload paths that shadow manifest files", () => {
    expect(() =>
      buildArtifact({
        id: "demo",
        version: "1.0.0",
        kind: "rules",
        files: new Map([["MANIFEST.json", Buffer.from("{}")]]),
        publisher: "tests",
      })
    ).toThrowError(/PACK_INVALID/);
  });
});
