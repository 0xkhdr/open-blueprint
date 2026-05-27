import * as fs from "node:fs";
import * as path from "node:path";

export interface SecuritySignals {
  has_auth: boolean;
  has_external_apis: boolean;
  has_secrets_manager: boolean;
  has_docker: boolean;
}

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

function detectAuth(root: string): boolean {
  // Check package.json for auth-related deps
  const pkgContent = readFile(path.join(root, "package.json"));
  if (pkgContent) {
    const authPackages = [
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
    ];
    if (authPackages.some((pkg) => pkgContent.includes(`"${pkg}"`))) return true;
  }

  // Python auth packages
  const reqContent = readFile(path.join(root, "requirements.txt"));
  if (reqContent) {
    const authPackages = [
      "passlib",
      "python-jose",
      "authlib",
      "PyJWT",
      "flask-login",
      "django-allauth",
    ];
    if (authPackages.some((pkg) => reqContent.toLowerCase().includes(pkg.toLowerCase())))
      return true;
  }

  // Check for auth-related directories
  const authDirs = ["auth", "authentication", "middleware/auth", "src/auth", "src/authentication"];
  for (const d of authDirs) {
    if (fileExists(path.join(root, d))) return true;
  }

  return false;
}

function detectExternalApis(root: string): boolean {
  const pkgContent = readFile(path.join(root, "package.json"));
  if (pkgContent) {
    const apiPackages = [
      "axios",
      "node-fetch",
      "got",
      "superagent",
      "@aws-sdk",
      "@google-cloud",
      "stripe",
      "twilio",
      "sendgrid",
    ];
    if (apiPackages.some((pkg) => pkgContent.includes(pkg))) return true;
  }

  const reqContent = readFile(path.join(root, "requirements.txt"));
  if (reqContent) {
    const apiPackages = ["requests", "httpx", "boto3", "google-cloud", "stripe", "twilio"];
    if (apiPackages.some((pkg) => reqContent.toLowerCase().includes(pkg.toLowerCase())))
      return true;
  }

  return false;
}

function detectSecretsManager(root: string): boolean {
  const pkgContent = readFile(path.join(root, "package.json"));
  if (pkgContent) {
    const secretsPackages = [
      "@aws-sdk/client-secrets-manager",
      "@google-cloud/secret-manager",
      "@azure/keyvault-secrets",
      "vault",
      "dotenv-vault",
    ];
    if (secretsPackages.some((pkg) => pkgContent.includes(pkg))) return true;
  }

  // Check for .env.vault, vault config
  const vaultFiles = [".env.vault", "vault.hcl", ".vault", ".secrets"];
  for (const f of vaultFiles) {
    if (fileExists(path.join(root, f))) return true;
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
      fileExists(path.join(root, "docker-compose.yml")),
  };
}
