import { describe, expect, it } from "vitest";
import { hasPreserveBlock, wrapPreserve } from "../../../src/templater/merger.js";

describe("wrapPreserve", () => {
  it("wraps a plain body in preserve markers", () => {
    const out = wrapPreserve("Hello world");
    expect(out).toContain("<!-- bp:preserve -->");
    expect(out).toContain("<!-- bp:end-preserve -->");
    expect(out).toContain("Hello world");
  });

  it("preserves frontmatter bytes untouched, wrapping only the body", () => {
    const input = "---\nname: x\n---\n\nBody text\n";
    const out = wrapPreserve(input);
    expect(out.startsWith("---\nname: x\n---\n")).toBe(true);
    const afterFm = out.slice(out.indexOf("---\n", 3));
    expect(afterFm).toContain("<!-- bp:preserve -->");
    expect(afterFm).toContain("Body text");
  });

  it("is idempotent when a preserve block already exists", () => {
    const once = wrapPreserve("content");
    expect(wrapPreserve(once)).toBe(once);
  });

  it("leaves frontmatter-only files (no body) unchanged", () => {
    const input = "---\nname: x\n---\n";
    expect(wrapPreserve(input)).toBe(input);
  });

  it("hasPreserveBlock detects wrapped content", () => {
    expect(hasPreserveBlock("plain")).toBe(false);
    expect(hasPreserveBlock(wrapPreserve("plain"))).toBe(true);
  });
});
