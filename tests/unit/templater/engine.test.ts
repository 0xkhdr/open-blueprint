import { describe, it, expect, beforeEach } from "vitest";
import { renderString, clearTemplateCache } from "../../../src/templater/engine.js";

describe("renderString", () => {
  beforeEach(() => {
    clearTemplateCache();
  });

  it("renders simple variable substitution", () => {
    expect(renderString("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
  });

  it("applies upper helper", () => {
    expect(renderString("{{upper name}}", { name: "hello" })).toBe("HELLO");
  });

  it("applies lower helper", () => {
    expect(renderString("{{lower name}}", { name: "HELLO" })).toBe("hello");
  });

  it("applies capitalize helper", () => {
    expect(renderString("{{capitalize name}}", { name: "hello world" })).toBe("Hello world");
  });

  it("applies kebab helper", () => {
    expect(renderString("{{kebab name}}", { name: "myProject" })).toBe("my-project");
  });

  it("applies snake helper", () => {
    expect(renderString("{{snake name}}", { name: "myProject" })).toBe("my_project");
  });

  it("applies eq helper in conditional", () => {
    const tmpl = "{{#if (eq lang 'typescript')}}TS{{else}}Other{{/if}}";
    expect(renderString(tmpl, { lang: "typescript" })).toBe("TS");
    expect(renderString(tmpl, { lang: "python" })).toBe("Other");
  });

  it("applies join helper", () => {
    expect(renderString("{{join items ', '}}", { items: ["a", "b", "c"] })).toBe("a, b, c");
  });

  it("applies default helper", () => {
    expect(renderString("{{default val 'fallback'}}", { val: "" })).toBe("fallback");
    expect(renderString("{{default val 'fallback'}}", { val: "actual" })).toBe("actual");
  });

  it("applies includes helper", () => {
    const tmpl = "{{#if (includes items 'b')}}found{{else}}not found{{/if}}";
    expect(renderString(tmpl, { items: ["a", "b", "c"] })).toBe("found");
    expect(renderString(tmpl, { items: ["a", "c"] })).toBe("not found");
  });

  it("renders empty string for missing variable (non-strict)", () => {
    expect(renderString("Hello {{missing}}!", {})).toBe("Hello !");
  });

  it("does not allow prototype pollution via context", () => {
    const malicious = { __proto__: { injected: true } } as Record<string, unknown>;
    const result = renderString("{{#if injected}}pwned{{else}}safe{{/if}}", malicious);
    expect(result).toBe("safe");
  });
});
