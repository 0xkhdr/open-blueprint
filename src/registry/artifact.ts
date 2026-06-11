/**
 * Signed pack artifacts (Stage 5 §1): `<id>-<version>.bp-pack.tgz` containing
 * the payload files plus:
 *
 *   MANIFEST.json   { schema:"bp-artifact/1", id, version, kind,
 *                     files:[{path,sha256}], created_at, publisher }
 *   MANIFEST.sig    RSA-SHA256 hex over canonical-JSON MANIFEST.json
 *
 * Rule/skill pack artifacts carry `pack.yaml`; plugin artifacts carry the
 * `.mjs` bundle. Building always hashes every file; verification re-hashes
 * every file against the manifest and checks the signature against the
 * caller's trusted keyring.
 */

import * as crypto from "node:crypto";
import { z } from "zod";
import { BpError } from "../errors.js";
import { SEMVER_RE } from "../translator/ir.js";
import { canonicalJson } from "./canonical.js";
import { signData, verifySignature } from "./signer.js";
import { createTarGz, extractTarGz, isSafeArchivePath, type TarEntry } from "./tar.js";

export const ARTIFACT_SCHEMA_VERSION = "bp-artifact/1";
export const MANIFEST_FILE = "MANIFEST.json";
export const SIGNATURE_FILE = "MANIFEST.sig";
export const PACK_DOCUMENT_FILE = "pack.yaml";

const sha256Hex = z.string().regex(/^[a-f0-9]{64}$/, "must be a sha256 hex digest");

export const ArtifactKindSchema = z.enum(["rules", "skills", "plugin"]);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

export const ArtifactManifestSchema = z.object({
  schema: z.literal(ARTIFACT_SCHEMA_VERSION),
  id: z.string().regex(/^[a-z0-9_-]+$/i, "id must be [a-z0-9_-]"),
  version: z.string().regex(SEMVER_RE, "version must be valid semver"),
  kind: ArtifactKindSchema,
  files: z
    .array(z.object({ path: z.string().min(1), sha256: sha256Hex }))
    .min(1)
    .max(500),
  created_at: z.string(),
  publisher: z.string().min(1).max(200),
});

export type ArtifactManifest = z.infer<typeof ArtifactManifestSchema>;

export interface Artifact {
  manifest: ArtifactManifest;
  /** Hex RSA-SHA256 signature over canonical-JSON manifest; absent = unsigned. */
  signature?: string;
  /** Payload files (manifest/signature excluded), keyed by archive path. */
  files: Map<string, Buffer>;
}

export type TrustDecision = { status: "signed"; keyName: string } | { status: "unsigned" };

export function sha256Of(data: Buffer): string {
  return crypto.createHash("sha256").update(data).digest("hex");
}

export function artifactFileName(id: string, version: string): string {
  return `${id}-${version}.bp-pack.tgz`;
}

function signatureInvalid(detail: string): BpError {
  return new BpError(
    `PACK_SIGNATURE_INVALID: ${detail}`,
    1,
    "PACK_SIGNATURE_INVALID",
    "Verify you trust the publisher's key ('bp trust list'); do not install artifacts whose signature fails"
  );
}

function hashMismatch(detail: string): BpError {
  return new BpError(
    `PACK_HASH_MISMATCH: ${detail}`,
    1,
    "PACK_HASH_MISMATCH",
    "The artifact content does not match its signed manifest; re-download from a trusted source"
  );
}

export interface BuildArtifactOptions {
  id: string;
  version: string;
  kind: ArtifactKind;
  /** Payload files keyed by archive-relative POSIX path. */
  files: Map<string, Buffer>;
  publisher: string;
  /** PEM private key; omit to build an unsigned artifact (test/dev only). */
  privateKeyPem?: string;
  createdAt?: string;
}

export interface BuiltArtifact {
  tarball: Buffer;
  manifest: ArtifactManifest;
  signature?: string;
  /** sha256 of the tarball bytes — the lockfile/index pin. */
  artifactSha256: string;
}

/** Build (and optionally sign) a `bp-artifact/1` tarball from payload files. */
export function buildArtifact(options: BuildArtifactOptions): BuiltArtifact {
  const { id, version, kind, files, publisher, privateKeyPem } = options;
  if (files.size === 0) {
    throw new BpError(
      "PACK_INVALID: artifact must contain at least one payload file",
      1,
      "PACK_INVALID",
      "Provide the pack document or plugin bundle to publish"
    );
  }
  for (const filePath of files.keys()) {
    if (!isSafeArchivePath(filePath) || filePath === MANIFEST_FILE || filePath === SIGNATURE_FILE) {
      throw new BpError(
        `PACK_INVALID: invalid artifact payload path: ${filePath}`,
        1,
        "PACK_INVALID",
        "Payload paths must be safe relative paths and may not shadow MANIFEST files"
      );
    }
  }

  const manifest = ArtifactManifestSchema.parse({
    schema: ARTIFACT_SCHEMA_VERSION,
    id,
    version,
    kind,
    files: [...files.entries()]
      .map(([p, data]) => ({ path: p, sha256: sha256Of(data) }))
      .sort((a, b) => a.path.localeCompare(b.path)),
    created_at: options.createdAt ?? new Date().toISOString(),
    publisher,
  });

  const entries: TarEntry[] = [...files.entries()].map(([p, data]) => ({ path: p, data }));
  entries.push({ path: MANIFEST_FILE, data: Buffer.from(canonicalJson(manifest), "utf-8") });

  let signature: string | undefined;
  if (privateKeyPem) {
    signature = signData(Buffer.from(canonicalJson(manifest), "utf-8"), privateKeyPem);
    entries.push({ path: SIGNATURE_FILE, data: Buffer.from(signature, "utf-8") });
  }

  const tarball = createTarGz(entries);
  const built: BuiltArtifact = { tarball, manifest, artifactSha256: sha256Of(tarball) };
  if (signature !== undefined) built.signature = signature;
  return built;
}

/** Parse an artifact tarball: extract (guarded), validate manifest schema. */
export function readArtifact(tarball: Buffer): Artifact {
  const entries = extractTarGz(tarball);

  const manifestEntry = entries.find((e) => e.path === MANIFEST_FILE);
  if (!manifestEntry) throw hashMismatch("artifact is missing MANIFEST.json");

  let manifestRaw: unknown;
  try {
    manifestRaw = JSON.parse(manifestEntry.data.toString("utf-8"));
  } catch {
    throw hashMismatch("MANIFEST.json is not valid JSON");
  }
  const parsed = ArtifactManifestSchema.safeParse(manifestRaw);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("; ");
    throw hashMismatch(`MANIFEST.json does not conform to bp-artifact/1 (${issues})`);
  }

  const signatureEntry = entries.find((e) => e.path === SIGNATURE_FILE);
  const files = new Map<string, Buffer>();
  for (const entry of entries) {
    if (entry.path === MANIFEST_FILE || entry.path === SIGNATURE_FILE) continue;
    files.set(entry.path, entry.data);
  }

  const artifact: Artifact = { manifest: parsed.data, files };
  if (signatureEntry) artifact.signature = signatureEntry.data.toString("utf-8").trim();
  return artifact;
}

/**
 * Verify artifact integrity and authenticity:
 *
 *  1. Every manifest file entry must exist with a matching sha256, and no
 *     extra payload files may be present ⇒ `PACK_HASH_MISMATCH` otherwise.
 *  2. When a signature is present, it must verify against at least one
 *     trusted key ⇒ `PACK_SIGNATURE_INVALID` otherwise. A present-but-bad
 *     signature is never bypassable (it is tamper evidence); only a fully
 *     unsigned artifact may proceed via `--allow-unsigned`.
 */
export function verifyArtifact(
  artifact: Artifact,
  trustedKeys: Array<{ name: string; publicKeyPem: string }>
): TrustDecision {
  const { manifest, signature, files } = artifact;

  const manifestPaths = new Set(manifest.files.map((f) => f.path));
  for (const filePath of files.keys()) {
    if (!manifestPaths.has(filePath)) {
      throw hashMismatch(`file '${filePath}' is present in the archive but not in the manifest`);
    }
  }
  for (const entry of manifest.files) {
    const data = files.get(entry.path);
    if (!data) throw hashMismatch(`file '${entry.path}' listed in the manifest is missing`);
    if (sha256Of(data) !== entry.sha256) {
      throw hashMismatch(`file '${entry.path}' does not match its manifest sha256`);
    }
  }

  if (signature === undefined) return { status: "unsigned" };

  const manifestBytes = Buffer.from(canonicalJson(manifest), "utf-8");
  for (const key of trustedKeys) {
    if (verifySignature(manifestBytes, signature, key.publicKeyPem)) {
      return { status: "signed", keyName: key.name };
    }
  }
  throw signatureInvalid(
    trustedKeys.length === 0
      ? "artifact is signed but no trusted keys are configured ('bp trust add')"
      : "artifact signature does not verify against any trusted key"
  );
}
