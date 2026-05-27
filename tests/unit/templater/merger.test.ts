import { describe, it, expect } from "vitest";
import {
  parseExistingFile,
  hasMarkers,
  mergeContent,
  wrapBlock,
  extractGeneratedContent,
} from "../../../src/templater/merger.js";

describe("hasMarkers", () => {
  it("returns true for generated markers", () => {
    expect(
      hasMarkers("<!-- bp-generated:begin position -->\ncontent\n<!-- bp-generated:end position -->")
    ).toBe(true);
  });

  it("returns true for preserve markers", () => {
    expect(hasMarkers("<!-- bp:preserve -->\nteam notes\n<!-- bp:end-preserve -->")).toBe(true);
  });

  it("returns false for plain content", () => {
    expect(hasMarkers("# Just a heading\n\nSome content.")).toBe(false);
  });
});

describe("parseExistingFile", () => {
  it("parses generated block", () => {
    const content = `<!-- bp-generated:begin position -->
# Position
Some content
<!-- bp-generated:end position -->`;
    const parsed = parseExistingFile(content);
    expect(parsed.generatedBlocks.has("position")).toBe(true);
    const block = parsed.generatedBlocks.get("position");
    expect(block?.content).toContain("# Position");
  });

  it("parses preserve block", () => {
    const content = `<!-- bp:preserve -->
Team notes here
<!-- bp:end-preserve -->`;
    const parsed = parseExistingFile(content);
    expect(parsed.preserveBlocks).toHaveLength(1);
    expect(parsed.preserveBlocks[0]?.content).toContain("Team notes here");
  });

  it("parses multiple blocks", () => {
    const content = `<!-- bp-generated:begin a -->
Block A
<!-- bp-generated:end a -->

<!-- bp-generated:begin b -->
Block B
<!-- bp-generated:end b -->`;
    const parsed = parseExistingFile(content);
    expect(parsed.generatedBlocks.size).toBe(2);
    expect(parsed.generatedBlocks.has("a")).toBe(true);
    expect(parsed.generatedBlocks.has("b")).toBe(true);
  });
});

describe("wrapBlock", () => {
  it("wraps content with markers", () => {
    const result = wrapBlock("position", "# My Content");
    expect(result).toContain("<!-- bp-generated:begin position -->");
    expect(result).toContain("# My Content");
    expect(result).toContain("<!-- bp-generated:end position -->");
  });
});

describe("extractGeneratedContent", () => {
  it("extracts content between markers", () => {
    const block = "<!-- bp-generated:begin pos -->\n# Content\n<!-- bp-generated:end pos -->";
    const extracted = extractGeneratedContent(block, "pos");
    expect(extracted).toBe("# Content");
  });
});

describe("mergeContent", () => {
  it("returns new content when existing has no markers", () => {
    const existing = "# Old content with no markers";
    const newContent = "# New content";
    expect(mergeContent(existing, newContent)).toBe("# New content");
  });

  it("preserves bp:preserve blocks from existing", () => {
    const existing = `<!-- bp-generated:begin pos -->
Old generated
<!-- bp-generated:end pos -->

<!-- bp:preserve -->
Team custom notes
<!-- bp:end-preserve -->`;

    const newContent = `<!-- bp-generated:begin pos -->
New generated
<!-- bp-generated:end pos -->`;

    const merged = mergeContent(existing, newContent);
    expect(merged).toContain("New generated");
    expect(merged).toContain("Team custom notes");
  });
});
