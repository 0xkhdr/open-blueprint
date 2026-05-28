import { randomUUID } from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

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
}

export function createCorrelationId(): string {
  return randomUUID();
}

export function logAudit(
  entry: Omit<AuditLogEntry, "timestamp" | "user" | "correlation_id">
): void {
  const auditDir = path.join(os.homedir(), ".bp");
  const dateStr = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const auditFile = path.join(auditDir, `audit-${dateStr}.log`);

  const fullEntry: AuditLogEntry = {
    timestamp: new Date().toISOString(),
    user: os.userInfo().username || "unknown",
    correlation_id: createCorrelationId(),
    ...entry,
    log_level: entry.log_level || (entry.status === "failure" ? "error" : "info"),
  };

  try {
    if (!fs.existsSync(auditDir)) {
      fs.mkdirSync(auditDir, { recursive: true });
    }
    fs.appendFileSync(auditFile, `${JSON.stringify(fullEntry)}\n`, "utf-8");

    // Maintain symlink to active ~/.bp/audit.log
    const activeLink = path.join(auditDir, "audit.log");
    try {
      if (fs.existsSync(activeLink) || fs.lstatSync(activeLink).isSymbolicLink()) {
        fs.unlinkSync(activeLink);
      }
    } catch {
      // Ignore if doesn't exist
    }
    fs.symlinkSync(auditFile, activeLink);
  } catch {
    // Fail silently to avoid breaking main process
  }
}
