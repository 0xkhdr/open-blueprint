import type { ValidationError } from "../validator/structural.js";

const SECRET_PATTERNS = [
  {
    name: "JSON Web Token (JWT)",
    regex: /\beyJhbGciOi[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\.[a-zA-Z0-9-_]+\b/i,
    resolution: "Revoke this token and replace it with a reference to a secrets manager.",
  },
  {
    name: "Generic Secret/API Key",
    regex:
      /\b(?:api_key|secret_key|password|passwd|auth_token)\s*[:=]\s*['"`][a-zA-Z0-9-_]{16,}['"`]/i,
    resolution: "Do not hardcode authentication credentials. Move them to environment variables.",
  },
  {
    name: "Google API Key",
    regex: /\bAIzaSy[a-zA-Z0-9-_]{33}\b/i,
    resolution: "Revoke the Google API Key and set it as a gitignored secure credential.",
  },
  {
    name: "GitHub Token",
    regex: /\bgh[oprs]_[a-zA-Z0-9]{36,251}\b/i,
    resolution: "Revoke the GitHub Personal Access Token immediately.",
  },
  {
    name: "AWS Access Key",
    regex: /\bAKIA[0-9A-Z]{16}\b/i,
    resolution: "Revoke the AWS credentials immediately.",
  },
  {
    name: "Slack Token",
    regex: /\bxox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9-_]{24,34}\b/i,
    resolution: "Revoke the Slack token immediately. A compromised token can be used to access Slack workspace.",
  },
  {
    name: "Azure Storage SAS Token",
    regex: /sv=\d{4}-\d{2}-\d{2}[&a-zA-Z0-9-_=]{50,}/i,
    resolution: "Revoke the Azure SAS token immediately to prevent unauthorized storage access.",
  },
  {
    name: "SSH Private Key",
    regex: /-----BEGIN[ A-Z0-9_-]*(?:RSA|DSA|OPENSSH|EC|PGP|ENCRYPTED)[ A-Z0-9_-]*PRIVATE KEY[^-]*-----/i,
    resolution: "SSH private keys must never be committed. Revoke and rotate keys, use ssh-agent or key management system.",
  },
  {
    name: "Bearer Token",
    regex: /\b[Bb]earer\s+[A-Za-z0-9+/]{20,}(?:[=]{0,2})\b/i,
    resolution: "Bearer tokens in code are security risks. Store tokens in environment variables or secrets managers.",
  },
];

export function scanForSecrets(filePath: string, content: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    for (const pattern of SECRET_PATTERNS) {
      if (pattern.regex.test(line)) {
        errors.push({
          file: filePath,
          line: i + 1,
          type: "SECRET_LEAK_DETECTED",
          severity: "error",
          message: `Leaked ${pattern.name} detected inside generated output!`,
          resolution: pattern.resolution,
        });
      }
    }
  }

  return errors;
}
