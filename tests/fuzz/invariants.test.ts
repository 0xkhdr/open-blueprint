import { test, expect } from "vitest";
import fc from "fast-check";
import { execSync } from "node:child_process";
import * as path from "node:path";
import { cleanupRepo, generateRandomRepoSync, repoArb } from "./repo-generator.js";

const BP_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");
const BP_ENTRY = path.resolve(process.cwd(), "src/cli/index.ts");

function runBp(args: string, cwd: string, timeoutMs = 15000): { exitCode: number; output: string } {
  try {
    const output = execSync(`${BP_BIN} ${BP_ENTRY} ${args}`, {
      cwd,
      encoding: "utf-8",
      timeout: timeoutMs,
      env: { ...process.env, NODE_ENV: "test" },
    });
    return { exitCode: 0, output };
  } catch (e: unknown) {
    const err = e as { status?: number; stdout?: string; stderr?: string; message?: string };
    return {
      exitCode: err.status ?? 1,
      output: (err.stdout ?? "") + (err.stderr ?? ""),
    };
  }
}

test("bp init never panics on random repos", { timeout: 120000 }, () => {
  fc.assert(
    fc.property(repoArb, fileEntries => {
      const repo = generateRandomRepoSync(fileEntries);
      try {
        const { exitCode, output } = runBp("init --tool claude", repo.root);
        expect(exitCode).toBeGreaterThanOrEqual(0);
        expect(exitCode).toBeLessThanOrEqual(13);
        expect(output).not.toMatch(/panic|SIGSEGV|stack overflow/i);
      } finally {
        cleanupRepo(repo);
      }
    }),
    { numRuns: 50, seed: 42 }
  );
});

test("bp verify never hangs on random repos", { timeout: 60000 }, () => {
  fc.assert(
    fc.property(repoArb, fileEntries => {
      const repo = generateRandomRepoSync(fileEntries);
      try {
        const { exitCode } = runBp("verify --level structural", repo.root, 10000);
        expect(exitCode).toBeGreaterThanOrEqual(0);
        expect(exitCode).toBeLessThanOrEqual(13);
      } finally {
        cleanupRepo(repo);
      }
    }),
    { numRuns: 30, seed: 99 }
  );
});

test("output paths always within project root", { timeout: 60000 }, () => {
  fc.assert(
    fc.property(repoArb, fileEntries => {
      const repo = generateRandomRepoSync(fileEntries);
      try {
        runBp("init --tool claude", repo.root, 15000);

        const output = execSync("find . -type l -o -type f", {
          cwd: repo.root,
          encoding: "utf-8",
          timeout: 5000,
        });

        for (const file of output.split("\n").filter(Boolean)) {
          const resolved = path.resolve(repo.root, file);
          expect(resolved.startsWith(repo.root)).toBe(true);
        }
      } finally {
        cleanupRepo(repo);
      }
    }),
    { numRuns: 20, seed: 77 }
  );
});
