/**
 * Registry client (Stage 5 §4 rewrite): real remote artifact fetching with
 * hard safety limits, plus the static-host signed-index registry.
 *
 * Install sources:
 *   - `https://` URL          → direct tarball fetch
 *   - `github:owner/repo[@ref]#path` → raw.githubusercontent.com fetch
 *     (subject to GitHub's unauthenticated rate limits — see docs)
 *   - local path              → existing Stage 2/3 behavior (handled upstream)
 *   - bare id                 → resolved through the configured signed index
 *
 * All fetches: https only (plain http allowed solely for loopback hosts so
 * tests and local registries work), redirects re-checked per hop, 30 s
 * timeout, decompressed/network size capped by `BP_PACK_MAX_BYTES`.
 *
 * The legacy in-memory mock registry survives strictly behind
 * `BP_REGISTRY_MOCK=1` for unit tests.
 */

import type { Dirent } from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { EXIT_CODES } from "../constants.js";
import { BpError, NetworkError, PermissionError } from "../errors.js";
import { logger } from "../logger.js";
import { safeOutputPath } from "../security/path-traversal.js";
import { getTemplatesRoot } from "../templater/selector.js";
import { normalizeError } from "../utils/errors.js";
import { findIndexEntry, type RegistryIndex, verifyIndex } from "./registry-index.js";
import { loadPublicKey, signData, verifySignature } from "./signer.js";
import { maxArtifactBytes } from "./tar.js";
import { gatherTrustedKeys } from "./trust.js";

export const DEFAULT_FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 5;

function fetchTimeoutMs(): number {
  const env = process.env.BP_PACK_TIMEOUT_MS;
  if (env) {
    const parsed = Number(env);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return DEFAULT_FETCH_TIMEOUT_MS;
}

function isLoopbackHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/** https everywhere; plain http tolerated only for loopback hosts. */
export function assertFetchableUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new PermissionError(`Invalid URL: '${url}'.`);
  }
  if (parsed.protocol === "https:") return parsed;
  if (parsed.protocol === "http:" && isLoopbackHost(parsed.hostname)) return parsed;
  throw new PermissionError(
    `Non-HTTPS URL rejected: '${url}'. Fix: Only https:// URLs (or http on loopback) are allowed for registry fetches.`
  );
}

async function readBodyCapped(response: Response, maxBytes: number, url: string): Promise<Buffer> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > maxBytes) {
    throw new NetworkError(
      `Refusing to download ${url}: advertised size ${contentLength} exceeds limit of ${maxBytes} bytes (BP_PACK_MAX_BYTES)`
    );
  }
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks: Buffer[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new NetworkError(
        `Refusing to download ${url}: response exceeds limit of ${maxBytes} bytes (BP_PACK_MAX_BYTES)`
      );
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks);
}

/**
 * Fetch a remote resource with the Stage 5 hard limits: scheme check per
 * redirect hop, bounded redirect count, abort timeout, and byte cap.
 */
export async function fetchRemote(
  url: string,
  options: { maxBytes?: number; timeoutMs?: number } = {}
): Promise<Buffer> {
  const maxBytes = options.maxBytes ?? maxArtifactBytes();
  const timeoutMs = options.timeoutMs ?? fetchTimeoutMs();

  let current = assertFetchableUrl(url);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      let response: Response;
      try {
        response = await fetch(current, { redirect: "manual", signal: controller.signal });
      } catch (err) {
        const reason = controller.signal.aborted
          ? `timed out after ${timeoutMs}ms`
          : normalizeError(err).message;
        throw new NetworkError(`Failed to fetch ${current.href}: ${reason}`);
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new NetworkError(`Redirect from ${current.href} without Location`);
        // Re-validate the scheme on every hop: a https URL must never
        // silently redirect through plain http.
        current = assertFetchableUrl(new URL(location, current).href);
        continue;
      }
      if (!response.ok) {
        throw new NetworkError(
          `Failed to fetch ${current.href}: HTTP ${response.status}`,
          1,
          response.status
        );
      }
      return await readBodyCapped(response, maxBytes, current.href);
    }
    throw new NetworkError(`Too many redirects (>${MAX_REDIRECTS}) fetching ${url}`);
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Install source resolution
// ---------------------------------------------------------------------------

export interface GithubRef {
  owner: string;
  repo: string;
  ref: string;
  filePath: string;
}

const GITHUB_REF_RE = /^github:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)(?:@([A-Za-z0-9_./-]+))?#(.+)$/;

/** Parse `github:owner/repo[@ref]#path/to/artifact.bp-pack.tgz`. */
export function parseGithubRef(ref: string): GithubRef {
  const match = GITHUB_REF_RE.exec(ref);
  if (!match?.[1] || !match[2] || !match[4]) {
    throw new BpError(
      `PACK_REF_INVALID: cannot parse github ref '${ref}'`,
      1,
      "PACK_REF_INVALID",
      "Use the form github:owner/repo[@ref]#path/to/<id>-<version>.bp-pack.tgz"
    );
  }
  return { owner: match[1], repo: match[2], ref: match[3] ?? "HEAD", filePath: match[4] };
}

export function githubRawUrl(ref: GithubRef): string {
  return `https://raw.githubusercontent.com/${ref.owner}/${ref.repo}/${ref.ref}/${ref.filePath}`;
}

export type ArtifactSource =
  | { type: "https"; url: string }
  | { type: "github"; url: string; ref: GithubRef }
  | { type: "path"; path: string }
  | { type: "registry-id"; id: string };

/** Classify a pack:install ref into its install source. */
export function resolveArtifactSource(ref: string): ArtifactSource {
  if (ref.startsWith("https://") || ref.startsWith("http://")) {
    assertFetchableUrl(ref);
    return { type: "https", url: ref };
  }
  if (ref.startsWith("github:")) {
    const parsed = parseGithubRef(ref);
    return { type: "github", url: githubRawUrl(parsed), ref: parsed };
  }
  if (ref.endsWith(".bp-pack.tgz") || ref.includes("/") || ref.includes(path.sep)) {
    return { type: "path", path: ref };
  }
  return { type: "registry-id", id: ref };
}

/** Whether a pack:install ref is a Stage 5 artifact ref (vs Stage 2/3 pack). */
export function isArtifactRef(ref: string): boolean {
  return (
    ref.startsWith("https://") ||
    ref.startsWith("http://") ||
    ref.startsWith("github:") ||
    ref.endsWith(".bp-pack.tgz")
  );
}

// ---------------------------------------------------------------------------
// Signed registry index
// ---------------------------------------------------------------------------

function indexSigUrl(indexUrl: string): string {
  return indexUrl.endsWith(".json")
    ? `${indexUrl.slice(0, -".json".length)}.sig`
    : `${indexUrl}.sig`;
}

/** Fetch and authenticate the configured registry index. */
export async function fetchRegistryIndex(
  indexUrl: string,
  trustedKeys?: Array<{ name: string; publicKeyPem: string }>
): Promise<RegistryIndex> {
  const keys = trustedKeys ?? (await gatherTrustedKeys());
  const [indexBytes, sigBytes] = await Promise.all([
    fetchRemote(indexUrl, { maxBytes: 5 * 1024 * 1024 }),
    fetchRemote(indexSigUrl(indexUrl), { maxBytes: 64 * 1024 }),
  ]);
  const { index } = verifyIndex(indexBytes.toString("utf-8"), sigBytes.toString("utf-8"), keys);
  return index;
}

/**
 * Best-effort load of the configured registry index for advisory checks
 * (e.g. `PACK_OUTDATED`). Returns null when no registry is configured,
 * `BP_OFFLINE=1` is set, or the fetch/verification fails — advisory checks
 * must never break offline workflows.
 */
export async function loadConfiguredRegistryIndex(): Promise<RegistryIndex | null> {
  if (process.env.BP_OFFLINE === "1") return null;
  try {
    const { loadUserConfig } = await import("../config/user.js");
    const url = loadUserConfig().registry_url;
    if (!url) return null;
    return await fetchRegistryIndex(url);
  } catch {
    return null;
  }
}

export { findIndexEntry };

// ---------------------------------------------------------------------------
// Legacy template-pack registry (mock kept behind BP_REGISTRY_MOCK=1)
// ---------------------------------------------------------------------------

export interface RegistryAdapter {
  list(): Promise<RegistryPackage[]>;
}

export interface RegistryPackage {
  name: string;
  version: string;
  description: string;
  signature?: string;
  archiveData?: string; // base64 encoded archive content (mock only)
}

function mockEnabled(): boolean {
  return process.env.BP_REGISTRY_MOCK === "1";
}

export class RegistryClient {
  private registryAdapter: RegistryAdapter | undefined;

  // In-memory mock store; only consulted when BP_REGISTRY_MOCK=1.
  private static mockRegistry: Map<string, RegistryPackage[]> = new Map();

  public token: string | undefined;

  constructor(
    registryUrl = "https://registry.npmjs.org",
    token?: string,
    adapter?: RegistryAdapter
  ) {
    assertFetchableUrl(registryUrl);
    this.token = token;
    this.registryAdapter = adapter;
  }

  // Register mock packages for unit tests (requires BP_REGISTRY_MOCK=1).
  static registerMockPackage(pkg: RegistryPackage) {
    const list = RegistryClient.mockRegistry.get(pkg.name) || [];
    list.push(pkg);
    RegistryClient.mockRegistry.set(pkg.name, list);
  }

  static clearMockPackages() {
    RegistryClient.mockRegistry.clear();
  }

  async list(): Promise<RegistryPackage[]> {
    if (this.registryAdapter) {
      return this.registryAdapter.list();
    }
    if (mockEnabled() && RegistryClient.mockRegistry.size > 0) {
      const all: RegistryPackage[] = [];
      for (const pkgs of RegistryClient.mockRegistry.values()) {
        const latest = pkgs[pkgs.length - 1];
        if (latest) all.push(latest);
      }
      return all;
    }

    // No remote adapter and no mock packages: report the template packs
    // actually bundled with this installation — the same packs `install` can
    // copy from disk. This avoids advertising packages that do not exist.
    return RegistryClient.listBundledPacks();
  }

  /**
   * Enumerate the backend template packs shipped inside this package's
   * `templates/` directory. A pack is any subdirectory containing a
   * `manifest.json`. Returns real, installable entries only.
   */
  static async listBundledPacks(): Promise<RegistryPackage[]> {
    const root = getTemplatesRoot();
    let entries: Dirent[];
    try {
      entries = await fsPromises.readdir(root, { withFileTypes: true });
    } catch {
      return [];
    }

    const packs: RegistryPackage[] = [];
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith("_") || entry.name.startsWith(".")) {
        continue;
      }
      const manifestPath = path.join(root, entry.name, "manifest.json");
      let version = "1.0.0";
      try {
        const raw = await fsPromises.readFile(manifestPath, "utf-8");
        const manifest = JSON.parse(raw) as { version?: string };
        if (typeof manifest.version === "string") version = manifest.version;
      } catch {
        // No manifest: not an installable pack, skip it.
        continue;
      }
      packs.push({
        name: entry.name,
        version,
        description: `Bundled ${entry.name} template pack`,
      });
    }
    return packs.sort((a, b) => a.name.localeCompare(b.name));
  }

  async install(packageName: string, targetDir: string, publicKey?: string): Promise<void> {
    const pkgs = mockEnabled() ? RegistryClient.mockRegistry.get(packageName) : undefined;
    if (!pkgs || pkgs.length === 0) {
      // Local bundled template copy — no network, no archive, no signature.
      const isOfficial = packageName.startsWith("@bp-templates/");
      const packName = isOfficial ? packageName.replace("@bp-templates/", "") : packageName;

      const sourceTemplateDir = path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "../../templates",
        packName
      );

      const sourceExists = await fsPromises
        .access(sourceTemplateDir)
        .then(() => true)
        .catch(() => false);

      if (sourceExists) {
        await fsPromises.mkdir(targetDir, { recursive: true });
        await fsPromises.cp(sourceTemplateDir, targetDir, { recursive: true });
        return;
      }
      throw new Error(`Package "${packageName}" not found in registry.`);
    }

    const latest = pkgs[pkgs.length - 1];
    if (!latest) throw new Error(`Package "${packageName}" has no versions.`);

    if (latest.archiveData && latest.signature) {
      const buffer = Buffer.from(latest.archiveData, "base64");

      // Fail closed: with no key resolvable and the trust policy requiring
      // signatures (the default), refuse the install instead of skipping
      // verification. Opt-out is explicit only (policy.require_signature=false).
      const resolvedPublicKey = publicKey ?? (await loadPublicKey());
      if (resolvedPublicKey) {
        const isValid = verifySignature(buffer, latest.signature, resolvedPublicKey);
        if (!isValid) {
          throw new BpError(
            `SIGNATURE_FAILED: signature verification failed for package ${packageName}`,
            EXIT_CODES.PERMISSION_DENIED,
            "SIGNATURE_FAILED",
            "The artifact does not match any trusted key. Refusing to install."
          );
        }
      } else {
        const { loadTrustStore } = await import("./trust.js");
        const policy = (await loadTrustStore()).policy;
        if (policy.require_signature) {
          throw new BpError(
            `SIGNATURE_FAILED: no public key configured to verify package ${packageName}`,
            EXIT_CODES.PERMISSION_DENIED,
            "SIGNATURE_FAILED",
            "Configure BP_REGISTRY_PUBLIC_KEY or add a trusted key with 'bp trust add'. To install unsigned packs, explicitly set policy.require_signature=false in trust.json."
          );
        }
        logger.warn(
          { packageName },
          "Installing unsigned package: trust policy has require_signature=false"
        );
      }

      await fsPromises.mkdir(targetDir, { recursive: true });
      try {
        const files = JSON.parse(buffer.toString("utf-8")) as Record<string, string>;
        for (const [relPath, content] of Object.entries(files)) {
          // Reject archive keys that escape the target directory (e.g. ../../x).
          const fullPath = safeOutputPath(relPath, targetDir);
          await fsPromises.mkdir(path.dirname(fullPath), { recursive: true });
          await fsPromises.writeFile(fullPath, content, "utf-8");
        }
      } catch (err) {
        throw new Error(`Failed to extract package archive: ${normalizeError(err).message}`);
      }
    } else {
      throw new Error(`Package "${packageName}" is missing signature or archive data.`);
    }
  }

  async publish(
    packageName: string,
    version: string,
    packDir: string,
    privateKey: string
  ): Promise<void> {
    if (!mockEnabled()) {
      throw new BpError(
        "REGISTRY_MOCK_DISABLED: the in-memory registry is test-only (set BP_REGISTRY_MOCK=1)",
        1,
        "REGISTRY_MOCK_DISABLED",
        "Publish signed pack artifacts with 'bp pack publish' instead"
      );
    }
    const packExists = await fsPromises
      .access(packDir)
      .then(() => true)
      .catch(() => false);
    if (!packExists) {
      throw new Error(`Pack directory does not exist: ${packDir}`);
    }

    const files: Record<string, string> = {};

    async function walk(dir: string, base: string): Promise<void> {
      const entries = await fsPromises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = path.relative(base, fullPath);
        if (entry.isDirectory()) {
          await walk(fullPath, base);
        } else {
          files[relPath] = await fsPromises.readFile(fullPath, "utf-8");
        }
      }
    }

    await walk(packDir, packDir);

    const archiveBuffer = Buffer.from(JSON.stringify(files), "utf-8");
    const signature = signData(archiveBuffer, privateKey);

    const newPkg: RegistryPackage = {
      name: packageName,
      version,
      description: `Published package ${packageName}`,
      signature,
      archiveData: archiveBuffer.toString("base64"),
    };

    const list = RegistryClient.mockRegistry.get(packageName) || [];
    list.push(newPkg);
    RegistryClient.mockRegistry.set(packageName, list);
  }
}
