/**
 * Idempotent block merging via <!-- bp-generated:begin ID --> markers.
 * ADR-007: block-level merge, not full-file regeneration.
 */

const BEGIN_PATTERN = /<!--\s*bp-generated:begin\s+(\S+)\s*-->/g;
const END_PATTERN = /<!--\s*bp-generated:end\s+(\S+)\s*-->/;
const PRESERVE_BEGIN = /<!--\s*bp:preserve\s*-->/;
const PRESERVE_END = /<!--\s*bp:end-preserve\s*-->/;

export interface GeneratedBlock {
  id: string;
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface PreserveBlock {
  content: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedFile {
  generatedBlocks: Map<string, GeneratedBlock>;
  preserveBlocks: PreserveBlock[];
  rawContent: string;
}

export function parseExistingFile(content: string): ParsedFile {
  const generatedBlocks = new Map<string, GeneratedBlock>();
  const preserveBlocks: PreserveBlock[] = [];
  const lines = content.split("\n");

  let i = 0;
  while (i < lines.length) {
    const line = lines[i] ?? "";

    // Check for generated block begin
    const beginMatch = line.match(/<!--\s*bp-generated:begin\s+(\S+)\s*-->/);
    if (beginMatch) {
      const id = beginMatch[1];
      if (id === undefined) {
        i++;
        continue;
      }
      const startLine = i;
      const blockLines: string[] = [line];
      i++;

      while (i < lines.length) {
        const currentLine = lines[i] ?? "";
        blockLines.push(currentLine);
        const endMatch = currentLine.match(/<!--\s*bp-generated:end\s+(\S+)\s*-->/);
        if (endMatch && endMatch[1] === id) {
          break;
        }
        i++;
      }

      const blockContent = blockLines.join("\n");
      const startIndex = lines.slice(0, startLine).join("\n").length;
      const endIndex = startIndex + blockContent.length;

      generatedBlocks.set(id, {
        id,
        content: blockContent,
        startIndex,
        endIndex,
      });
      i++;
      continue;
    }

    // Check for preserve block begin
    if (PRESERVE_BEGIN.test(line)) {
      const startLine = i;
      const blockLines: string[] = [line];
      i++;

      while (i < lines.length) {
        const currentLine = lines[i] ?? "";
        blockLines.push(currentLine);
        if (PRESERVE_END.test(currentLine)) break;
        i++;
      }

      const blockContent = blockLines.join("\n");
      const startIndex = lines.slice(0, startLine).join("\n").length;
      const endIndex = startIndex + blockContent.length;

      preserveBlocks.push({ content: blockContent, startIndex, endIndex });
      i++;
      continue;
    }

    i++;
  }

  return { generatedBlocks, preserveBlocks, rawContent: content };
}

export function hasMarkers(content: string): boolean {
  return BEGIN_PATTERN.test(content) || PRESERVE_BEGIN.test(content);
}

// Reset lastIndex after test
BEGIN_PATTERN.lastIndex = 0;

export function mergeContent(existingContent: string, newContent: string): string {
  const parsed = parseExistingFile(existingContent);

  if (parsed.generatedBlocks.size === 0 && parsed.preserveBlocks.length === 0) {
    // No markers in existing — return new content as-is
    return newContent;
  }

  // Replace generated blocks in new content with updated versions,
  // and inject preserve blocks from existing into new content
  let result = newContent;

  // Preserve blocks from existing file: keep them exactly as-is
  // They should already appear in newContent from the template or be appended
  for (const preserveBlock of parsed.preserveBlocks) {
    // Check if preserve block appears in new content already
    if (!result.includes(preserveBlock.content)) {
      result = `${result}\n\n${preserveBlock.content}`;
    }
  }

  return result;
}

export function wrapBlock(id: string, content: string): string {
  return `<!-- bp-generated:begin ${id} -->\n${content}\n<!-- bp-generated:end ${id} -->`;
}

export function extractGeneratedContent(block: string, id: string): string {
  const beginMarker = `<!-- bp-generated:begin ${id} -->`;
  const endMarker = `<!-- bp-generated:end ${id} -->`;
  const start = block.indexOf(beginMarker);
  const end = block.indexOf(endMarker);
  if (start === -1 || end === -1) return block;
  return block.slice(start + beginMarker.length, end).trim();
}

// Suppress unused import warnings
void END_PATTERN;
