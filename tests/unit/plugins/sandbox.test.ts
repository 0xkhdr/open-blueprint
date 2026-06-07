import * as vm from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { createPluginContext, type PluginAPI } from "../../../src/plugins/sandbox.js";

function makeApi(): PluginAPI {
  return {
    validate: vi.fn(),
    log: vi.fn(),
    error: vi.fn(),
  };
}

describe("createPluginContext", () => {
  it("routes console.log/warn to api.log and console.error to api.error", () => {
    const api = makeApi();
    const ctx = createPluginContext(api);
    vm.runInContext("console.log('hi'); console.warn('careful'); console.error('boom');", ctx);
    expect(api.log).toHaveBeenCalledWith("hi");
    expect(api.log).toHaveBeenCalledWith("careful");
    expect(api.error).toHaveBeenCalledWith("boom");
  });

  it("exposes validate bound to the api", () => {
    const api = makeApi();
    const ctx = createPluginContext(api);
    vm.runInContext("validate({ message: 'x' });", ctx);
    expect(api.validate).toHaveBeenCalledWith({ message: "x" });
  });

  it("denies access to dangerous host globals", () => {
    const api = makeApi();
    const ctx = createPluginContext(api);
    for (const dangerous of ["process", "require", "Buffer", "fetch", "globalThis"]) {
      expect(vm.runInContext(`typeof ${dangerous} === 'undefined' || ${dangerous} === undefined`, ctx)).toBe(
        true
      );
    }
  });
});
