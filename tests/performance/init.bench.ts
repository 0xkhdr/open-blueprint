import { bench, describe } from "vitest";
import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

const BP_BIN = path.resolve(process.cwd(), "node_modules/.bin/tsx");
const BP_ENTRY = path.resolve(process.cwd(), "src/cli/index.ts");

function makeRepo(fileCount: number): string {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "bp-bench-"));

  for (let i = 0; i < fileCount; i++) {
    const dir = path.join(tmpDir, `src/${Math.floor(i / 100)}`);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `file-${i}.ts`), `export const x${i} = ${i};\n`);
  }

  fs.writeFileSync(
    path.join(tmpDir, "package.json"),
    JSON.stringify({ name: "bench-repo", version: "1.0.0", dependencies: {} })
  );

  return tmpDir;
}

describe("bp init performance", () => {
  bench(
    "init on 1K files",
    () => {
      const tmpDir = makeRepo(1000);
      try {
        execSync(`${BP_BIN} ${BP_ENTRY} init --tool claude`, { cwd: tmpDir, timeout: 30000 });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
    { time: 5000, iterations: 3 }
  );

  bench(
    "init on 5K files",
    () => {
      const tmpDir = makeRepo(5000);
      try {
        execSync(`${BP_BIN} ${BP_ENTRY} init --tool claude`, { cwd: tmpDir, timeout: 30000 });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
    { time: 5000, iterations: 2 }
  );

  bench(
    "init on 10K files",
    () => {
      const tmpDir = makeRepo(10000);
      try {
        execSync(`${BP_BIN} ${BP_ENTRY} init --tool claude`, { cwd: tmpDir, timeout: 60000 });
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    },
    { time: 10000, iterations: 1 }
  );
});
