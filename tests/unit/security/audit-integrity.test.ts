import { createHmac } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditLogger } from "../../../src/security/audit.js";
import { runWithCorrelationId } from "../../../src/logger.js";

const auditDir = path.join(os.homedir(), ".bp");
const dateStr = new Date().toISOString().split("T")[0];
const auditFile = path.join(auditDir, `audit-${dateStr}.log`);
const symlinkFile = path.join(auditDir, "audit.log");

function cleanup() {
  if (fs.existsSync(auditFile)) fs.unlinkSync(auditFile);
  try {
    if (fs.lstatSync(symlinkFile).isSymbolicLink()) fs.unlinkSync(symlinkFile);
  } catch {
    // absent
  }
}

describe("audit-integrity", () => {
  beforeEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllEnvs();
  });

  it("HMAC key set — entry sig matches HMAC-SHA256 over entry without sig field", async () => {
    vi.stubEnv("BP_AUDIT_HMAC_KEY", "abc123");
    const al = new AuditLogger("req-hmac");
    await al.log({ command: "test", args: [], status: "success", log_level: "info" });

    const raw = fs.readFileSync(auditFile, "utf-8").trim();
    const entry = JSON.parse(raw) as Record<string, unknown>;
    const { sig, ...rest } = entry;

    const expected = createHmac("sha256", "abc123").update(JSON.stringify(rest)).digest("hex");
    expect(sig).toBe(expected);
  });

  it("HMAC key not set — sig is null and entry is written", async () => {
    vi.stubEnv("BP_AUDIT_HMAC_KEY", undefined);
    const al = new AuditLogger("req-nosig");
    await al.log({ command: "test", args: [], status: "success", log_level: "info" });

    const raw = fs.readFileSync(auditFile, "utf-8").trim();
    const entry = JSON.parse(raw) as Record<string, unknown>;
    expect(entry.sig).toBeNull();
  });

  it("tampered entry yields different HMAC than stored sig", async () => {
    vi.stubEnv("BP_AUDIT_HMAC_KEY", "abc123");
    const al = new AuditLogger("req-tamper");
    await al.log({ command: "verify", args: [], status: "success", log_level: "info" });

    const raw = fs.readFileSync(auditFile, "utf-8").trim();
    const entry = JSON.parse(raw) as Record<string, unknown>;
    const storedSig = entry.sig as string;

    const tampered = { ...entry, command: "evil" };
    const { sig: _sig, ...rest } = tampered;
    const recomputed = createHmac("sha256", "abc123").update(JSON.stringify(rest)).digest("hex");
    expect(recomputed).not.toBe(storedSig);
  });

  it("correlation ID propagates to all entries for a command", async () => {
    vi.stubEnv("BP_AUDIT_HMAC_KEY", undefined);
    const al = new AuditLogger("req-abc");
    await al.log({ command: "init", args: [], status: "success", log_level: "info" });
    await al.log({ command: "init", args: ["step2"], status: "success", log_level: "info" });

    const lines = fs.readFileSync(auditFile, "utf-8").trim().split("\n");
    for (const line of lines) {
      const entry = JSON.parse(line) as Record<string, unknown>;
      expect(entry.correlation_id).toBe("req-abc");
    }
  });

  it("AuditLogger without correlation ID falls back to session-scoped UUID", async () => {
    vi.stubEnv("BP_AUDIT_HMAC_KEY", undefined);
    const al = new AuditLogger();
    await al.log({ command: "cmd1", args: [], status: "success", log_level: "info" });
    await al.log({ command: "cmd2", args: [], status: "success", log_level: "info" });

    const lines = fs.readFileSync(auditFile, "utf-8").trim().split("\n");
    const ids = lines.map((l) => (JSON.parse(l) as Record<string, unknown>).correlation_id);
    expect(ids[0]).toBe(ids[1]);
    expect(typeof ids[0]).toBe("string");
  });

  it("setCorrelationId updates future entries", async () => {
    vi.stubEnv("BP_AUDIT_HMAC_KEY", undefined);
    const al = new AuditLogger("original");
    await al.log({ command: "a", args: [], status: "success", log_level: "info" });
    al.setCorrelationId("updated");
    await al.log({ command: "b", args: [], status: "success", log_level: "info" });

    const lines = fs.readFileSync(auditFile, "utf-8").trim().split("\n");
    expect((JSON.parse(lines[0]!) as Record<string, unknown>).correlation_id).toBe("original");
    expect((JSON.parse(lines[1]!) as Record<string, unknown>).correlation_id).toBe("updated");
  });

  it("correlation ID from runWithCorrelationId context takes precedence", async () => {
    vi.stubEnv("BP_AUDIT_HMAC_KEY", undefined);
    const al = new AuditLogger("fallback-id");

    await runWithCorrelationId("context-id", async () => {
      await al.log({ command: "cmd", args: [], status: "success", log_level: "info" });
    });

    const raw = fs.readFileSync(auditFile, "utf-8").trim();
    const entry = JSON.parse(raw) as Record<string, unknown>;
    expect(entry.correlation_id).toBe("context-id");
  });
});
