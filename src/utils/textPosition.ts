/**
 * Pure functions for working with text positions and line numbers
 * Extracted from payload.ts for better testability
 */

/**
 * Calculate line numbers from a text position
 * @param text The full text content
 * @param startPos Character offset where the quote starts
 * @param quoteLength Length of the quoted text
 * @returns 1-indexed line numbers for display
 */
export function calculateLineNumbers(
  text: string,
  startPos: number,
  quoteLength: number
): { start: number; end: number } | null {
  if (startPos < 0 || startPos >= text.length) {
    return null;
  }

  // Count lines up to start position
  const textBeforeStart = text.substring(0, startPos);
  const startLine = (textBeforeStart.match(/\n/g) || []).length + 1;

  // Count lines up to end position
  const endPos = Math.min(startPos + quoteLength, text.length);
  const textBeforeEnd = text.substring(0, endPos);
  const endLine = (textBeforeEnd.match(/\n/g) || []).length + 1;

  return {
    start: startLine,
    end: endLine,
  };
}

/**
 * Find the position of a quote within text, handling potential duplicates
 * @param text The full text to search
 * @param quote The exact text to find
 * @param prefix Optional prefix for disambiguation
 * @param suffix Optional suffix for disambiguation
 * @returns Character offset, or -1 if not found
 */
export function findQuotePosition(
  text: string,
  quote: string,
  prefix?: string,
  suffix?: string
): number {
  // Try with prefix and suffix if provided
  if (prefix || suffix) {
    const pattern = `${prefix || ''}${quote}${suffix || ''}`;
    const patternIndex = text.indexOf(pattern);
    if (patternIndex !== -1) {
      return patternIndex + (prefix?.length || 0);
    }
  }

  // Fallback to just the quote
  return text.indexOf(quote);
}

/**
 * Extract context lines around a target range
 * @param lines Array of all lines in the document
 * @param targetStart 1-indexed start line
 * @param targetEnd 1-indexed end line
 * @param contextLineCount Number of context lines before/after
 * @returns Object with before, target, and after text
 */
export function extractContextLines(
  lines: string[],
  targetStart: number,
  targetEnd: number,
  contextLineCount: number
): {
  before: string;
  target: string;
  after: string;
  actualStart: number;
  actualEnd: number;
} {
  // Convert to 0-indexed
  const startIdx = Math.max(0, targetStart - 1);
  const endIdx = Math.min(lines.length, targetEnd);

  // Calculate context range
  const beforeStart = Math.max(0, startIdx - contextLineCount);
  const afterEnd = Math.min(lines.length, endIdx + contextLineCount);

  return {
    before: lines.slice(beforeStart, startIdx).join('\n'),
    target: lines.slice(startIdx, endIdx).join('\n'),
    after: lines.slice(endIdx, afterEnd).join('\n'),
    actualStart: beforeStart + 1, // Back to 1-indexed
    actualEnd: afterEnd,
  };
}

/**
 * Extract character-based context around a position
 * Used as fallback when line-based context isn't available
 * @param text Full text content
 * @param start Start character position
 * @param end End character position
 * @param contextCharCount Number of characters before/after
 */
export function extractContextByPosition(
  text: string,
  start: number,
  end: number,
  contextCharCount: number
): {
  before: string;
  target: string;
  after: string;
} {
  const beforeStart = Math.max(0, start - contextCharCount);
  const afterEnd = Math.min(text.length, end + contextCharCount);

  return {
    before: text.substring(beforeStart, start),
    target: text.substring(start, end),
    after: text.substring(end, afterEnd),
  };
}
