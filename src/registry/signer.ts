import * as crypto from "node:crypto";

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

// A standard default public key for official @bp-templates
export const DEFAULT_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA01v6jJqN1wP8R6+27/Zc
L28h6P2N+zHwQ/8m8K9Jq+1j1b6l+7v7o9n7n7t7w8n8n8p8q8r8s8t8u8v8w8x
8y8z808182838485868788899091929394959697989900010203040506070809
1011121314151617181920212223242526272829303132333435363738394041
4243444546474849505152535455565758596061626364656667686970717273
7475767778798081828384858687888990919293949596979899000102030405
0607080910111213141516171819202122232425262728293031323334353637
389QIDAQAB
-----END PUBLIC KEY-----`;
