import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BpError } from "../../../src/errors.js";
import { generateKeyPair } from "../../../src/registry/signer.js";
import {
  addTrustedKey,
  gatherTrustedKeys,
  generateKeyFiles,
  loadTrustStore,
  removeTrustedKey,
  trustStorePath,
} from "../../../src/registry/trust.js";

let tmpHome: string;
let prevBpHome: string | undefined;
let prevEnvKey: string | undefined;

beforeEach(() => {
  tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), "bp-trust-test-"));
  prevBpHome = process.env.BP_HOME;
  prevEnvKey = process.env.BP_REGISTRY_PUBLIC_KEY;
  process.env.BP_HOME = tmpHome;
  delete process.env.BP_REGISTRY_PUBLIC_KEY;
});

afterEach(() => {
  if (prevBpHome === undefined) delete process.env.BP_HOME;
  else process.env.BP_HOME = prevBpHome;
  if (prevEnvKey === undefined) delete process.env.BP_REGISTRY_PUBLIC_KEY;
  else process.env.BP_REGISTRY_PUBLIC_KEY = prevEnvKey;
  fs.rmSync(tmpHome, { recursive: true, force: true });
});

describe("trust store CRUD", () => {
  it("starts empty with require_signature=true", async () => {
    const store = await loadTrustStore();
    expect(store.keys).toEqual([]);
    expect(store.policy.require_signature).toBe(true);
  });

  it("adds, lists, and removes keys", async () => {
    const { publicKey } = generateKeyPair();
    await addTrustedKey("acme", publicKey);
    expect(fs.existsSync(trustStorePath())).toBe(true);

    const store = await loadTrustStore();
    expect(store.keys.map((k) => k.name)).toEqual(["acme"]);

    await removeTrustedKey("acme");
    expect((await loadTrustStore()).keys).toEqual([]);
  });

  it("rejects duplicate key names", async () => {
    const { publicKey } = generateKeyPair();
    await addTrustedKey("acme", publicKey);
    await expect(addTrustedKey("acme", publicKey)).rejects.toThrowError(/TRUST_KEY_EXISTS/);
  });

  it("rejects invalid PEM material and invalid names", async () => {
    await expect(addTrustedKey("bad", "not a pem")).rejects.toThrowError(/TRUST_KEY_INVALID/);
    const { publicKey } = generateKeyPair();
    await expect(addTrustedKey("bad name!", publicKey)).rejects.toThrowError(/TRUST_KEY_INVALID/);
  });

  it("removing an unknown key fails loud", async () => {
    await expect(removeTrustedKey("ghost")).rejects.toThrowError(/TRUST_KEY_NOT_FOUND/);
  });

  it("fails loud on a corrupted trust store", async () => {
    fs.mkdirSync(path.dirname(trustStorePath()), { recursive: true });
    fs.writeFileSync(trustStorePath(), "{broken", "utf-8");
    await expect(loadTrustStore()).rejects.toThrowError(/TRUST_STORE_INVALID/);
  });
});

describe("gatherTrustedKeys", () => {
  it("folds in store keys and the legacy env key, but never local signing keys", async () => {
    const { publicKey } = generateKeyPair();
    await addTrustedKey("store-key", publicKey);
    process.env.BP_REGISTRY_PUBLIC_KEY = publicKey;
    // A locally generated signing keypair must NOT become a trust anchor.
    fs.mkdirSync(path.join(tmpHome, "keys"), { recursive: true });
    fs.writeFileSync(path.join(tmpHome, "keys", "local-signer.pub"), publicKey, "utf-8");

    const keys = await gatherTrustedKeys();
    const names = keys.map((k) => k.name);
    expect(names).toContain("store-key");
    expect(names).toContain("env:BP_REGISTRY_PUBLIC_KEY");
    expect(names.some((n) => n.includes("local-signer"))).toBe(false);
  });
});

describe("keygen", () => {
  it("writes the private key with 0600 and refuses overwrite", async () => {
    const result = await generateKeyFiles("ci");
    expect(fs.existsSync(result.privateKeyPath)).toBe(true);
    expect(fs.existsSync(result.publicKeyPath)).toBe(true);

    const mode = fs.statSync(result.privateKeyPath).mode & 0o777;
    expect(mode).toBe(0o600);

    try {
      await generateKeyFiles("ci");
      expect.unreachable("must refuse to overwrite existing keys");
    } catch (err) {
      expect(err).toBeInstanceOf(BpError);
      expect((err as BpError).code).toBe("TRUST_KEY_EXISTS");
    }
  });
});
