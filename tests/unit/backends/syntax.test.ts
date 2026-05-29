import { describe, expect, it } from "vitest";
import { CommandSyntaxAdapter } from "../../../src/backends/syntax.js";

describe("CommandSyntaxAdapter", () => {
  const adapter = new CommandSyntaxAdapter();

  it("colon syntax: claude propose → /opsx:propose", () => {
    expect(adapter.getInvocation("claude", "propose")).toBe("/opsx:propose");
  });

  it("hyphen syntax: cursor propose → /opsx-propose", () => {
    expect(adapter.getInvocation("cursor", "propose")).toBe("/opsx-propose");
  });

  it("bare syntax: gemini propose → /openspec-propose", () => {
    expect(adapter.getInvocation("gemini", "propose")).toBe("/openspec-propose");
  });

  it("skill syntax: kimi propose → /skill:openspec-propose", () => {
    expect(adapter.getInvocation("kimi", "propose")).toBe("/skill:openspec-propose");
  });

  it("trae uses bare syntax", () => {
    expect(adapter.getInvocation("trae", "apply")).toBe("/openspec-apply");
  });

  it("unknown backend throws", () => {
    expect(() => adapter.getInvocation("nonexistent", "foo")).toThrow();
  });
});
