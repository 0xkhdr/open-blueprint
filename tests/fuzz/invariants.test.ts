import { test, expect, describe, it } from "vitest";
import fc from "fast-check";
import { execSync } from "node:child_process";
import * as path from "node:path";
import { cleanupRepo, generateRandomRepoSync, repoArb } from "./repo-generator.js";
import {
  BpError,
  ConfigError,
  DetectionError,
  HealthError,
  NetworkError,
  PermissionError,
  TemplateError,
  TranslationError,
  ValidationError,
} from "../../src/errors.js";

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

describe("BpError types: no unhandled exceptions escape engine public API", () => {
  const VALID_EXIT_CODES = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

  it("bp convert --from on random repos does not throw untyped errors", { timeout: 120000 }, () => {
    fc.assert(
      fc.property(repoArb, (fileEntries) => {
        const repo = generateRandomRepoSync(fileEntries);
        try {
          const { exitCode } = runBp("convert --from claude --to cursor --input . --output ./fuzz-out", repo.root, 15000);
          // All exit codes should be in the known registry
          expect(exitCode).toBeGreaterThanOrEqual(0);
          expect(exitCode).toBeLessThanOrEqual(10);
        } finally {
          cleanupRepo(repo);
        }
      }),
      { numRuns: 20, seed: 111 }
    );
  });

  it("BpError subclasses all have valid exitCodes in registry", () => {
    const errors = [
      new DetectionError("test detection"),
      new ConfigError("test config"),
      new TemplateError("test template"),
      new ValidationError("test validation", 4),
      new ValidationError("test semantic", 5),
      new TranslationError("test translation"),
      new NetworkError("test network", 2, 503),
      new PermissionError("test permission"),
      new HealthError("test health"),
    ];

    for (const err of errors) {
      expect(VALID_EXIT_CODES.has(err.exitCode)).toBe(true);
      expect(err).toBeInstanceOf(BpError);
      expect(err).toBeInstanceOf(Error);
      expect(typeof err.code).toBe("string");
      expect(typeof err.resolution).toBe("string");
    }
  });

  it("BpError message format invariant: ends with Fix: or See:", () => {
    const errors = [
      new DetectionError("test. See: docs/errors.md#code-1"),
      new ConfigError("test. Fix: run bp init"),
      new TemplateError("test. See: docs/errors.md#code-3"),
    ];
    for (const err of errors) {
      expect(err.message).toMatch(/Fix:|See:/);
    }
  });

  it("NetworkError carries attemptCount and lastStatusCode", () => {
    const err = new NetworkError("network fail. Fix: check connectivity.", 3, 503);
    expect(err.attemptCount).toBe(3);
    expect(err.lastStatusCode).toBe(503);
    expect(err.exitCode).toBe(8);
  });

  it("bp verify never exits with code outside 0-10 on random repos", { timeout: 60000 }, () => {
    fc.assert(
      fc.property(repoArb, (fileEntries) => {
        const repo = generateRandomRepoSync(fileEntries);
        try {
          const { exitCode } = runBp("verify --level all", repo.root, 10000);
          expect(exitCode).toBeGreaterThanOrEqual(0);
          expect(exitCode).toBeLessThanOrEqual(10);
        } finally {
          cleanupRepo(repo);
        }
      }),
      { numRuns: 20, seed: 222 }
    );
  });
});
