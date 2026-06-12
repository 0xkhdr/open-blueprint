/**
 * Text normalization helpers for comparison.
 *
 * Governance files are authored by humans across editors with differing
 * conventions (CRLF vs LF, trailing whitespace, soft-wrap reflow). Comparing
 * raw bytes therefore reports cosmetic edits as semantic changes. These
 * helpers canonicalize prose before comparison so that only meaningful
 * differences surface.
 */

export interface NormalizeOptions {
  /**
   * Fold case when true. Defaults to `false` so that governance prose retains
   * capitalization fidelity (e.g. "MUST" vs "must" remains a reportable
   * change). Behavioral/identity hashing opts in deliberately.
   */
  caseInsensitive?: boolean;
}

/**
 * Canonicalize text for comparison:
 * - normalize line endings (CRLF/CR -> LF)
 * - collapse all runs of whitespace to a single space
 * - trim leading/trailing whitespace
 * - optionally fold case
 *
 * The result is intended for equality checks, not for display.
 */
export function normalizeText(input: string, options: NormalizeOptions = {}): string {
  const collapsed = input.replace(/\r\n?/g, "\n").replace(/\s+/g, " ").trim();
  return options.caseInsensitive ? collapsed.toLowerCase() : collapsed;
}

/**
 * Whitespace-insensitive (but case-sensitive) equality for prose fields.
 */
export function textEquals(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}
