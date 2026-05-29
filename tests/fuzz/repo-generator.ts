import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import fc from "fast-check";

export const fileNameArb = fc
  .string({ minLength: 1, maxLength: 40 })
  .map(s => s.replace(/[\\/:*?"<>|.\x00-\x1f]/g, "_").replace(/^_+|_+$/g, "") || "file");

export const fileContentArb = fc.string({ minLength: 0, maxLength: 500 });

export interface RandomRepo {
  root: string;
  files: string[];
}

export function generateRandomRepoSync(fileEntries: Array<[string, string]>): RandomRepo {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "bp-fuzz-"));
  const files: string[] = [];

  for (const [name, content] of fileEntries) {
    const safe = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_") || "file";
    const filePath = path.join(root, safe);
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf8");
      files.push(filePath);
    } catch {
      // skip files that can't be created
    }
  }

  // Always add a minimal package.json so detector works
  try {
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ name: "fuzz-repo", version: "1.0.0", dependencies: {} }),
      "utf8"
    );
  } catch {
    // ignore
  }

  return { root, files };
}

export function cleanupRepo(repo: RandomRepo): void {
  try {
    fs.rmSync(repo.root, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

export const repoArb = fc.array(fc.tuple(fileNameArb, fileContentArb), {
  minLength: 0,
  maxLength: 100,
});
