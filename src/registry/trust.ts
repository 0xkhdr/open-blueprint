/**
 * Local trust policy for signed pack distribution (Stage 5 §2).
 *
 * `~/.bp/trust.json` (override the base dir with `BP_HOME` — used by tests)
 * holds a named multi-key keyring plus the signature policy. The legacy
 * single-key sources (`BP_REGISTRY_PUBLIC_KEY` env var, `~/.bp/keys/*.pub`)
 * fold into the same keyring via `gatherTrustedKeys()`, so anything that
 * verified before Stage 5 still verifies.
 */

import * as crypto from "node:crypto";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { z } from "zod";
import { BpError } from "../errors.js";
import { generateKeyPair } from "./signer.js";

export const TRUST_SCHEMA_VERSION = "bp-trust/1";

export const TrustedKeySchema = z.object({
  name: z.string().regex(/^[a-z0-9_.-]+$/i, "key name must be [a-z0-9_.-]"),
  publicKeyPem: z.string().min(1),
  added_at: z.string(),
});

export const TrustStoreSchema = z.object({
  schema: z.literal(TRUST_SCHEMA_VERSION),
  keys: z.array(TrustedKeySchema).default([]),
  policy: z
    .object({ require_signature: z.boolean().default(true) })
    .default({ require_signature: true }),
});

export type TrustedKey = z.infer<typeof TrustedKeySchema>;
export type TrustStore = z.infer<typeof TrustStoreSchema>;

/** Base bp home directory; `BP_HOME` overrides for tests and sandboxes. */
export function bpHome(): string {
  return process.env.BP_HOME ?? path.join(os.homedir(), ".bp");
}

export function trustStorePath(): string {
  return path.join(bpHome(), "trust.json");
}

export function keysDir(): string {
  return path.join(bpHome(), "keys");
}

export function createEmptyTrustStore(): TrustStore {
  return { schema: TRUST_SCHEMA_VERSION, keys: [], policy: { require_signature: true } };
}

export async function loadTrustStore(): Promise<TrustStore> {
  let raw: string;
  try {
    raw = await fsPromises.readFile(trustStorePath(), "utf-8");
  } catch {
    return createEmptyTrustStore();
  }
  try {
    return TrustStoreSchema.parse(JSON.parse(raw));
  } catch (err) {
    throw new BpError(
      `TRUST_STORE_INVALID: ${trustStorePath()} is corrupted: ${err instanceof Error ? err.message : String(err)}`,
      1,
      "TRUST_STORE_INVALID",
      "Fix or delete the trust store file and re-add your keys with 'bp trust add'"
    );
  }
}

export async function saveTrustStore(store: TrustStore): Promise<void> {
  const target = trustStorePath();
  await fsPromises.mkdir(path.dirname(target), { recursive: true });
  await fsPromises.writeFile(target, `${JSON.stringify(store, null, 2)}\n`, "utf-8");
}

/** Throws when the PEM is not a usable public key. */
export function assertValidPublicKeyPem(pem: string): void {
  try {
    crypto.createPublicKey(pem);
  } catch {
    throw new BpError(
      "TRUST_KEY_INVALID: the provided file is not a valid PEM public key",
      1,
      "TRUST_KEY_INVALID",
      "Pass a PEM-encoded public key (e.g. the .pub file written by 'bp pack keygen')"
    );
  }
}

export async function addTrustedKey(name: string, publicKeyPem: string): Promise<TrustStore> {
  const parsedName = TrustedKeySchema.shape.name.safeParse(name);
  if (!parsedName.success) {
    throw new BpError(
      `TRUST_KEY_INVALID: invalid key name '${name}' (allowed: [a-z0-9_.-])`,
      1,
      "TRUST_KEY_INVALID",
      "Choose a short alphanumeric name for the key"
    );
  }
  assertValidPublicKeyPem(publicKeyPem);

  const store = await loadTrustStore();
  if (store.keys.some((k) => k.name === name)) {
    throw new BpError(
      `TRUST_KEY_EXISTS: a trusted key named '${name}' already exists`,
      1,
      "TRUST_KEY_EXISTS",
      "Remove it first with 'bp trust remove' or pick another name"
    );
  }
  store.keys.push({ name, publicKeyPem: publicKeyPem.trim(), added_at: new Date().toISOString() });
  await saveTrustStore(store);
  return store;
}

export async function removeTrustedKey(name: string): Promise<TrustStore> {
  const store = await loadTrustStore();
  if (!store.keys.some((k) => k.name === name)) {
    throw new BpError(
      `TRUST_KEY_NOT_FOUND: no trusted key named '${name}'`,
      1,
      "TRUST_KEY_NOT_FOUND",
      "Run 'bp trust list' to see the configured keys"
    );
  }
  store.keys = store.keys.filter((k) => k.name !== name);
  await saveTrustStore(store);
  return store;
}

/**
 * All keys an artifact signature may verify against: the trust store keyring
 * plus the legacy `BP_REGISTRY_PUBLIC_KEY` env source, folded in so anything
 * that verified before Stage 5 still verifies. Local signing keys under
 * `~/.bp/keys/` are deliberately NOT auto-trusted — trust anchors are only
 * what was explicitly added via `bp trust add`.
 */
export async function gatherTrustedKeys(): Promise<Array<{ name: string; publicKeyPem: string }>> {
  const store = await loadTrustStore();
  const keys = store.keys.map((k) => ({ name: k.name, publicKeyPem: k.publicKeyPem }));

  const envKey = process.env.BP_REGISTRY_PUBLIC_KEY;
  if (envKey) keys.push({ name: "env:BP_REGISTRY_PUBLIC_KEY", publicKeyPem: envKey });

  return keys;
}

export interface KeygenResult {
  privateKeyPath: string;
  publicKeyPath: string;
}

/**
 * Generate an RSA keypair under `~/.bp/keys/<name>.pem` (private, 0600) and
 * `<name>.pub` (public). Refuses to overwrite existing key files.
 */
export async function generateKeyFiles(name: string): Promise<KeygenResult> {
  const parsedName = TrustedKeySchema.shape.name.safeParse(name);
  if (!parsedName.success) {
    throw new BpError(
      `TRUST_KEY_INVALID: invalid key name '${name}' (allowed: [a-z0-9_.-])`,
      1,
      "TRUST_KEY_INVALID",
      "Choose a short alphanumeric name for the key"
    );
  }
  const dir = keysDir();
  await fsPromises.mkdir(dir, { recursive: true });
  const privateKeyPath = path.join(dir, `${name}.pem`);
  const publicKeyPath = path.join(dir, `${name}.pub`);

  for (const file of [privateKeyPath, publicKeyPath]) {
    try {
      await fsPromises.access(file);
      throw new BpError(
        `TRUST_KEY_EXISTS: refusing to overwrite existing key file: ${file}`,
        1,
        "TRUST_KEY_EXISTS",
        "Move the existing key aside or choose a different key name"
      );
    } catch (err) {
      if (err instanceof BpError) throw err;
      // ENOENT: free to write
    }
  }

  const { publicKey, privateKey } = generateKeyPair();
  await fsPromises.writeFile(privateKeyPath, privateKey, { encoding: "utf-8", mode: 0o600 });
  await fsPromises.writeFile(publicKeyPath, publicKey, { encoding: "utf-8", mode: 0o644 });
  return { privateKeyPath, publicKeyPath };
}
