import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RegistryClient } from "../../../src/registry/client.js";
import { generateKeyPair, verifySignature, signData } from "../../../src/registry/signer.js";

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
