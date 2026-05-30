import * as crypto from "node:crypto";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";

export function generateKeyPair(): { publicKey: string; privateKey: string } {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: {
      type: "spki",
      format: "pem",
    },
    privateKeyEncoding: {
      type: "pkcs8",
      format: "pem",
    },
  });
  return { publicKey, privateKey };
}

export function signData(data: Buffer, privateKey: string): string {
  const sign = crypto.createSign("SHA256");
  sign.update(data);
  sign.end();
  return sign.sign(privateKey, "hex");
}

export function verifySignature(data: Buffer, signature: string, publicKey: string): boolean {
  try {
    const verify = crypto.createVerify("SHA256");
    verify.update(data);
    verify.end();
    return verify.verify(publicKey, signature, "hex");
  } catch {
    return false;
  }
}

export async function loadPublicKey(): Promise<string | null> {
  const envKey = process.env.BP_REGISTRY_PUBLIC_KEY;
  if (envKey) return envKey;

  const keyringDir = path.join(os.homedir(), ".bp", "keys");
  try {
    const files = await fsPromises.readdir(keyringDir);
    const keyFile = files.find((f) => f.endsWith(".pub") || f.endsWith(".pem"));
    if (keyFile)
      return (await fsPromises.readFile(path.join(keyringDir, keyFile), "utf-8")).trim();
  } catch {
    // keyring dir absent or unreadable
  }
  return null;
}
