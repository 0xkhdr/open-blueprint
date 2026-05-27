import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { detectFrameworks } from "../../../src/detector/frameworks.js";

function createTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "bp-fw-test-"));
}

function touchFile(dir: string, name: string, content = ""): void {
  const filePath = path.join(dir, name);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writePackageJson(dir: string, deps: Record<string, string>): void {
  touchFile(dir, "package.json", JSON.stringify({ dependencies: deps }));
}

describe("detectFrameworks", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = createTmpDir();
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("detects Next.js from dep + config", () => {
    writePackageJson(tmpDir, { next: "14.0.0" });
    touchFile(tmpDir, "next.config.ts", "");
    const fw = detectFrameworks(tmpDir);
    const nextjs = fw.find((f) => f.name === "nextjs");
    expect(nextjs).toBeDefined();
    expect(nextjs?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects React from dep", () => {
    writePackageJson(tmpDir, { react: "18.0.0" });
    const fw = detectFrameworks(tmpDir);
    const react = fw.find((f) => f.name === "react");
    expect(react).toBeDefined();
    expect(react?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects Express from dep + server file", () => {
    writePackageJson(tmpDir, { express: "4.18.0" });
    touchFile(tmpDir, "src/server.js", "");
    const fw = detectFrameworks(tmpDir);
    const express = fw.find((f) => f.name === "express");
    expect(express).toBeDefined();
    expect(express?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects NestJS from dep + main.ts", () => {
    writePackageJson(tmpDir, { "@nestjs/core": "10.0.0" });
    touchFile(tmpDir, "src/main.ts", "");
    const fw = detectFrameworks(tmpDir);
    const nestjs = fw.find((f) => f.name === "nestjs");
    expect(nestjs).toBeDefined();
    expect(nestjs?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects FastAPI from requirements.txt", () => {
    touchFile(tmpDir, "requirements.txt", "fastapi==0.100.0\npydantic");
    const fw = detectFrameworks(tmpDir);
    const fastapi = fw.find((f) => f.name === "fastapi");
    expect(fastapi).toBeDefined();
    expect(fastapi?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects Django from manage.py", () => {
    touchFile(tmpDir, "manage.py", "#!/usr/bin/env python");
    const fw = detectFrameworks(tmpDir);
    const django = fw.find((f) => f.name === "django");
    expect(django).toBeDefined();
    expect(django?.confidence).toBeGreaterThanOrEqual(0.9);
  });

  it("detects Axum from Cargo.toml", () => {
    touchFile(tmpDir, "Cargo.toml", '[dependencies]\naxum = "0.7"');
    const fw = detectFrameworks(tmpDir);
    const axum = fw.find((f) => f.name === "axum");
    expect(axum).toBeDefined();
    expect(axum?.confidence).toBeGreaterThanOrEqual(0.8);
  });

  it("detects Spring Boot from pom.xml", () => {
    touchFile(tmpDir, "pom.xml", "<dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>");
    const fw = detectFrameworks(tmpDir);
    const spring = fw.find((f) => f.name === "spring-boot");
    expect(spring).toBeDefined();
  });

  it("returns empty for blank project", () => {
    const fw = detectFrameworks(tmpDir);
    expect(fw).toEqual([]);
  });

  it("returns sorted by confidence descending", () => {
    writePackageJson(tmpDir, { next: "14.0.0", react: "18.0.0" });
    touchFile(tmpDir, "next.config.ts", "");
    const fw = detectFrameworks(tmpDir);
    for (let i = 0; i < fw.length - 1; i++) {
      const a = fw[i];
      const b = fw[i + 1];
      if (a !== undefined && b !== undefined) {
        expect(a.confidence).toBeGreaterThanOrEqual(b.confidence);
      }
    }
  });
});
