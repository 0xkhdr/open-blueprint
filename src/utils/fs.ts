import type { Stats } from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as path from "node:path";

export interface FileSystem {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string>;
  readdir(dirPath: string): Promise<string[]>;
  stat(filePath: string): Promise<Stats>;
  access(filePath: string): Promise<void>;
}

export class RealFileSystem implements FileSystem {
  readFile(filePath: string, encoding: BufferEncoding): Promise<string> {
    return fsPromises.readFile(filePath, encoding);
  }

  readdir(dirPath: string): Promise<string[]> {
    return fsPromises.readdir(dirPath);
  }

  stat(filePath: string): Promise<Stats> {
    return fsPromises.stat(filePath);
  }

  access(filePath: string): Promise<void> {
    return fsPromises.access(filePath);
  }
}

const _ENOENT_ERROR = Object.assign(new Error("ENOENT: no such file or directory"), {
  code: "ENOENT",
});

export class InMemoryFileSystem implements FileSystem {
  private readonly files: Map<string, string>;

  constructor(initial: Record<string, string> = {}) {
    this.files = new Map(Object.entries(initial));
  }

  addFile(filePath: string, content: string): void {
    this.files.set(filePath, content);
  }

  readFile(filePath: string, _encoding: BufferEncoding): Promise<string> {
    const content = this.files.get(filePath);
    if (content === undefined)
      return Promise.reject(
        Object.assign(new Error(`ENOENT: no such file or directory, open '${filePath}'`), {
          code: "ENOENT",
        })
      );
    return Promise.resolve(content);
  }

  readdir(dirPath: string): Promise<string[]> {
    const prefix = dirPath.endsWith(path.sep) ? dirPath : dirPath + path.sep;
    const entries: string[] = [];
    for (const key of this.files.keys()) {
      if (key.startsWith(prefix)) {
        const rest = key.slice(prefix.length);
        const entry = rest.split(path.sep)[0];
        if (entry && !entries.includes(entry)) entries.push(entry);
      }
    }
    return Promise.resolve(entries);
  }

  stat(filePath: string): Promise<Stats> {
    if (this.files.has(filePath)) {
      const stub = {
        isFile: () => true,
        isDirectory: () => false,
        isSymbolicLink: () => false,
        mtimeMs: 0,
        size: (this.files.get(filePath) ?? "").length,
      } as unknown as Stats;
      return Promise.resolve(stub);
    }
    const prefix = filePath.endsWith(path.sep) ? filePath : filePath + path.sep;
    const isDir = [...this.files.keys()].some((k) => k.startsWith(prefix));
    if (isDir) {
      const stub = {
        isFile: () => false,
        isDirectory: () => true,
        isSymbolicLink: () => false,
        mtimeMs: 0,
        size: 0,
      } as unknown as Stats;
      return Promise.resolve(stub);
    }
    return Promise.reject(
      Object.assign(new Error(`ENOENT: no such file or directory, stat '${filePath}'`), {
        code: "ENOENT",
      })
    );
  }

  access(filePath: string): Promise<void> {
    if (this.files.has(filePath)) return Promise.resolve();
    const prefix = filePath.endsWith(path.sep) ? filePath : filePath + path.sep;
    const hasChildren = [...this.files.keys()].some((k) => k.startsWith(prefix));
    if (hasChildren) return Promise.resolve();
    return Promise.reject(
      Object.assign(new Error(`ENOENT: no such file or directory, access '${filePath}'`), {
        code: "ENOENT",
      })
    );
  }
}
