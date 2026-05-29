import * as fs from "node:fs";
import * as path from "node:path";
import fg from "fast-glob";

export interface EnterpriseSignals {
  has_rbac_config: boolean;
  has_compliance_docs: boolean;
  has_audit_logging: boolean;
  has_dlp_scanner: boolean;
}

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function detectRBAC(root: string): boolean {
  const fileSignals = ["auth0.config", "keycloak.json"];
  if (fileSignals.some((s) => fileExists(path.join(root, s)))) return true;

  const keywords = ["casbin", "IAM", "rbac", "roles", "permissions", "policy"];
  return keywords.some((s) => {
    try {
      return fg.sync(`${root}/**/*${s}*`, { onlyFiles: true, deep: 4 }).length > 0;
    } catch {
      return false;
    }
  });
}

function detectComplianceDocs(root: string): boolean {
  const patterns = [
    "GDPR*",
    "SOC2*",
    "HIPAA*",
    "PCI*",
    "COMPLIANCE*",
    "privacy-policy*",
    "data-processing*",
  ];
  return patterns.some((p) => {
    try {
      return fg.sync(path.join(root, p)).length > 0;
    } catch {
      return false;
    }
  });
}

function detectAuditLogging(root: string): boolean {
  const pkgPath = path.join(root, "package.json");
  if (fileExists(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      const auditLibs = ["pino", "winston", "bunyan", "morgan", "datadog", "newrelic"];
      if (auditLibs.some((lib) => lib in deps)) return true;
    } catch {
      /* skip */
    }
  }

  const configFiles = ["audit.log", "cloudwatch.json", "datadog.yaml", ".newrelic.js"];
  return configFiles.some((f) => fileExists(path.join(root, f)));
}

function detectDLPScanner(root: string): boolean {
  const precommitPath = path.join(root, ".pre-commit-config.yaml");
  if (!fileExists(precommitPath)) return false;
  try {
    const content = fs.readFileSync(precommitPath, "utf-8");
    const dlpTools = ["detect-secrets", "git-secrets", "trufflehog", "gitleaks"];
    return dlpTools.some((tool) => content.includes(tool));
  } catch {
    return false;
  }
}

export function detectEnterpriseSignals(root: string): EnterpriseSignals {
  return {
    has_rbac_config: detectRBAC(root),
    has_compliance_docs: detectComplianceDocs(root),
    has_audit_logging: detectAuditLogging(root),
    has_dlp_scanner: detectDLPScanner(root),
  };
}
