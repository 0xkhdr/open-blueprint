import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { getCorrelationId, initCorrelationId, runWithCorrelationId } from "../../src/logger.js";

describe("logger", () => {
  describe("correlation ID", () => {
    it("returns no-correlation-id outside a run context", () => {
      expect(getCorrelationId()).toBe("no-correlation-id");
    });

    it("returns the injected correlation ID inside runWithCorrelationId", () => {
      const id = initCorrelationId();
      runWithCorrelationId(id, () => {
        expect(getCorrelationId()).toBe(id);
      });
    });

    it("correlation ID is a valid UUID format", () => {
      const id = initCorrelationId();
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    });

    it("each initCorrelationId call returns a unique ID", () => {
      const id1 = initCorrelationId();
      const id2 = initCorrelationId();
      expect(id1).not.toBe(id2);
    });

    it("nested contexts restore outer correlation ID", () => {
      const outer = "outer-id";
      const inner = "inner-id";
      runWithCorrelationId(outer, () => {
        expect(getCorrelationId()).toBe(outer);
        runWithCorrelationId(inner, () => {
          expect(getCorrelationId()).toBe(inner);
        });
        expect(getCorrelationId()).toBe(outer);
      });
    });
  });

  describe("level control", () => {
    it("logger is importable and has expected methods", async () => {
      const { logger } = await import("../../src/logger.js");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.debug).toBe("function");
    });
  });
});
