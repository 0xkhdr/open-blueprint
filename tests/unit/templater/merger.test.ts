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

  it("is stable across repeated calls on the same content (no regex state)", () => {
    const content =
      "<!-- bp-generated:begin position -->\ncontent\n<!-- bp-generated:end position -->";
    // Regression test: a /g regex's lastIndex made this alternate true/false
    for (let i = 0; i < 4; i++) {
      expect(hasMarkers(content)).toBe(true);
    }
    for (let i = 0; i < 4; i++) {
      expect(hasMarkers("plain")).toBe(false);
    }
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

  it("is idempotent: re-merging the merged output changes nothing", () => {
    const existing = `<!-- bp-generated:begin pos -->
Old generated
<!-- bp-generated:end pos -->

<!-- bp:preserve -->
Team custom notes
<!-- bp:end-preserve -->`;
    const newContent = `<!-- bp-generated:begin pos -->
New generated
<!-- bp-generated:end pos -->`;

    const once = mergeContent(existing, newContent);
    const twice = mergeContent(once, newContent);
    expect(twice).toBe(once);
  });

  it("does not duplicate a preserve block already present in new content", () => {
    const preserve = "<!-- bp:preserve -->\nTeam custom notes\n<!-- bp:end-preserve -->";
    const existing = `# Doc\n\n${preserve}`;
    const newContent = `# Doc v2\n\n${preserve}`;

    const merged = mergeContent(existing, newContent);
    expect(merged.match(/bp:preserve/g)).toHaveLength(1);
  });

  it("appends every distinct preserve block from existing", () => {
    const existing = `<!-- bp:preserve -->
first note
<!-- bp:end-preserve -->
<!-- bp:preserve -->
second note
<!-- bp:end-preserve -->`;
    const merged = mergeContent(existing, "# Fresh content");
    expect(merged).toContain("first note");
    expect(merged).toContain("second note");
    expect(merged.startsWith("# Fresh content")).toBe(true);
  });
});

describe("marker edge cases", () => {
  it("parseExistingFile tolerates an unclosed generated block (consumes to EOF)", () => {
    const content = `<!-- bp-generated:begin pos -->
dangling content with no end marker`;
    const parsed = parseExistingFile(content);
    expect(parsed.generatedBlocks.get("pos")?.content).toContain("dangling content");
  });

  it("parseExistingFile tolerates an unclosed preserve block (consumes to EOF)", () => {
    const content = `<!-- bp:preserve -->
dangling preserve`;
    const parsed = parseExistingFile(content);
    expect(parsed.preserveBlocks).toHaveLength(1);
    expect(parsed.preserveBlocks[0]?.content).toContain("dangling preserve");
  });

  it("end marker of a different id does not close a block", () => {
    const content = `<!-- bp-generated:begin a -->
inside a
<!-- bp-generated:end b -->
still inside a
<!-- bp-generated:end a -->`;
    const parsed = parseExistingFile(content);
    expect(parsed.generatedBlocks.size).toBe(1);
    expect(parsed.generatedBlocks.get("a")?.content).toContain("still inside a");
  });

  it("wrapBlock and extractGeneratedContent round-trip", () => {
    const body = "# Heading\n\nbody text";
    expect(extractGeneratedContent(wrapBlock("id-1", body), "id-1")).toBe(body);
  });

  it("extractGeneratedContent returns input verbatim when markers are absent", () => {
    expect(extractGeneratedContent("no markers here", "id")).toBe("no markers here");
  });
});
