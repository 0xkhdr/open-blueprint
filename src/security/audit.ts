import { createHmac, randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as fsPromises from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { getCorrelationId, logger } from "../logger.js";

export interface AuditLogEntry {
  timestamp: string;
  command: string;
  args: string[];
  user: string;
  status: "success" | "failure";
  error?: string;
  correlation_id: string;
  log_level: "debug" | "info" | "warn" | "error";
  compliance_checkpoints?: string[];
  sig: string | null;
}

const sessionId = randomUUID();

export function createCorrelationId(): string {
  return randomUUID();
}

export class AuditLogger {
  private correlationId: string;

  constructor(correlationId?: string) {
    this.correlationId = correlationId ?? sessionId;
  }

  setCorrelationId(id: string): void {
    this.correlationId = id;
  }

  async log(entry: Omit<AuditLogEntry, "timestamp" | "user" | "correlation_id" | "sig">): Promise<void> {
    const hmacKey = process.env.BP_AUDIT_HMAC_KEY ?? null;
    if (!hmacKey) {
      logger.warn("Audit HMAC key not configured; log integrity cannot be verified");
    }

    const contextCorrelationId = getCorrelationId();
    const resolvedCorrelationId =
      contextCorrelationId !== "no-correlation-id" ? contextCorrelationId : this.correlationId;

    const baseEntry: Omit<AuditLogEntry, "sig"> = {
      timestamp: new Date().toISOString(),
      user: os.userInfo().username || "unknown",
      correlation_id: resolvedCorrelationId,
      ...entry,
      log_level: entry.log_level || (entry.status === "failure" ? "error" : "info"),
    };

    const sig = hmacKey
      ? createHmac("sha256", hmacKey).update(JSON.stringify(baseEntry)).digest("hex")
      : null;

    const fullEntry: AuditLogEntry = { ...baseEntry, sig };

    const auditDir = path.join(os.homedir(), ".bp");
    const dateStr = new Date().toISOString().split("T")[0];
    const auditFile = path.join(auditDir, `audit-${dateStr}.log`);

    try {
      await fsPromises.mkdir(auditDir, { recursive: true });

      await new Promise<void>((resolve, reject) => {
        const stream = fs.createWriteStream(auditFile, { flags: "a" });
        stream.write(`${JSON.stringify(fullEntry)}\n`, "utf-8", (err) => {
          stream.end();
          if (err) reject(err);
          else resolve();
        });
      });

      const activeLink = path.join(auditDir, "audit.log");
      try {
        await fsPromises.unlink(activeLink).catch(() => {});
        await fsPromises.symlink(auditFile, activeLink);
      } catch {
        // symlink update non-critical
      }
    } catch (err) {
      logger.warn({ err }, "Audit log write failed");
    }
  }
}

const defaultAuditLogger = new AuditLogger();

export function logAudit(
  entry: Omit<AuditLogEntry, "timestamp" | "user" | "correlation_id" | "sig">
): Promise<void> {
  return defaultAuditLogger.log(entry).catch((err: unknown) => {
    logger.warn({ err }, "Audit log write failed");
  });
}
