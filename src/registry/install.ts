/**
 * Remote artifact install pipeline (Stage 5 §4–§6):
 *
 *   fetch → whole-tarball hash pin → guarded extraction → signature + per-file
 *   hash verification → full Stage 2/3 pack validation → materialization.
 *
 * Distribution never bypasses validation: a correctly signed artifact whose
 * pack document fails the bp-pack schema still aborts. Verification failures
 * abort before anything is written into the project, so a failed install
 * leaves no partial files.
 */

import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { BpError } from "../errors.js";
import {
  type DistributionInfo,
  governedContentHash,
  installPackToProject,
  loadPackLock,
  type MaterializeResult,
  savePackLock,
} from "../packs/materialize.js";
import type { PackLockEntry } from "../packs/schema.js";
import { loadPackFromFile } from "../packs/store.js";
import type { BackendManifest } from "../templater/selector.js";
import {
  type Artifact,
  type ArtifactKind,
  PACK_DOCUMENT_FILE,
  readArtifact,
  sha256Of,
  verifyArtifact,
} from "./artifact.js";
import {
  type ArtifactSource,
  fetchRegistryIndex,
  fetchRemote,
  findIndexEntry,
  resolveArtifactSource,
} from "./client.js";
import { gatherTrustedKeys, loadTrustStore } from "./trust.js";

/** Project-relative directory where plugin artifacts materialize. */
export const PROJECT_PLUGINS_DIR = ".bp/plugins";

export interface RemoteInstallOptions {
  projectRoot: string;
  /** Backend manifest; required for rules/skills artifacts. */
  manifest?: BackendManifest;
  /** Accept an unsigned artifact (records `trust: "unsigned-accepted"`). */
  allowUnsigned?: boolean;
  force?: boolean;
  dryRun?: boolean;
  /** Refuse artifacts of any other kind (e.g. rule vs skill install paths). */
  expectKind?: ArtifactKind;
  /** Pin: abort with PACK_HASH_MISMATCH when the tarball hash differs. */
  expectedSha256?: string;
}

export interface RemoteInstallResult {
  id: string;
  version: string;
  kind: ArtifactKind;
  source: string;
  artifactSha256: string;
  /** `signed:<keyname>` or `unsigned-accepted`. */
  trust: string;
  unsignedAccepted: boolean;
  publisher: string;
  /** Pack materialization details (rules/skills artifacts). */
  materialize?: MaterializeResult;
  /** Project-relative plugin files written (plugin artifacts). */
  pluginFiles?: string[];
}

interface FetchedArtifact {
  bytes: Buffer;
  /** Source string recorded in the lockfile. */
  sourceRef: string;
  expectedSha256?: string;
}

async function fetchArtifactBytes(
  ref: string,
  source: ArtifactSource,
  projectRoot: string,
  expectedSha256?: string
): Promise<FetchedArtifact> {
  switch (source.type) {
    case "https":
    case "github": {
      const result: FetchedArtifact = { bytes: await fetchRemote(source.url), sourceRef: ref };
      if (expectedSha256 !== undefined) result.expectedSha256 = expectedSha256;
      return result;
    }
    case "path": {
      const absolute = path.resolve(projectRoot, source.path);
      let bytes: Buffer;
      try {
        bytes = await fsPromises.readFile(absolute);
      } catch {
        throw new BpError(
          `PACK_NOT_FOUND: cannot read artifact file: ${source.path}`,
          1,
          "PACK_NOT_FOUND",
          "Check the path; artifacts end in .bp-pack.tgz"
        );
      }
      const result: FetchedArtifact = { bytes, sourceRef: absolute };
      if (expectedSha256 !== undefined) result.expectedSha256 = expectedSha256;
      return result;
    }
    case "registry-id": {
      const { loadUserConfig } = await import("../config/user.js");
      const indexUrl = loadUserConfig().registry_url;
      if (!indexUrl) {
        throw new BpError(
          `PACK_NOT_FOUND: '${source.id}' is not a local pack and no registry is configured`,
          1,
          "PACK_NOT_FOUND",
          "Set a signed registry index with 'bp config set registry.url https://host/index.json'"
        );
      }
      const index = await fetchRegistryIndex(indexUrl);
      const entry = findIndexEntry(index, source.id);
      if (!entry) {
        throw new BpError(
          `PACK_NOT_FOUND: '${source.id}' is not present in the registry index at ${indexUrl}`,
          1,
          "PACK_NOT_FOUND",
          "Run 'bp rule pack:search <query>' to inspect the registry contents"
        );
      }
      return {
        bytes: await fetchRemote(entry.url),
        sourceRef: `registry:${indexUrl}`,
        expectedSha256: expectedSha256 ?? entry.sha256,
      };
    }
  }
}

function assertExpectedKind(kind: ArtifactKind, expectKind?: ArtifactKind): void {
  if (expectKind && kind !== expectKind) {
    throw new BpError(
      `PACK_WRONG_KIND: artifact is of kind '${kind}', expected '${expectKind}'`,
      1,
      "PACK_WRONG_KIND",
      kind === "plugin"
        ? "Install plugin artifacts with 'bp pack plugin:install'"
        : `Install it with 'bp ${kind === "rules" ? "rule" : "skill"} pack:install'`
    );
  }
}

async function decideTrust(
  artifact: Artifact,
  allowUnsigned: boolean
): Promise<{ trust: string; unsignedAccepted: boolean }> {
  const trustedKeys = await gatherTrustedKeys();
  const decision = verifyArtifact(artifact, trustedKeys);
  if (decision.status === "signed") {
    return { trust: `signed:${decision.keyName}`, unsignedAccepted: false };
  }

  const store = await loadTrustStore();
  if (store.policy.require_signature && !allowUnsigned) {
    throw new BpError(
      `PACK_UNSIGNED: artifact '${artifact.manifest.id}' v${artifact.manifest.version} is not signed`,
      1,
      "PACK_UNSIGNED",
      "Only install unsigned artifacts you fully trust; re-run with --allow-unsigned to accept the risk"
    );
  }
  return { trust: "unsigned-accepted", unsignedAccepted: true };
}

async function installPackArtifact(
  artifact: Artifact,
  distribution: DistributionInfo,
  options: RemoteInstallOptions
): Promise<MaterializeResult> {
  const { manifest } = options;
  if (!manifest) {
    throw new BpError(
      "PACK_INVALID: no backend manifest available for pack materialization",
      1,
      "PACK_INVALID",
      "Run the install from a bp project (or pass a backend)"
    );
  }
  const packDoc = artifact.files.get(PACK_DOCUMENT_FILE);
  if (!packDoc) {
    throw new BpError(
      `PACK_INVALID: artifact does not contain ${PACK_DOCUMENT_FILE}`,
      1,
      "PACK_INVALID",
      "Re-publish the pack with 'bp pack publish <packfile>'"
    );
  }

  // Stage the pack document in a temp dir and push it through the full
  // Stage 2/3 load path — schema validation, duplicate-id checks, the lot.
  const stagingDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "bp-artifact-"));
  try {
    const packFile = path.join(stagingDir, `${artifact.manifest.id}.bp-pack.yaml`);
    await fsPromises.writeFile(packFile, packDoc, "utf-8");
    const loaded = await loadPackFromFile(packFile);

    if (
      loaded.pack.id !== artifact.manifest.id ||
      loaded.pack.version !== artifact.manifest.version
    ) {
      throw new BpError(
        `PACK_INVALID: pack document (${loaded.pack.id}@${loaded.pack.version}) does not match the signed manifest (${artifact.manifest.id}@${artifact.manifest.version})`,
        1,
        "PACK_INVALID",
        "Re-publish the artifact; its manifest and pack document disagree"
      );
    }
    if (loaded.pack.kind !== artifact.manifest.kind) {
      throw new BpError(
        `PACK_INVALID: pack document kind '${loaded.pack.kind}' does not match the signed manifest kind '${artifact.manifest.kind}'`,
        1,
        "PACK_INVALID",
        "Re-publish the artifact; its manifest and pack document disagree"
      );
    }

    const materializeOptions: Parameters<typeof installPackToProject>[1] = {
      projectRoot: options.projectRoot,
      manifest,
      force: options.force ?? false,
      dryRun: options.dryRun ?? false,
      distribution,
    };
    return await installPackToProject(loaded, materializeOptions);
  } finally {
    await fsPromises.rm(stagingDir, { recursive: true, force: true });
  }
}

async function installPluginArtifact(
  artifact: Artifact,
  distribution: DistributionInfo,
  options: RemoteInstallOptions
): Promise<string[]> {
  const { projectRoot, dryRun = false } = options;
  const { manifest } = artifact;
  const targetDir = path.join(projectRoot, PROJECT_PLUGINS_DIR, manifest.id);
  const written: string[] = [];
  const files: Record<string, string> = {};

  for (const [relPath, data] of artifact.files) {
    const relProject = path.posix.join(PROJECT_PLUGINS_DIR, manifest.id, relPath);
    written.push(relProject);
    files[relProject] = governedContentHash(data.toString("utf-8"));
  }
  if (dryRun) return written;

  // Stage into a sibling temp dir, then swap — an interrupted install never
  // leaves a half-written plugin directory behind.
  const stagingDir = `${targetDir}.staging-${process.pid}`;
  try {
    await fsPromises.rm(stagingDir, { recursive: true, force: true });
    for (const [relPath, data] of artifact.files) {
      const target = path.join(stagingDir, relPath);
      await fsPromises.mkdir(path.dirname(target), { recursive: true });
      await fsPromises.writeFile(target, data);
    }
    await fsPromises.rm(targetDir, { recursive: true, force: true });
    await fsPromises.mkdir(path.dirname(targetDir), { recursive: true });
    await fsPromises.rename(stagingDir, targetDir);
  } catch (err) {
    await fsPromises.rm(stagingDir, { recursive: true, force: true });
    throw err;
  }

  const lockEntry: PackLockEntry = {
    id: manifest.id,
    version: manifest.version,
    source: distribution.source,
    kind: "plugin",
    rules_count: 0,
    skills_count: 0,
    installed_at: new Date().toISOString(),
    content_hash: distribution.artifact_sha256,
    artifact_sha256: distribution.artifact_sha256,
    trust: distribution.trust,
    files,
  };
  if (distribution.publisher !== undefined) lockEntry.publisher = distribution.publisher;

  const lock = await loadPackLock(projectRoot);
  lock.installed = [...lock.installed.filter((e) => e.id !== manifest.id), lockEntry];
  await savePackLock(projectRoot, lock);
  return written;
}

/**
 * Resolve a `.bp.json` plugin entry of the form `artifact:<id>` to the
 * project-relative `.mjs` path of the installed plugin artifact (Stage 5 §6).
 * Returns null when the artifact is not installed.
 */
export async function resolvePluginArtifactPath(
  projectRoot: string,
  id: string
): Promise<string | null> {
  const lock = await loadPackLock(projectRoot);
  const entry = lock.installed.find((e) => e.id === id && e.kind === "plugin");
  if (!entry) return null;
  const bundles = Object.keys(entry.files)
    .filter((f) => f.endsWith(".mjs"))
    .sort();
  return bundles[0] ?? null;
}

/**
 * Install a remote artifact ref (https URL, github: ref, `.bp-pack.tgz`
 * path, or registry id). Fully verifies before any project file is touched.
 */
export async function installRemoteArtifact(
  ref: string,
  options: RemoteInstallOptions
): Promise<RemoteInstallResult> {
  const source = resolveArtifactSource(ref);
  const fetched = await fetchArtifactBytes(
    ref,
    source,
    options.projectRoot,
    options.expectedSha256
  );

  const artifactSha256 = sha256Of(fetched.bytes);
  if (fetched.expectedSha256 && artifactSha256 !== fetched.expectedSha256) {
    throw new BpError(
      `PACK_HASH_MISMATCH: artifact sha256 ${artifactSha256} does not match the pinned hash ${fetched.expectedSha256}`,
      1,
      "PACK_HASH_MISMATCH",
      "The artifact changed upstream; refuse it, or update the pin after verifying the new content"
    );
  }

  const artifact = readArtifact(fetched.bytes);
  assertExpectedKind(artifact.manifest.kind, options.expectKind);
  const { trust, unsignedAccepted } = await decideTrust(artifact, options.allowUnsigned ?? false);

  const distribution: DistributionInfo = {
    source: fetched.sourceRef,
    artifact_sha256: artifactSha256,
    publisher: artifact.manifest.publisher,
    trust,
  };

  const result: RemoteInstallResult = {
    id: artifact.manifest.id,
    version: artifact.manifest.version,
    kind: artifact.manifest.kind,
    source: fetched.sourceRef,
    artifactSha256,
    trust,
    unsignedAccepted,
    publisher: artifact.manifest.publisher,
  };

  if (artifact.manifest.kind === "plugin") {
    result.pluginFiles = await installPluginArtifact(artifact, distribution, options);
  } else {
    result.materialize = await installPackArtifact(artifact, distribution, options);
  }
  return result;
}
