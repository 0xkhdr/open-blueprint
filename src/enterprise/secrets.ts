import * as fs from "node:fs";
import * as path from "node:path";

export interface SecretPattern {
  name: string;
  pattern: RegExp;
  severity: "critical" | "high" | "medium";
  example: string;
}

export const SECRET_PATTERNS: SecretPattern[] = [
  {
    name: "AWS Access Key ID",
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: "critical",
    example: "AKIAIOSFODNN7EXAMPLE",
  },
  {
    name: "AWS Secret Access Key",
    pattern: /(?<![A-Za-z0-9/+])[A-Za-z0-9/+]{40}(?![A-Za-z0-9/+])/g,
    severity: "critical",
    example: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  },
  {
    name: "GitHub Personal Access Token",
    pattern: /gh[pousr]_[A-Za-z0-9_]{36}/g,
    severity: "critical",
    example: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  },
  {
    name: "JWT Token",
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+/g,
    severity: "high",
    example: "eyJhbGciOiJIUzI1NiIs...",
  },
  {
    name: "Private Key",
    pattern: /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g,
    severity: "critical",
    example: "-----BEGIN RSA PRIVATE KEY-----",
  },
  {
    name: "Slack Token",
    pattern: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}(?:-[a-zA-Z0-9]{24})?/g,
    severity: "high",
    example: "xoxb-your-slack-token-here",
  },
  {
    name: "Generic API Key",
    pattern: /[a-zA-Z_][a-zA-Z0-9_]*[_-][kK]ey\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/g,
    severity: "medium",
    example: "api_key = 'abcdef1234567890abcdef1234567890'",
  },
  {
    name: "Database Connection String",
    pattern: /(?:mongodb|mysql|postgres|redis):\/\/[^\s"']+/gi,
    severity: "high",
    example: "mongodb://user:pass@host:27017/db",
  },
];

export interface SecretFinding {
  pattern: string;
  file: string;
  line: number;
  column: number;
  match: string;
  severity: "critical" | "high" | "medium";
}

export function scanForSecrets(projectRoot: string): SecretFinding[] {
  const findings: SecretFinding[] = [];
  const files = collectTextFiles(projectRoot);

  for (const file of files) {
    let content: string;
    try {
      content = fs.readFileSync(file, "utf-8");
    } catch {
      continue;
    }
    const lines = content.split("\n");

    for (let lineNum = 0; lineNum < lines.length; lineNum++) {
      const line = lines[lineNum] ?? "";
      for (const secret of SECRET_PATTERNS) {
        const re = new RegExp(secret.pattern.source, secret.pattern.flags);
        const matches = line.matchAll(re);
        for (const match of matches) {
          if (match.index !== undefined) {
            findings.push({
              pattern: secret.name,
              file: path.relative(projectRoot, file),
              line: lineNum + 1,
              column: match.index + 1,
              match: match[0],
              severity: secret.severity,
            });
          }
        }
      }
    }
  }

  return findings;
}

export function collectTextFiles(root: string): string[] {
  const extensions = new Set([
    ".md",
    ".json",
    ".yaml",
    ".yml",
    ".ts",
    ".js",
    ".py",
    ".go",
    ".rs",
    ".java",
    ".rb",
    ".env",
    ".sh",
    ".toml",
    ".ini",
    ".cfg",
    ".pem",
    ".key",
    ".crt",
    ".cer",
  ]);
  const files: string[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["node_modules", ".git", "dist", ".next", "build", "coverage"].includes(entry.name))
          continue;
        walk(fullPath);
      } else if (extensions.has(path.extname(entry.name).toLowerCase())) {
        files.push(fullPath);
      }
    }
  }

  walk(root);
  return files;
}
