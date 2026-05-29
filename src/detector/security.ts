import * as fs from "node:fs";
import * as path from "node:path";

export interface SecuritySignals {
  has_auth: boolean;
  has_external_apis: boolean;
  has_secrets_manager: boolean;
  has_docker: boolean;
  has_data_sensitive?: boolean;
  has_financial_data?: boolean;
  has_pii?: boolean;
  has_encryption?: boolean;
}

/** Packages keyed by ecosystem that signal auth usage */
const AUTH_PACKAGES: Record<string, string[]> = {
  npm: [
    "passport",
    "jsonwebtoken",
    "next-auth",
    "auth0",
    "@auth0/auth0-spa-js",
    "firebase-admin",
    "bcrypt",
    "bcryptjs",
    "argon2",
    "jose",
    "oauth",
    "openid-client",
  ],
  pip: [
    "passlib",
    "python-jose",
    "authlib",
    "PyJWT",
    "flask-login",
    "django-allauth",
    "python-oauth2",
  ],
  cargo: ["jsonwebtoken", "casbin", "actix-web-httpauth", "axum-login"],
  go: ["golang-jwt", "casbin", "go-jose", "goth"],
  maven: ["spring-security", "spring-boot-starter-security", "shiro-core"],
  composer: [
    "laravel/sanctum",
    "laravel/passport",
    "laravel/fortify",
    "laravel/breeze",
    "laravel/jetstream",
    "tymon/jwt-auth",
    "firebase/php-jwt",
  ],
};

/** Packages that signal external API calls */
const API_PACKAGES: Record<string, string[]> = {
  npm: [
    "axios",
    "node-fetch",
    "got",
    "superagent",
    "@aws-sdk",
    "@google-cloud",
    "stripe",
    "twilio",
    "sendgrid",
    "openai",
  ],
  pip: ["requests", "httpx", "boto3", "google-cloud", "stripe", "twilio", "aiohttp"],
  cargo: ["reqwest", "hyper", "ureq"],
  go: ["resty", "grpc", "google.golang.org/grpc"],
  maven: ["okhttp", "retrofit", "spring-web", "feign"],
  composer: ["guzzlehttp/guzzle", "symfony/http-client", "aws/aws-sdk-php", "google/apiclient"],
};

/** Packages/files that signal secrets management */
const SECRETS_PACKAGES: Record<string, string[]> = {
  npm: [
    "@aws-sdk/client-secrets-manager",
    "@google-cloud/secret-manager",
    "@azure/keyvault-secrets",
    "vault",
    "dotenv-vault",
  ],
  pip: ["hvac", "boto3", "google-cloud-secret-manager"],
  cargo: ["vaultrs"],
  go: ["vault/api", "github.com/hashicorp/vault"],
  composer: ["vlucas/phpdotenv", "josegonzalez/dotenv"],
};

function fileExists(filePath: string): boolean {
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function readFile(filePath: string): string | null {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return null;
  }
}

function contentMatchesAny(content: string, patterns: string[]): boolean {
  return patterns.some((p) => content.includes(p));
}

function detectAuth(root: string): boolean {
  // npm/yarn/pnpm (package.json)
  const pkg = readFile(path.join(root, "package.json"));
  if (pkg && contentMatchesAny(pkg, AUTH_PACKAGES.npm ?? [])) return true;

  // Python (requirements.txt or pyproject.toml)
  const req = readFile(path.join(root, "requirements.txt"));
  if (
    req &&
    contentMatchesAny(
      req.toLowerCase(),
      (AUTH_PACKAGES.pip ?? []).map((p) => p.toLowerCase())
    )
  )
    return true;
  const pyproject = readFile(path.join(root, "pyproject.toml"));
  if (
    pyproject &&
    contentMatchesAny(
      pyproject.toLowerCase(),
      (AUTH_PACKAGES.pip ?? []).map((p) => p.toLowerCase())
    )
  )
    return true;

  // Rust (Cargo.toml)
  const cargo = readFile(path.join(root, "Cargo.toml"));
  if (cargo && contentMatchesAny(cargo, AUTH_PACKAGES.cargo ?? [])) return true;

  // Go (go.mod)
  const goMod = readFile(path.join(root, "go.mod"));
  if (goMod && contentMatchesAny(goMod, AUTH_PACKAGES.go ?? [])) return true;

  // Java (pom.xml / build.gradle)
  const pom = readFile(path.join(root, "pom.xml"));
  if (pom && contentMatchesAny(pom, AUTH_PACKAGES.maven ?? [])) return true;
  const gradle =
    readFile(path.join(root, "build.gradle")) ?? readFile(path.join(root, "build.gradle.kts"));
  if (gradle && contentMatchesAny(gradle, AUTH_PACKAGES.maven ?? [])) return true;

  // PHP (composer.json)
  const composer = readFile(path.join(root, "composer.json"));
  if (composer && contentMatchesAny(composer, AUTH_PACKAGES.composer ?? [])) return true;

  // Auth-related directories (any language)
  const authDirs = ["auth", "authentication", "middleware/auth", "src/auth", "src/authentication"];
  for (const d of authDirs) {
    if (fileExists(path.join(root, d))) return true;
  }

  return false;
}

function detectExternalApis(root: string): boolean {
  const pkg = readFile(path.join(root, "package.json"));
  if (pkg && contentMatchesAny(pkg, API_PACKAGES.npm ?? [])) return true;

  const req = readFile(path.join(root, "requirements.txt"));
  if (
    req &&
    contentMatchesAny(
      req.toLowerCase(),
      (API_PACKAGES.pip ?? []).map((p) => p.toLowerCase())
    )
  )
    return true;
  const pyproject = readFile(path.join(root, "pyproject.toml"));
  if (
    pyproject &&
    contentMatchesAny(
      pyproject.toLowerCase(),
      (API_PACKAGES.pip ?? []).map((p) => p.toLowerCase())
    )
  )
    return true;

  const cargo = readFile(path.join(root, "Cargo.toml"));
  if (cargo && contentMatchesAny(cargo, API_PACKAGES.cargo ?? [])) return true;

  const goMod = readFile(path.join(root, "go.mod"));
  if (goMod && contentMatchesAny(goMod, API_PACKAGES.go ?? [])) return true;

  const pom = readFile(path.join(root, "pom.xml"));
  if (pom && contentMatchesAny(pom, API_PACKAGES.maven ?? [])) return true;

  const composer = readFile(path.join(root, "composer.json"));
  if (composer && contentMatchesAny(composer, API_PACKAGES.composer ?? [])) return true;

  return false;
}

function detectSecretsManager(root: string): boolean {
  const pkg = readFile(path.join(root, "package.json"));
  if (pkg && contentMatchesAny(pkg, SECRETS_PACKAGES.npm ?? [])) return true;

  const req = readFile(path.join(root, "requirements.txt"));
  if (
    req &&
    contentMatchesAny(
      req.toLowerCase(),
      (SECRETS_PACKAGES.pip ?? []).map((p) => p.toLowerCase())
    )
  )
    return true;
  const pyproject = readFile(path.join(root, "pyproject.toml"));
  if (
    pyproject &&
    contentMatchesAny(
      pyproject.toLowerCase(),
      (SECRETS_PACKAGES.pip ?? []).map((p) => p.toLowerCase())
    )
  )
    return true;

  const cargo = readFile(path.join(root, "Cargo.toml"));
  if (cargo && contentMatchesAny(cargo, SECRETS_PACKAGES.cargo ?? [])) return true;

  const goMod = readFile(path.join(root, "go.mod"));
  if (goMod && contentMatchesAny(goMod, SECRETS_PACKAGES.go ?? [])) return true;

  const composer = readFile(path.join(root, "composer.json"));
  if (composer && contentMatchesAny(composer, SECRETS_PACKAGES.composer ?? [])) return true;

  // Vault config files (any ecosystem)
  const vaultFiles = [".env.vault", "vault.hcl", ".vault", ".secrets"];
  for (const f of vaultFiles) {
    if (fileExists(path.join(root, f))) return true;
  }

  return false;
}

const SENSITIVE_CRYPTO_PACKAGES = [
  "crypto",
  "bcrypt",
  "bcryptjs",
  "argon2",
  "hash.js",
  "node:crypto",
];
const FINANCIAL_PACKAGES = [
  "stripe",
  "paypal",
  "@paypal/checkout-server-sdk",
  "braintree",
  "square",
];
const ENCRYPTION_KEYWORDS = [
  "tls",
  "ssl",
  "cipher",
  "openssl",
  "https.createServer",
  "tls.createServer",
];

function detectDataSensitive(root: string): boolean {
  const pkg = readFile(path.join(root, "package.json"));
  if (pkg && contentMatchesAny(pkg, SENSITIVE_CRYPTO_PACKAGES)) return true;
  const req = readFile(path.join(root, "requirements.txt"));
  if (req && contentMatchesAny(req.toLowerCase(), ["cryptography", "bcrypt", "hashlib"]))
    return true;
  const cargo = readFile(path.join(root, "Cargo.toml"));
  if (cargo && contentMatchesAny(cargo, ["sha2", "bcrypt", "argon2", "ring"])) return true;
  return false;
}

function detectFinancialData(root: string): boolean {
  const pkg = readFile(path.join(root, "package.json"));
  if (pkg && contentMatchesAny(pkg, FINANCIAL_PACKAGES)) return true;
  const req = readFile(path.join(root, "requirements.txt"));
  if (req && contentMatchesAny(req.toLowerCase(), ["stripe", "paypalrestsdk", "braintree"]))
    return true;
  return false;
}

function detectPII(root: string): boolean {
  const complianceFiles = [
    "GDPR.md",
    "HIPAA.md",
    "privacy-policy.md",
    "data-processing.md",
    "PRIVACY.md",
  ];
  for (const f of complianceFiles) {
    if (fileExists(path.join(root, f))) return true;
  }
  // Check for common PII-related package keywords
  const pkg = readFile(path.join(root, "package.json"));
  if (pkg && contentMatchesAny(pkg, ["gdpr", "hipaa", "pii", "personal-data"])) return true;
  return false;
}

function detectEncryption(root: string): boolean {
  const configFiles = [".ssl", "ssl.conf", "tls.conf", "nginx.conf", "openssl.cnf"];
  for (const f of configFiles) {
    if (fileExists(path.join(root, f))) return true;
  }
  // Check src for explicit TLS usage
  const indexFiles = ["src/index.ts", "src/main.ts", "src/server.ts", "index.js", "server.js"];
  for (const f of indexFiles) {
    const content = readFile(path.join(root, f));
    if (content && contentMatchesAny(content, ENCRYPTION_KEYWORDS)) return true;
  }
  return false;
}

export function detectSecurity(root: string): SecuritySignals {
  return {
    has_auth: detectAuth(root),
    has_external_apis: detectExternalApis(root),
    has_secrets_manager: detectSecretsManager(root),
    has_docker:
      fileExists(path.join(root, "Dockerfile")) ||
      fileExists(path.join(root, "docker-compose.yml")) ||
      fileExists(path.join(root, "docker-compose.yaml")),
    has_data_sensitive: detectDataSensitive(root),
    has_financial_data: detectFinancialData(root),
    has_pii: detectPII(root),
    has_encryption: detectEncryption(root),
  };
}
