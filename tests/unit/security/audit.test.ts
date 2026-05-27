import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { logAudit } from "../../../src/security/audit.js";

describe("Security Audit Logger", () => {
  const auditDir = path.join(os.homedir(), ".bp");
  const dateStr = new Date().toISOString().split("T")[0];
  const expectedFile = path.join(auditDir, `audit-${dateStr}.log`);
  const symlinkFile = path.join(auditDir, "audit.log");

  beforeEach(() => {
    // Preserve existing active log/symlink if any by renaming temporarily
    if (fs.existsSync(expectedFile)) {
      fs.renameSync(expectedFile, expectedFile + ".bak");
    }
    if (fs.existsSync(symlinkFile)) {
      fs.unlinkSync(symlinkFile);
    }
  });

  afterEach(() => {
    // Clean up our test logs
    if (fs.existsSync(expectedFile)) {
      fs.unlinkSync(expectedFile);
    }
    if (fs.existsSync(symlinkFile)) {
      fs.unlinkSync(symlinkFile);
    }
    // Restore backup
    if (fs.existsSync(expectedFile + ".bak")) {
      fs.renameSync(expectedFile + ".bak", expectedFile);
    }
  });

  it("writes valid JSON log entries to daily file and updates symlink", () => {
    logAudit({
      command: "verify",
      args: ["--level", "all"],
      status: "success",
    });

    expect(fs.existsSync(expectedFile)).toBe(true);
    expect(fs.existsSync(symlinkFile)).toBe(true);

    const logContent = fs.readFileSync(expectedFile, "utf-8").trim();
    const parsed = JSON.parse(logContent);

    expect(parsed.command).toBe("verify");
    expect(parsed.args).toEqual(["--level", "all"]);
    expect(parsed.status).toBe("success");
    expect(parsed.timestamp).toBeDefined();
    expect(parsed.user).toBeDefined();
  });
});
