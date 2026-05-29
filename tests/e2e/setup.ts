import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execSync } from "node:child_process";

export const BP_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");
export const BP_ENTRY = path.resolve(process.cwd(), "src/cli/index.ts");
export const FIXTURES_DIR = path.resolve(process.cwd(), "tests/fixtures");

export interface BpResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

export function runBp(args: string, cwd: string, timeoutMs = 30000): BpResult {
  try {
    const stdout = execSync(`${BP_BIN} ${BP_ENTRY} ${args}`, {
      cwd,
      encoding: "utf-8",
      timeout: timeoutMs,
      env: { ...process.env, NODE_ENV: "test", NO_COLOR: "1" },
    });
    return { exitCode: 0, stdout, stderr: "" };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string };
    return {
      exitCode: err.status ?? 1,
      stdout: err.stdout ?? "",
      stderr: err.stderr ?? "",
    };
  }
}

export function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-e2e-"));
}

export function copyFixture(fixtureName: string, destDir: string): void {
  const src = path.join(FIXTURES_DIR, fixtureName);
  copyRecursive(src, destDir);
}

function copyRecursive(src: string, dest: string): void {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}
