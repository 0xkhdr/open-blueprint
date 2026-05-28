import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detectSecurity } from "../../../src/detector/security.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-security-test-"));
}

function touchFile(dir: string, name: string, content = ""): void {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

describe("detectSecurity", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects auth from jwt package", () => {
    touchFile(tmpDir, "package.json", JSON.stringify({ dependencies: { jsonwebtoken: "9.0.0" } }));
    expect(detectSecurity(tmpDir).has_auth).toBe(true);
  });

  it("detects auth from passport package", () => {
    touchFile(tmpDir, "package.json", JSON.stringify({ dependencies: { passport: "0.6.0" } }));
    expect(detectSecurity(tmpDir).has_auth).toBe(true);
  });

  it("detects auth from auth directory", () => {
    touchFile(tmpDir, "src/auth/index.ts", "");
    expect(detectSecurity(tmpDir).has_auth).toBe(true);
  });

  it("detects external APIs from axios", () => {
    touchFile(tmpDir, "package.json", JSON.stringify({ dependencies: { axios: "1.5.0" } }));
    expect(detectSecurity(tmpDir).has_external_apis).toBe(true);
  });

  it("detects external APIs from requests in requirements.txt", () => {
    touchFile(tmpDir, "requirements.txt", "requests==2.31.0\nhttpx");
    expect(detectSecurity(tmpDir).has_external_apis).toBe(true);
  });

  it("detects Docker from Dockerfile", () => {
    touchFile(tmpDir, "Dockerfile", "FROM node:22-alpine");
    expect(detectSecurity(tmpDir).has_docker).toBe(true);
  });

  it("detects Docker from docker-compose.yml", () => {
    touchFile(tmpDir, "docker-compose.yml", "version: '3'");
    expect(detectSecurity(tmpDir).has_docker).toBe(true);
  });

  it("detects secrets manager from aws-sdk, pyproject, and requirements.txt", () => {
    touchFile(tmpDir, "package.json", JSON.stringify({ dependencies: { "@aws-sdk/client-secrets-manager": "3" } }));
    expect(detectSecurity(tmpDir).has_secrets_manager).toBe(true);

    fs.rmSync(path.join(tmpDir, "package.json"));
    touchFile(tmpDir, "pyproject.toml", "[tool.poetry.dependencies]\npasslib = '*'\nrequests = '*'\ngoogle-cloud-secret-manager = '*'\n");
    const pyprojectSignals = detectSecurity(tmpDir);
    expect(pyprojectSignals.has_auth).toBe(true);
    expect(pyprojectSignals.has_external_apis).toBe(true);
    expect(pyprojectSignals.has_secrets_manager).toBe(true);

    fs.rmSync(path.join(tmpDir, "pyproject.toml"));
    touchFile(tmpDir, "requirements.txt", "hvac==1.0.0");
    expect(detectSecurity(tmpDir).has_secrets_manager).toBe(true);
  });

  it("detects security signals from cargo, go, and maven files", () => {
    touchFile(tmpDir, "Cargo.toml", '[dependencies]\njsonwebtoken = "8"\nvaultrs = "0.6"\nreqwest = "0.11"');
    const cargoSignals = detectSecurity(tmpDir);
    expect(cargoSignals.has_auth).toBe(true);
    expect(cargoSignals.has_secrets_manager).toBe(true);
    expect(cargoSignals.has_external_apis).toBe(true);

    fs.rmSync(path.join(tmpDir, "Cargo.toml"));
    touchFile(tmpDir, "go.mod", "module test\nrequire (\n\tgithub.com/golang-jwt/jwt v4\n\tgithub.com/hashicorp/vault/api v1\n\tgithub.com/go-resty/resty/v2 v2\n)");
    const goSignals = detectSecurity(tmpDir);
    expect(goSignals.has_auth).toBe(true);
    expect(goSignals.has_secrets_manager).toBe(true);
    expect(goSignals.has_external_apis).toBe(true);

    fs.rmSync(path.join(tmpDir, "go.mod"));
    touchFile(tmpDir, "pom.xml", "<dependency><groupId>org.springframework.security</groupId><artifactId>spring-security-core</artifactId></dependency>");
    const mavenSignals = detectSecurity(tmpDir);
    expect(mavenSignals.has_auth).toBe(true);
  });

  it("returns false for all signals on empty dir", () => {
    const signals = detectSecurity(tmpDir);
    expect(signals.has_auth).toBe(false);
    expect(signals.has_external_apis).toBe(false);
    expect(signals.has_secrets_manager).toBe(false);
    expect(signals.has_docker).toBe(false);
  });
});
