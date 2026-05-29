import { describe, expect, it } from "vitest";
import {
  BpError,
  ConfigError,
  DetectionError,
  DriftError,
  HealthError,
  NetworkError,
  PermissionError,
  TemplateError,
  TranslationError,
  ValidationError,
} from "../../src/errors.js";

describe("BpError subclasses", () => {
  describe("BpError base", () => {
    it("is an instance of Error", () => {
      const e = new BpError("test", 1, "TEST", "Fix: test");
      expect(e).toBeInstanceOf(Error);
      expect(e).toBeInstanceOf(BpError);
    });

    it("carries exitCode, code, resolution", () => {
      const e = new BpError("msg", 5, "MY_CODE", "Fix: something");
      expect(e.exitCode).toBe(5);
      expect(e.code).toBe("MY_CODE");
      expect(e.resolution).toBe("Fix: something");
    });
  });

  describe("DetectionError", () => {
    it("exitCode is 1, name is DetectionError", () => {
      const e = new DetectionError("detection failed");
      expect(e.exitCode).toBe(1);
      expect(e.name).toBe("DetectionError");
      expect(e.message).toBe("detection failed");
    });
  });

  describe("ConfigError", () => {
    it("exitCode is 3, name is ConfigError", () => {
      const e = new ConfigError("bad config");
      expect(e.exitCode).toBe(3);
      expect(e.name).toBe("ConfigError");
    });
  });

  describe("TemplateError", () => {
    it("exitCode is 3, name is TemplateError", () => {
      const e = new TemplateError("template failed");
      expect(e.exitCode).toBe(3);
      expect(e.name).toBe("TemplateError");
    });
  });

  describe("ValidationError", () => {
    it("exitCode defaults to 4, name is ValidationError", () => {
      const e = new ValidationError("structural issue");
      expect(e.exitCode).toBe(4);
      expect(e.name).toBe("ValidationError");
    });

    it("accepts exitCode 5 for semantic failures", () => {
      const e = new ValidationError("semantic issue", 5);
      expect(e.exitCode).toBe(5);
    });
  });

  describe("DriftError", () => {
    it("exitCode is 6, name is DriftError", () => {
      const e = new DriftError("drift detected");
      expect(e.exitCode).toBe(6);
      expect(e.name).toBe("DriftError");
    });
  });

  describe("TranslationError", () => {
    it("exitCode is 7, name is TranslationError", () => {
      const e = new TranslationError("adapter failed");
      expect(e.exitCode).toBe(7);
      expect(e.name).toBe("TranslationError");
    });
  });

  describe("NetworkError", () => {
    it("exitCode is 8, name is NetworkError", () => {
      const e = new NetworkError("timeout", 3, 503);
      expect(e.exitCode).toBe(8);
      expect(e.name).toBe("NetworkError");
      expect(e.attemptCount).toBe(3);
      expect(e.lastStatusCode).toBe(503);
    });
  });

  describe("PermissionError", () => {
    it("exitCode is 9, name is PermissionError", () => {
      const e = new PermissionError("path traversal");
      expect(e.exitCode).toBe(9);
      expect(e.name).toBe("PermissionError");
    });
  });

  describe("HealthError", () => {
    it("exitCode is 10, name is HealthError", () => {
      const e = new HealthError("health check failed");
      expect(e.exitCode).toBe(10);
      expect(e.name).toBe("HealthError");
    });
  });

  describe("instanceof checks", () => {
    it("all subclasses are instanceof BpError", () => {
      const errors = [
        new DetectionError("x"),
        new ConfigError("x"),
        new TemplateError("x"),
        new ValidationError("x"),
        new DriftError("x"),
        new TranslationError("x"),
        new NetworkError("x"),
        new PermissionError("x"),
        new HealthError("x"),
      ];
      for (const e of errors) {
        expect(e).toBeInstanceOf(BpError);
        expect(e).toBeInstanceOf(Error);
      }
    });
  });
});
