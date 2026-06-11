import { describe, expect, it } from "vitest";
import { canonicalJson } from "../../../src/registry/canonical.js";
import {
  compareSemver,
  findIndexEntry,
  type RegistryIndex,
  signIndex,
  verifyIndex,
} from "../../../src/registry/registry-index.js";
import { generateKeyPair } from "../../../src/registry/signer.js";

const SHA = "a".repeat(64);

function sampleIndex(): RegistryIndex {
  return {
    schema: "bp-index/1",
    packs: [
      { id: "demo", version: "1.0.0", kind: "rules", url: "https://x/demo-1.0.0.bp-pack.tgz", sha256: SHA },
      { id: "demo", version: "1.2.0", kind: "rules", url: "https://x/demo-1.2.0.bp-pack.tgz", sha256: SHA },
      { id: "other", version: "0.1.0", kind: "skills", url: "https://x/other.bp-pack.tgz", sha256: SHA },
    ],
  };
}

describe("registry index", () => {
  it("signs and verifies a bp-index/1 document", () => {
    const keys = generateKeyPair();
    const index = sampleIndex();
    const sig = signIndex(index, keys.privateKey);
    const { index: verified, keyName } = verifyIndex(canonicalJson(index), sig, [
      { name: "reg", publicKeyPem: keys.publicKey },
    ]);
    expect(keyName).toBe("reg");
    expect(verified.packs).toHaveLength(3);
  });

  it("rejects a wrong-key or tampered index", () => {
    const keys = generateKeyPair();
    const wrong = generateKeyPair();
    const index = sampleIndex();
    const sig = signIndex(index, keys.privateKey);

    expect(() =>
      verifyIndex(canonicalJson(index), sig, [{ name: "w", publicKeyPem: wrong.publicKey }])
    ).toThrowError(/PACK_SIGNATURE_INVALID/);

    const tampered = { ...index, packs: index.packs.slice(0, 1) };
    expect(() =>
      verifyIndex(canonicalJson(tampered), sig, [{ name: "k", publicKeyPem: keys.publicKey }])
    ).toThrowError(/PACK_SIGNATURE_INVALID/);
  });

  it("rejects malformed index documents", () => {
    const keys = generateKeyPair();
    expect(() => verifyIndex("not json", "00", [])).toThrowError(/REGISTRY_INDEX_INVALID/);
    expect(() =>
      verifyIndex(JSON.stringify({ schema: "bp-index/2", packs: [] }), "00", [
        { name: "k", publicKeyPem: keys.publicKey },
      ])
    ).toThrowError(/REGISTRY_INDEX_INVALID/);
  });

  it("findIndexEntry returns the highest semver for an id", () => {
    expect(findIndexEntry(sampleIndex(), "demo")?.version).toBe("1.2.0");
    expect(findIndexEntry(sampleIndex(), "nope")).toBeUndefined();
  });

  it("compareSemver orders versions correctly", () => {
    expect(compareSemver("1.2.0", "1.10.0")).toBeLessThan(0);
    expect(compareSemver("2.0.0", "1.9.9")).toBeGreaterThan(0);
    expect(compareSemver("1.0.0", "1.0.0")).toBe(0);
    expect(compareSemver("1.0.0", "1.0.0-rc.1")).toBeGreaterThan(0);
  });
});
