import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RegistryClient } from "../../../src/registry/client.js";
import {
  generateKeyPair,
  loadPublicKey,
  signData,
  verifySignature,
} from "../../../src/registry/signer.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-registry-test-"));
}

function cleanDir(dir: string): void {
  fs.rmSync(dir, { recursive: true, force: true });
}

describe("Registry Signer & Client", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
    RegistryClient.clearMockPackages();
  });

  afterEach(() => {
    cleanDir(tmpDir);
    RegistryClient.clearMockPackages();
  });

  describe("Signer Utilities", () => {
    it("can sign data and verify signature with generated RSA keys", () => {
      const keys = generateKeyPair();
      const data = Buffer.from("hello signature world");
      
      const sig = signData(data, keys.privateKey);
      const verified = verifySignature(data, sig, keys.publicKey);
      
      expect(verified).toBe(true);
      
      // Negative test
      const badVerified = verifySignature(Buffer.from("bad data"), sig, keys.publicKey);
      expect(badVerified).toBe(false);
    });

    it("loadPublicKey returns the env-configured key when present", async () => {
      const prev = process.env.BP_REGISTRY_PUBLIC_KEY;
      process.env.BP_REGISTRY_PUBLIC_KEY = "-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----";
      try {
        const key = await loadPublicKey();
        expect(key).toContain("BEGIN PUBLIC KEY");
      } finally {
        if (prev === undefined) delete process.env.BP_REGISTRY_PUBLIC_KEY;
        else process.env.BP_REGISTRY_PUBLIC_KEY = prev;
      }
    });
  });

  describe("RegistryClient list, install, publish", () => {
    it("can publish and install signed package in mock mode", async () => {
      const client = new RegistryClient("https://registry.mock");
      const keys = generateKeyPair();
      
      // Create a dummy template pack directory
      const packDir = path.join(tmpDir, "my-pack");
      fs.mkdirSync(packDir, { recursive: true });
      fs.writeFileSync(path.join(packDir, "manifest.json"), JSON.stringify({ backend: "claude" }), "utf-8");
      fs.writeFileSync(path.join(packDir, "README.md"), "my custom template pack", "utf-8");

      // Publish
      await client.publish("@bp-templates/custom-pack", "1.2.3", packDir, keys.privateKey);

      // List
      const list = await client.list();
      expect(list.length).toBeGreaterThan(0);
      expect(list[0]?.name).toBe("@bp-templates/custom-pack");
      expect(list[0]?.version).toBe("1.2.3");

      // Install with signature verification
      const installTarget = path.join(tmpDir, "installed-target");
      await client.install("@bp-templates/custom-pack", installTarget, keys.publicKey);

      expect(fs.existsSync(path.join(installTarget, "manifest.json"))).toBe(true);
      expect(fs.readFileSync(path.join(installTarget, "README.md"), "utf-8")).toBe("my custom template pack");
    });

    it("listBundledPacks returns only real on-disk template packs", async () => {
      const packs = await RegistryClient.listBundledPacks();
      const names = packs.map((p) => p.name);
      // The repo ships these backend template packs on disk.
      expect(names).toContain("claude");
      expect(names).toContain("generic");
      // Internal/base directories must never be surfaced as installable packs.
      expect(names).not.toContain("_base");
      expect(names.some((n) => n.startsWith("_") || n.startsWith("."))).toBe(false);
      // Every reported pack must carry a description and version.
      for (const p of packs) {
        expect(p.version).toBeTruthy();
        expect(p.description).toContain(p.name);
      }
    });

    it("list() falls back to bundled packs when no adapter or mock packages exist", async () => {
      const client = new RegistryClient("https://registry.mock");
      RegistryClient.clearMockPackages();
      const list = await client.list();
      // No fictional packages — only real bundled packs are returned.
      expect(list.length).toBeGreaterThan(0);
      expect(list.map((p) => p.name)).toContain("claude");
      expect(list.map((p) => p.name)).not.toContain("@bp-templates/fastapi");
    });

    it("throws error if signature is invalid during install", async () => {
      const client = new RegistryClient("https://registry.mock");
      const keys = generateKeyPair();
      const anotherKeys = generateKeyPair();
      
      const packDir = path.join(tmpDir, "my-pack");
      fs.mkdirSync(packDir, { recursive: true });
      fs.writeFileSync(path.join(packDir, "manifest.json"), JSON.stringify({ backend: "claude" }), "utf-8");

      // Publish signed with keys.privateKey
      await client.publish("@bp-templates/custom-pack", "1.2.3", packDir, keys.privateKey);

      const installTarget = path.join(tmpDir, "installed-target");
      
      // Install verifying with anotherKeys.publicKey (should fail)
      await expect(
        client.install("@bp-templates/custom-pack", installTarget, anotherKeys.publicKey)
      ).rejects.toThrow("Signature verification failed");
    });
  });
});
