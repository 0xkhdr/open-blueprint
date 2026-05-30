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
    resolution:
      "Revoke the Slack token immediately. A compromised token can be used to access Slack workspace.",
  },
  {
    name: "Azure Storage SAS Token",
    regex: /sv=\d{4}-\d{2}-\d{2}[&a-zA-Z0-9-_=]{50,}/i,
    resolution: "Revoke the Azure SAS token immediately to prevent unauthorized storage access.",
  },
  {
    name: "SSH Private Key",
    regex:
      /-----BEGIN[ A-Z0-9_-]*(?:RSA|DSA|OPENSSH|EC|PGP|ENCRYPTED)[ A-Z0-9_-]*PRIVATE KEY[^-]*-----/i,
    resolution:
      "SSH private keys must never be committed. Revoke and rotate keys, use ssh-agent or key management system.",
  },
  {
    name: "Bearer Token",
    regex: /\b[Bb]earer\s+[A-Za-z0-9+/]{20,}(?:[=]{0,2})\b/i,
    resolution:
      "Bearer tokens in code are security risks. Store tokens in environment variables or secrets managers.",
  },
];

// ---- Entropy scanning -------------------------------------------------------

const ENTROPY_THRESHOLD = 4.5;
const MIN_TOKEN_LENGTH = 20;
const MIN_BASE64_DECODED_BYTES = 32;

const COMMON_WORDS = new Set([
  "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
  "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
  "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
  "an", "will", "my", "one", "all", "would", "there", "their", "what",
  "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
  "when", "make", "can", "like", "time", "no", "just", "him", "know",
  "take", "people", "into", "year", "your", "good", "some", "could",
  "them", "see", "other", "than", "then", "now", "look", "only", "come",
  "its", "over", "think", "also", "back", "after", "use", "two", "how",
  "our", "work", "first", "well", "way", "even", "new", "want", "because",
  "any", "these", "give", "day", "most", "us", "great", "between",
  "need", "large", "often", "hand", "high", "place", "hold", "true",
  "password", "secret", "token", "apikey", "config", "settings", "default",
  "example", "localhost", "username", "admin", "public", "private",
  "access", "key", "value", "name", "type", "path", "file", "data",
  "string", "number", "boolean", "object", "array", "null", "undefined",
  "function", "return", "import", "export", "class", "const", "let",
  "var", "async", "await", "true", "false", "error", "message", "status",
  "result", "response", "request", "header", "content", "body", "query",
  "param", "option", "index", "count", "size", "length", "width", "height",
  "color", "style", "theme", "mode", "user", "email", "phone", "address",
  "version", "update", "create", "delete", "select", "insert", "where",
  "order", "group", "limit", "offset", "table", "column", "row", "join",
  "left", "right", "inner", "outer", "primary", "foreign", "unique",
  "index", "constraint", "schema", "database", "server", "client",
  "host", "port", "protocol", "https", "http", "ftp", "ssh", "tcp", "udp",
  "json", "yaml", "xml", "html", "css", "sql", "api", "url", "uri",
  "uuid", "hash", "salt", "nonce", "cipher", "encode", "decode",
  "encrypt", "decrypt", "sign", "verify", "auth", "oauth", "jwt",
  "bearer", "cookie", "session", "cache", "queue", "stack", "heap",
  "thread", "process", "service", "module", "package", "library",
  "framework", "component", "interface", "abstract", "extends", "implements",
]);

export function computeShannonEntropy(token: string): number {
  if (token.length === 0) return 0;
  const freq = new Map<string, number>();
  for (const ch of token) {
    freq.set(ch, (freq.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / token.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

function isRepeatedChar(token: string): boolean {
  return new Set(token).size <= 1;
}

function isShortBase64(token: string): boolean {
  if (!/^[A-Za-z0-9+/]+=*$/.test(token)) return false;
  try {
    const decoded = Buffer.from(token, "base64");
    return decoded.length < MIN_BASE64_DECODED_BYTES;
  } catch {
    return false;
  }
}

function isCommonWord(token: string): boolean {
  const lower = token.toLowerCase();
  if (COMMON_WORDS.has(lower)) return true;
  // Check if the token is composed only of dictionary words (simple heuristic)
  return lower.split(/[^a-z]/i).every((part) => part.length === 0 || COMMON_WORDS.has(part));
}

const TOKEN_RE = /[A-Za-z0-9+/!@#%^&*\-_=]{20,}/g;

export interface ScanOptions {
  entropyEnabled?: boolean;
}

export function scanContent(
  filePath: string,
  content: string,
  options: ScanOptions = {}
): ValidationError[] {
  const errors: ValidationError[] = [];
  const lines = content.split("\n");

  // Track positions matched by regex patterns to avoid double-reporting
  const regexMatchedPositions = new Set<string>();

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
        regexMatchedPositions.add(`${i + 1}`);
      }
    }

    if (options.entropyEnabled) {
      let match: RegExpExecArray | null;
      TOKEN_RE.lastIndex = 0;
      while ((match = TOKEN_RE.exec(line)) !== null) {
        const token = match[0];
        if (
          token.length < MIN_TOKEN_LENGTH ||
          isRepeatedChar(token) ||
          isCommonWord(token) ||
          isShortBase64(token)
        ) {
          continue;
        }
        const entropy = computeShannonEntropy(token);
        if (entropy >= ENTROPY_THRESHOLD) {
          const lineKey = `${i + 1}`;
          if (!regexMatchedPositions.has(lineKey)) {
            errors.push({
              file: filePath,
              line: i + 1,
              type: "HIGH_ENTROPY_STRING",
              severity: "warning",
              message: `High-entropy string detected (entropy: ${entropy.toFixed(2)} bits/char)`,
              resolution:
                "If this is a secret or credential, move it to a secrets manager or environment variable.",
            });
          }
          break; // one finding per line for entropy
        }
      }
    }
  }

  return errors;
}

export function scanForSecrets(
  filePath: string,
  content: string,
  options: ScanOptions = {}
): ValidationError[] {
  return scanContent(filePath, content, options);
}
