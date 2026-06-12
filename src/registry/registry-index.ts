/**
 * Static-host registry index (Stage 5 §4): a signed `index.json` any team can
 * serve from a plain file host (S3, GitHub Pages, artifact store). bp points
 * at it via `bp config set registry.url https://host/index.json` and resolves
 * `pack:install <id>` / `pack:search` against it. The detached signature
 * (`index.sig`, served alongside) covers the canonical JSON of the document.
 */

import { z } from "zod";
import { BpError } from "../errors.js";
import { SEMVER_RE } from "../translator/ir.js";
import { ArtifactKindSchema } from "./artifact.js";
import { canonicalJson } from "./canonical.js";
import { signData, verifySignature } from "./signer.js";

export const INDEX_SCHEMA_VERSION = "bp-index/1";

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, "must be a sha256 hex digest");

export const IndexEntrySchema = z.object({
  id: z.string().regex(/^[a-z0-9_-]+$/i),
  version: z.string().regex(SEMVER_RE),
  kind: ArtifactKindSchema,
  url: z.string().min(1),
  sha256: sha256Hex,
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(64)).max(16).optional(),
});

export const RegistryIndexSchema = z.object({
  schema: z.literal(INDEX_SCHEMA_VERSION),
  packs: z.array(IndexEntrySchema).max(5000),
});

export type IndexEntry = z.infer<typeof IndexEntrySchema>;
export type RegistryIndex = z.infer<typeof RegistryIndexSchema>;

export function signIndex(index: RegistryIndex, privateKeyPem: string): string {
  return signData(Buffer.from(canonicalJson(index), "utf-8"), privateKeyPem);
}

/**
 * Parse and authenticate a fetched index document. The signature is
 * mandatory: a registry index directs what bp downloads, so an unsigned or
 * unverifiable index is rejected outright (no `--allow-unsigned` for it).
 */
export function verifyIndex(
  indexJson: string,
  signature: string,
  trustedKeys: Array<{ name: string; publicKeyPem: string }>
): { index: RegistryIndex; keyName: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(indexJson);
  } catch {
    throw new BpError(
      "REGISTRY_INDEX_INVALID: index.json is not valid JSON",
      1,
      "REGISTRY_INDEX_INVALID",
      "Check the registry.url config points at a bp-index/1 document"
    );
  }
  const parsed = RegistryIndexSchema.safeParse(raw);
  if (!parsed.success) {
    throw new BpError(
      "REGISTRY_INDEX_INVALID: index.json does not conform to bp-index/1",
      1,
      "REGISTRY_INDEX_INVALID",
      "Regenerate the index with 'bp pack publish' index entries"
    );
  }

  const canonical = Buffer.from(canonicalJson(parsed.data), "utf-8");
  for (const key of trustedKeys) {
    if (verifySignature(canonical, signature.trim(), key.publicKeyPem)) {
      return { index: parsed.data, keyName: key.name };
    }
  }
  throw new BpError(
    "PACK_SIGNATURE_INVALID: registry index signature does not verify against any trusted key",
    1,
    "PACK_SIGNATURE_INVALID",
    "Add the registry publisher's key with 'bp trust add', or stop using this registry"
  );
}

/** Latest index entry for an id (highest semver wins). */
export function findIndexEntry(index: RegistryIndex, id: string): IndexEntry | undefined {
  const candidates = index.packs.filter((p) => p.id === id);
  if (candidates.length === 0) return undefined;
  return candidates.sort((a, b) => compareSemver(a.version, b.version))[candidates.length - 1];
}

/** Numeric-aware semver comparison (prerelease tags compared lexically). */
export function compareSemver(a: string, b: string): number {
  const parse = (v: string) => {
    const [core = "", pre = ""] = v.split("-", 2);
    const nums = core.split(".").map((n) => Number.parseInt(n, 10) || 0);
    return { nums, pre };
  };
  const pa = parse(a);
  const pb = parse(b);
  for (let i = 0; i < 3; i++) {
    const diff = (pa.nums[i] ?? 0) - (pb.nums[i] ?? 0);
    if (diff !== 0) return diff;
  }
  if (pa.pre === pb.pre) return 0;
  if (pa.pre === "") return 1; // release > prerelease
  if (pb.pre === "") return -1;
  return pa.pre < pb.pre ? -1 : 1;
}
