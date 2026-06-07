/**
 * Ownership manifest (`.bp/manifest.json`).
 *
 * Records which governance files `bp` is responsible for, the template each was
 * rendered from, and a content hash captured at write time. This lets later
 * commands distinguish three states that were previously indistinguishable:
 *
 *   - "managed"   — tracked and unchanged since bp wrote it
 *   - "modified"  — tracked but the developer edited it (intentional change)
 *   - "missing"   — tracked but deleted from disk
 *   - "untracked" — present on disk but never recorded by bp (user-authored)
 *
 * Without this record, drift detection cannot tell an intentional developer
 * edit from configuration rot. The manifest is the source of truth for that
 * distinction and is safe to commit to version control.
 */

import * as crypto from "node:crypto";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";
import { z } from "zod";
import { normalizeError } from "../utils/errors.js";

export const MANIFEST_DIR = ".bp";
export const MANIFEST_FILE = path.join(MANIFEST_DIR, "manifest.json");
export const MANIFEST_SCHEMA_VERSION = "1.0";

export type ManifestOrigin = "generated" | "adopted";

export const ManifestEntrySchema = z.object({
  /** SHA-256 of the file content captured when bp last wrote/recorded it. */
  hash: z.string().regex(/^[a-f0-9]{64}$/, "hash must be a sha256 hex digest"),
  /** How the file entered bp's ownership. */
  origin: z.enum(["generated", "adopted"]),
  /** Template the file was rendered from (relative to the pack), if generated. */
  template: z.string().nullable().default(null),
  /** ISO timestamp of the last record. */
  recorded_at: z.string(),
});

export const ManifestSchema = z.object({
  schema_version: z.literal(MANIFEST_SCHEMA_VERSION).default(MANIFEST_SCHEMA_VERSION),
  bp_version: z.string(),
  generated_at: z.string(),
  updated_at: z.string(),
  /** Keyed by POSIX-style path relative to the project root. */
  files: z.record(z.string(), ManifestEntrySchema).default({}),
});

export type ManifestEntry = z.infer<typeof ManifestEntrySchema>;
export type Manifest = z.infer<typeof ManifestSchema>;

export type FileState = "managed" | "modified" | "missing" | "untracked";

export interface FileStatus {
  path: string;
  state: FileState;
  origin?: ManifestOrigin;
}

// ---------------------------------------------------------------------------
// Hashing & path helpers
// ---------------------------------------------------------------------------

/** Deterministic content hash used for ownership tracking. */
export function computeContentHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

/** Normalize a path to a POSIX-style key relative to the project root. */
export function toManifestKey(projectRoot: string, filePath: string): string {
  const rel = path.relative(projectRoot, path.resolve(projectRoot, filePath));
  return rel.split(path.sep).join("/");
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

export function createEmptyManifest(bpVersion: string): Manifest {
  const now = new Date().toISOString();
  return {
    schema_version: MANIFEST_SCHEMA_VERSION,
    bp_version: bpVersion,
    generated_at: now,
    updated_at: now,
    files: {},
  };
}

/**
 * Record (or update) ownership of a file. Mutates and returns the manifest so
 * callers can chain record calls during a render pass.
 */
export function recordFile(
  manifest: Manifest,
  key: string,
  content: string,
  origin: ManifestOrigin,
  template: string | null = null
): Manifest {
  manifest.files[key] = {
    hash: computeContentHash(content),
    origin,
    template,
    recorded_at: new Date().toISOString(),
  };
  manifest.updated_at = new Date().toISOString();
  return manifest;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export async function loadManifest(projectRoot: string): Promise<Manifest | null> {
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  let raw: string;
  try {
    raw = await fsPromises.readFile(manifestPath, "utf-8");
  } catch {
    return null;
  }
  try {
    return ManifestSchema.parse(JSON.parse(raw));
  } catch (err) {
    throw new Error(
      `Ownership manifest at ${MANIFEST_FILE} is corrupt: ${normalizeError(err).message}`
    );
  }
}

export async function saveManifest(projectRoot: string, manifest: Manifest): Promise<void> {
  const dir = path.join(projectRoot, MANIFEST_DIR);
  await fsPromises.mkdir(dir, { recursive: true });
  const manifestPath = path.join(projectRoot, MANIFEST_FILE);
  await fsPromises.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf-8");
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify a single tracked-or-untracked path given its current content on
 * disk (`null` means the file is absent).
 */
export function classifyFile(
  manifest: Manifest | null,
  key: string,
  currentContent: string | null
): FileStatus {
  const entry = manifest?.files[key];
  if (!entry) {
    return { path: key, state: "untracked" };
  }
  if (currentContent === null) {
    return { path: key, state: "missing", origin: entry.origin };
  }
  const state: FileState =
    computeContentHash(currentContent) === entry.hash ? "managed" : "modified";
  return { path: key, state, origin: entry.origin };
}

/**
 * Build a full status report for a set of candidate files on disk. Reads each
 * file once. Tracked files that no longer exist on disk are reported as
 * "missing" even if they are not in `candidatePaths`.
 */
export async function getManifestStatus(
  projectRoot: string,
  candidatePaths: string[]
): Promise<FileStatus[]> {
  const manifest = await loadManifest(projectRoot);
  const statuses: FileStatus[] = [];
  const seen = new Set<string>();

  for (const candidate of candidatePaths) {
    const key = toManifestKey(projectRoot, candidate);
    if (seen.has(key)) continue;
    seen.add(key);
    let content: string | null = null;
    try {
      content = await fsPromises.readFile(path.join(projectRoot, key), "utf-8");
    } catch {
      content = null;
    }
    statuses.push(classifyFile(manifest, key, content));
  }

  // Surface tracked files that were deleted and not in the candidate set.
  if (manifest) {
    for (const key of Object.keys(manifest.files)) {
      if (seen.has(key)) continue;
      let exists = true;
      try {
        await fsPromises.access(path.join(projectRoot, key));
      } catch {
        exists = false;
      }
      if (!exists) {
        const entry = manifest.files[key];
        statuses.push(
          entry
            ? { path: key, state: "missing", origin: entry.origin }
            : { path: key, state: "missing" }
        );
      }
    }
  }

  return statuses;
}
