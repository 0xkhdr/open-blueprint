/**
 * Artifact publishing (Stage 5 §3): validate a pack (or plugin bundle), build
 * the signed `bp-artifact/1` tarball, and emit a detached `index-entry.json`
 * snippet ready to splice into a static-host registry index.
 */

import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { BpError } from "../errors.js";
import { loadPackFromFile } from "../packs/store.js";
import {
  artifactFileName,
  type BuiltArtifact,
  buildArtifact,
  PACK_DOCUMENT_FILE,
} from "./artifact.js";
import type { IndexEntry } from "./registry-index.js";

export interface PublishOptions {
  /** Pack file (`*.bp-pack.{yaml,yml,json}`) or plugin bundle (`*.mjs`). */
  filePath: string;
  privateKeyPem: string;
  outDir: string;
  /** Plugin publishes have no pack document; id/version come from options. */
  pluginId?: string;
  pluginVersion?: string;
  /** Defaults to the pack's `author` field (plugins: required). */
  publisher?: string;
}

export interface PublishResult {
  artifactPath: string;
  indexEntryPath: string;
  built: BuiltArtifact;
  indexEntry: IndexEntry;
}

async function buildFromPackFile(options: PublishOptions): Promise<BuiltArtifact> {
  // Full Stage 2/3 validation before anything is signed: bp never signs a
  // pack it would refuse to install.
  const { pack, path: absolute } = await loadPackFromFile(options.filePath);
  const raw = await fsPromises.readFile(absolute ?? options.filePath);
  return buildArtifact({
    id: pack.id,
    version: pack.version,
    kind: pack.kind,
    files: new Map([[PACK_DOCUMENT_FILE, raw]]),
    publisher: options.publisher ?? pack.author,
    privateKeyPem: options.privateKeyPem,
  });
}

async function buildFromPluginBundle(options: PublishOptions): Promise<BuiltArtifact> {
  const { pluginId, pluginVersion, publisher } = options;
  if (!pluginId || !pluginVersion || !publisher) {
    throw new BpError(
      "PACK_INVALID: plugin publishes require --id, --version, and --publisher",
      1,
      "PACK_INVALID",
      "Example: bp pack publish plugin.mjs --key key.pem --id my-plugin --version 1.0.0 --publisher me@example.com"
    );
  }
  let raw: Buffer;
  try {
    raw = await fsPromises.readFile(options.filePath);
  } catch {
    throw new BpError(
      `PACK_NOT_FOUND: cannot read plugin bundle: ${options.filePath}`,
      1,
      "PACK_NOT_FOUND",
      "Check the path to the .mjs plugin bundle"
    );
  }
  return buildArtifact({
    id: pluginId,
    version: pluginVersion,
    kind: "plugin",
    files: new Map([[path.basename(options.filePath), raw]]),
    publisher,
    privateKeyPem: options.privateKeyPem,
  });
}

/** Build, sign, and write `<id>-<version>.bp-pack.tgz` + index-entry.json. */
export async function publishArtifact(options: PublishOptions): Promise<PublishResult> {
  const isPlugin = options.filePath.endsWith(".mjs");
  const built = isPlugin ? await buildFromPluginBundle(options) : await buildFromPackFile(options);

  await fsPromises.mkdir(options.outDir, { recursive: true });
  const fileName = artifactFileName(built.manifest.id, built.manifest.version);
  const artifactPath = path.join(options.outDir, fileName);
  await fsPromises.writeFile(artifactPath, built.tarball);

  const indexEntry: IndexEntry = {
    id: built.manifest.id,
    version: built.manifest.version,
    kind: built.manifest.kind,
    // The publisher fills the final hosting URL in; the file name is the
    // stable part of the convention.
    url: fileName,
    sha256: built.artifactSha256,
  };
  const indexEntryPath = path.join(
    options.outDir,
    `${built.manifest.id}-${built.manifest.version}.index-entry.json`
  );
  await fsPromises.writeFile(indexEntryPath, `${JSON.stringify(indexEntry, null, 2)}\n`, "utf-8");

  return { artifactPath, indexEntryPath, built, indexEntry };
}
