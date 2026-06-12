/**
 * Minimal ustar + gzip archive support for `*.bp-pack.tgz` artifacts
 * (Stage 5 §1). bp writes and reads its own envelope, so this implements only
 * the subset it needs: regular files with safe relative paths.
 *
 * Extraction is deliberately hostile-input-first:
 *   - only regular-file entries are accepted (symlinks, hardlinks, devices,
 *     pax extensions ⇒ `PACK_EXTRACT_UNSAFE`)
 *   - absolute paths, `..` segments, and empty/odd segments are rejected
 *   - per-entry and total sizes are capped before any allocation grows
 * Corrupted archives (bad gzip stream, malformed headers) surface as
 * `PACK_HASH_MISMATCH`: a tampered byte must abort the install loudly.
 */

import * as zlib from "node:zlib";
import { BpError } from "../errors.js";

export interface TarEntry {
  /** POSIX-relative path inside the archive. */
  path: string;
  data: Buffer;
}

const BLOCK = 512;
const NAME_LEN = 100;
const PREFIX_LEN = 155;

/** Default maximum decompressed artifact size: 10 MiB (BP_PACK_MAX_BYTES). */
export const DEFAULT_MAX_ARTIFACT_BYTES = 10 * 1024 * 1024;

export function maxArtifactBytes(): number {
  const env = process.env.BP_PACK_MAX_BYTES;
  if (env) {
    const parsed = Number(env);
    if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed);
  }
  return DEFAULT_MAX_ARTIFACT_BYTES;
}

function corrupt(detail: string): BpError {
  return new BpError(
    `PACK_HASH_MISMATCH: artifact archive is corrupted or has been tampered with (${detail})`,
    1,
    "PACK_HASH_MISMATCH",
    "Re-download the artifact from a trusted source; do not install this file"
  );
}

function unsafe(detail: string): BpError {
  return new BpError(
    `PACK_EXTRACT_UNSAFE: artifact archive contains an unsafe entry (${detail})`,
    1,
    "PACK_EXTRACT_UNSAFE",
    "This artifact attempts a path-traversal or link attack; do not install it"
  );
}

/**
 * A safe archive path is a normalized POSIX relative path: non-empty `/`
 * separated segments, none of which are `.` or `..`, no backslashes, no
 * leading `/`, and short enough for a plain ustar name+prefix split.
 */
export function isSafeArchivePath(p: string): boolean {
  if (p.length === 0 || p.length > NAME_LEN + PREFIX_LEN + 1) return false;
  if (p.includes("\\") || p.includes("\0")) return false;
  if (p.startsWith("/")) return false;
  const segments = p.split("/");
  return segments.every((s) => s.length > 0 && s !== "." && s !== "..");
}

function writeOctal(header: Buffer, offset: number, length: number, value: number): void {
  const text = value.toString(8).padStart(length - 1, "0");
  header.write(`${text}\0`, offset, "ascii");
}

function splitName(p: string): { name: string; prefix: string } {
  if (Buffer.byteLength(p) <= NAME_LEN) return { name: p, prefix: "" };
  // Split on a `/` so name fits in 100 bytes and prefix in 155.
  for (let i = 0; i < p.length; i++) {
    if (p[i] === "/") {
      const prefix = p.slice(0, i);
      const name = p.slice(i + 1);
      if (Buffer.byteLength(prefix) <= PREFIX_LEN && Buffer.byteLength(name) <= NAME_LEN) {
        return { name, prefix };
      }
    }
  }
  throw new BpError(
    `PACK_EXTRACT_UNSAFE: archive path too long for ustar format: ${p}`,
    1,
    "PACK_EXTRACT_UNSAFE",
    "Use shorter file paths inside the pack"
  );
}

function buildHeader(entryPath: string, size: number): Buffer {
  const header = Buffer.alloc(BLOCK);
  const { name, prefix } = splitName(entryPath);
  header.write(name, 0, "utf-8");
  writeOctal(header, 100, 8, 0o644); // mode
  writeOctal(header, 108, 8, 0); // uid
  writeOctal(header, 116, 8, 0); // gid
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0); // mtime: fixed for reproducible archives
  header.write("        ", 148, "ascii"); // chksum placeholder (8 spaces)
  header.write("0", 156, "ascii"); // typeflag: regular file
  header.write("ustar\0", 257, "ascii");
  header.write("00", 263, "ascii");
  header.write(prefix, 345, "utf-8");

  let sum = 0;
  for (const byte of header) sum += byte;
  const chk = sum.toString(8).padStart(6, "0");
  header.write(`${chk}\0 `, 148, "ascii");
  return header;
}

/** Create a gzipped ustar archive from in-memory entries (sorted by path). */
export function createTarGz(entries: TarEntry[]): Buffer {
  const chunks: Buffer[] = [];
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    if (!isSafeArchivePath(entry.path)) {
      throw unsafe(`refusing to archive unsafe path: ${entry.path}`);
    }
    chunks.push(buildHeader(entry.path, entry.data.length));
    chunks.push(entry.data);
    const pad = (BLOCK - (entry.data.length % BLOCK)) % BLOCK;
    if (pad > 0) chunks.push(Buffer.alloc(pad));
  }
  chunks.push(Buffer.alloc(BLOCK * 2)); // end-of-archive marker
  return zlib.gzipSync(Buffer.concat(chunks), { level: 9 });
}

function parseOctal(header: Buffer, offset: number, length: number): number {
  const raw = header
    .subarray(offset, offset + length)
    .toString("ascii")
    .replace(/\0/g, "")
    .trim();
  if (raw === "") return 0;
  const value = Number.parseInt(raw, 8);
  if (Number.isNaN(value) || value < 0) throw corrupt("invalid octal field in tar header");
  return value;
}

function readString(header: Buffer, offset: number, length: number): string {
  const slice = header.subarray(offset, offset + length);
  const nul = slice.indexOf(0);
  return slice.subarray(0, nul === -1 ? length : nul).toString("utf-8");
}

/**
 * Extract a gzipped ustar archive fully in memory, enforcing the safety
 * rules described in the module docs. Never touches the filesystem.
 */
export function extractTarGz(archive: Buffer, maxBytes = maxArtifactBytes()): TarEntry[] {
  if (archive.length > maxBytes) {
    throw corrupt(`compressed archive exceeds size limit of ${maxBytes} bytes`);
  }
  let tar: Buffer;
  try {
    tar = zlib.gunzipSync(archive, { maxOutputLength: maxBytes });
  } catch (err) {
    throw corrupt(`gzip stream invalid: ${err instanceof Error ? err.message : String(err)}`);
  }

  const entries: TarEntry[] = [];
  let offset = 0;
  let total = 0;
  while (offset + BLOCK <= tar.length) {
    const header = tar.subarray(offset, offset + BLOCK);
    if (header.every((b) => b === 0)) break; // end-of-archive

    const magic = readString(header, 257, 6);
    if (magic !== "ustar") throw corrupt("missing ustar magic in tar header");

    const typeflag = readString(header, 156, 1) || "0";
    const name = readString(header, 0, NAME_LEN);
    const prefix = readString(header, 345, PREFIX_LEN);
    const entryPath = prefix ? `${prefix}/${name}` : name;
    const size = parseOctal(header, 124, 12);

    if (typeflag !== "0" && typeflag !== "\0") {
      throw unsafe(`non-regular-file entry '${entryPath}' (typeflag '${typeflag}')`);
    }
    if (!isSafeArchivePath(entryPath)) {
      throw unsafe(`path-traversal attempt in entry '${entryPath}'`);
    }

    total += size;
    if (total > maxBytes) throw corrupt(`archive contents exceed size limit of ${maxBytes} bytes`);

    const dataStart = offset + BLOCK;
    if (dataStart + size > tar.length) throw corrupt("truncated tar entry data");
    entries.push({ path: entryPath, data: Buffer.from(tar.subarray(dataStart, dataStart + size)) });

    offset = dataStart + size + ((BLOCK - (size % BLOCK)) % BLOCK);
  }
  return entries;
}
