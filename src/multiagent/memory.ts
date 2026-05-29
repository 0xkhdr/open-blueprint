import * as fs from "node:fs";
import * as path from "node:path";

export interface MemoryGovernanceConfig {
  retention_policy: "session" | "day" | "week" | "persistent";
  max_size_mb: number;
  encryption_at_rest: boolean;
  access_control: Array<{ agent_id: string; permission: "read" | "write" | "admin" }>;
}

export interface MemoryGovernanceResult {
  compliant: boolean;
  violations: string[];
  stats: {
    size_bytes: number;
    file_count: number;
    oldest_file_age_ms: number;
  };
}

export function enforceMemoryGovernance(
  memoryDir: string,
  config: MemoryGovernanceConfig
): MemoryGovernanceResult {
  const violations: string[] = [];

  if (!fs.existsSync(memoryDir)) {
    return {
      compliant: true,
      violations: [],
      stats: { size_bytes: 0, file_count: 0, oldest_file_age_ms: 0 },
    };
  }

  const size = getDirectorySize(memoryDir);
  if (size > config.max_size_mb * 1024 * 1024) {
    violations.push(
      `Memory directory exceeds max size: ${(size / 1024 / 1024).toFixed(2)}MB > ${config.max_size_mb}MB`
    );
  }

  if (config.encryption_at_rest && !hasEncryption(memoryDir)) {
    violations.push("Memory directory not encrypted at rest");
  }

  const files = listFilesRecursive(memoryDir);
  const now = Date.now();
  let oldestAge = 0;

  for (const file of files) {
    const stat = fs.statSync(path.join(memoryDir, file));
    const age = now - stat.mtimeMs;
    if (age > oldestAge) oldestAge = age;

    const maxAge = retentionToMs(config.retention_policy);
    if (maxAge !== Infinity && age > maxAge) {
      violations.push(`File ${file} exceeds retention policy (${config.retention_policy})`);
    }
  }

  return {
    compliant: violations.length === 0,
    violations,
    stats: {
      size_bytes: size,
      file_count: files.length,
      oldest_file_age_ms: oldestAge,
    },
  };
}

export function cleanupExpiredMemory(
  memoryDir: string,
  retentionPolicy: MemoryGovernanceConfig["retention_policy"]
): string[] {
  if (!fs.existsSync(memoryDir)) return [];

  const maxAge = retentionToMs(retentionPolicy);
  if (maxAge === Infinity) return [];

  const now = Date.now();
  const removed: string[] = [];
  const files = listFilesRecursive(memoryDir);

  for (const file of files) {
    const fullPath = path.join(memoryDir, file);
    const stat = fs.statSync(fullPath);
    if (now - stat.mtimeMs > maxAge) {
      fs.unlinkSync(fullPath);
      removed.push(file);
    }
  }

  return removed;
}

function getDirectorySize(dir: string): number {
  let total = 0;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += getDirectorySize(full);
    } else {
      total += fs.statSync(full).size;
    }
  }
  return total;
}

function hasEncryption(dir: string): boolean {
  // Check for encryption markers: .encrypted ext, .enc ext, gpg files
  const files = listFilesRecursive(dir);
  const encMarkers = [".enc", ".encrypted", ".gpg", ".asc"];
  const plainFiles = files.filter((f) => !encMarkers.some((m) => f.endsWith(m)));
  // Encrypted if all files have encryption extensions, or a .keyring file exists
  return (
    plainFiles.length === 0 ||
    fs.existsSync(path.join(dir, ".keyring")) ||
    fs.existsSync(path.join(dir, ".encrypted"))
  );
}

function listFilesRecursive(dir: string): string[] {
  const result: string[] = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = listFilesRecursive(path.join(dir, entry.name));
      result.push(...sub.map((f) => path.join(entry.name, f)));
    } else {
      result.push(entry.name);
    }
  }
  return result;
}

function retentionToMs(policy: MemoryGovernanceConfig["retention_policy"]): number {
  switch (policy) {
    case "session":
      return 24 * 60 * 60 * 1000;
    case "day":
      return 7 * 24 * 60 * 60 * 1000;
    case "week":
      return 30 * 24 * 60 * 60 * 1000;
    case "persistent":
      return Infinity;
  }
}
