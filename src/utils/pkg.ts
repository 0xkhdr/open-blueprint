import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

export interface PackageInfo {
  name: string;
  version: string;
  description: string;
}

// Single source of truth for name/version: the package manifest two levels up
// from dist/utils (same root-relative layout as src/utils during tests).
const packageJsonPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../package.json"
);

let cached: PackageInfo | undefined;

export function getPackageInfo(): PackageInfo {
  if (!cached) {
    cached = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8")) as PackageInfo;
  }
  return cached;
}
