import * as zlib from "node:zlib";
import { describe, expect, it } from "vitest";
import { BpError } from "../../../src/errors.js";
import { createTarGz, extractTarGz, isSafeArchivePath } from "../../../src/registry/tar.js";

/** Hand-build a raw ustar header so tests can craft hostile archives. */
function rawHeader(name: string, size: number, typeflag = "0"): Buffer {
  const header = Buffer.alloc(512);
  header.write(name, 0, "utf-8");
  header.write(`${(0o644).toString(8).padStart(7, "0")}\0`, 100, "ascii");
  header.write(`${(0).toString(8).padStart(7, "0")}\0`, 108, "ascii");
  header.write(`${(0).toString(8).padStart(7, "0")}\0`, 116, "ascii");
  header.write(`${size.toString(8).padStart(11, "0")}\0`, 124, "ascii");
  header.write(`${(0).toString(8).padStart(11, "0")}\0`, 136, "ascii");
  header.write("        ", 148, "ascii");
  header.write(typeflag, 156, "ascii");
  header.write("ustar\0", 257, "ascii");
  header.write("00", 263, "ascii");
  let sum = 0;
  for (const byte of header) sum += byte;
  header.write(`${sum.toString(8).padStart(6, "0")}\0 `, 148, "ascii");
  return header;
}

function hostileArchive(name: string, content: Buffer, typeflag = "0"): Buffer {
  const pad = (512 - (content.length % 512)) % 512;
  return zlib.gzipSync(
    Buffer.concat([rawHeader(name, content.length, typeflag), content, Buffer.alloc(pad + 1024)])
  );
}

describe("tar round trip", () => {
  it("creates and extracts entries byte-identically", () => {
    const entries = [
      { path: "pack.yaml", data: Buffer.from("schema: bp-pack/1\n") },
      { path: "nested/dir/file.txt", data: Buffer.from("hello éè world") },
      { path: "empty.txt", data: Buffer.alloc(0) },
    ];
    const extracted = extractTarGz(createTarGz(entries));
    expect(extracted.map((e) => e.path).sort()).toEqual(entries.map((e) => e.path).sort());
    for (const entry of entries) {
      const out = extracted.find((e) => e.path === entry.path);
      expect(out?.data.equals(entry.data)).toBe(true);
    }
  });

  it("supports long paths via the ustar prefix field", () => {
    const longPath = `${"a".repeat(80)}/${"b".repeat(60)}/${"c".repeat(30)}.txt`;
    const extracted = extractTarGz(createTarGz([{ path: longPath, data: Buffer.from("x") }]));
    expect(extracted[0]?.path).toBe(longPath);
  });

  it("produces deterministic bytes for the same input", () => {
    const entries = [{ path: "a.txt", data: Buffer.from("a") }];
    expect(createTarGz(entries).equals(createTarGz(entries))).toBe(true);
  });
});

describe("extraction guards", () => {
  it("rejects the zip-slip fixture (../../evil)", () => {
    const archive = hostileArchive("../../evil", Buffer.from("pwned"));
    expect(() => extractTarGz(archive)).toThrowError(/PACK_EXTRACT_UNSAFE/);
  });

  it("rejects absolute paths", () => {
    const archive = hostileArchive("/etc/passwd", Buffer.from("pwned"));
    expect(() => extractTarGz(archive)).toThrowError(/PACK_EXTRACT_UNSAFE/);
  });

  it("rejects symlink entries", () => {
    const archive = hostileArchive("link", Buffer.alloc(0), "2");
    expect(() => extractTarGz(archive)).toThrowError(/PACK_EXTRACT_UNSAFE/);
  });

  it("rejects hardlink entries", () => {
    const archive = hostileArchive("link", Buffer.alloc(0), "1");
    expect(() => extractTarGz(archive)).toThrowError(/PACK_EXTRACT_UNSAFE/);
  });

  it("rejects interior .. segments and backslashes", () => {
    expect(isSafeArchivePath("ok/inner/../evil")).toBe(false);
    expect(isSafeArchivePath("ok\\evil")).toBe(false);
    expect(isSafeArchivePath("")).toBe(false);
    expect(isSafeArchivePath("./sneaky")).toBe(false);
    expect(isSafeArchivePath("good/path.txt")).toBe(true);
  });

  it("refuses to create archives with unsafe paths", () => {
    expect(() => createTarGz([{ path: "../up.txt", data: Buffer.alloc(0) }])).toThrowError(
      /PACK_EXTRACT_UNSAFE/
    );
  });

  it("maps corrupted gzip streams to PACK_HASH_MISMATCH", () => {
    const archive = createTarGz([{ path: "a.txt", data: Buffer.from("content") }]);
    const tampered = Buffer.from(archive);
    const idx = tampered.length - 5;
    tampered[idx] = (tampered[idx] ?? 0) ^ 0xff;
    try {
      extractTarGz(tampered);
      expect.unreachable("tampered archive must not extract");
    } catch (err) {
      expect(err).toBeInstanceOf(BpError);
      expect((err as BpError).code).toBe("PACK_HASH_MISMATCH");
    }
  });

  it("enforces the size cap on decompressed contents", () => {
    const big = Buffer.alloc(64 * 1024, 0x61);
    const archive = createTarGz([{ path: "big.bin", data: big }]);
    expect(() => extractTarGz(archive, 1024)).toThrowError(/PACK_HASH_MISMATCH/);
  });
});
