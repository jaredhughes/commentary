/**
 * Tests for text position utilities
 */

import * as assert from 'assert';
import {
  calculateLineNumbers,
  findQuotePosition,
  extractContextLines,
  extractContextByPosition,
} from '../../utils/textPosition';

suite('Text Position Utilities Test Suite', () => {
  suite('calculateLineNumbers', () => {
    test('should calculate correct line numbers for single line', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const quote = 'Line 2';
      const startPos = text.indexOf(quote);

      const result = calculateLineNumbers(text, startPos, quote.length);

      assert.deepStrictEqual(result, { start: 2, end: 2 });
    });

    test('should calculate correct line numbers for multi-line quote', () => {
      const text = 'Line 1\nLine 2\nLine 3\nLine 4';
      const quote = 'Line 2\nLine 3';
      const startPos = text.indexOf(quote);

      const result = calculateLineNumbers(text, startPos, quote.length);

      assert.deepStrictEqual(result, { start: 2, end: 3 });
    });

    test('should handle quote at start of document', () => {
      const text = 'Line 1\nLine 2';
      const quote = 'Line 1';
      const startPos = 0;

      const result = calculateLineNumbers(text, startPos, quote.length);

      assert.deepStrictEqual(result, { start: 1, end: 1 });
    });

    test('should handle quote at end of document', () => {
      const text = 'Line 1\nLine 2';
      const quote = 'Line 2';
      const startPos = text.indexOf(quote);

      const result = calculateLineNumbers(text, startPos, quote.length);

      assert.deepStrictEqual(result, { start: 2, end: 2 });
    });

    test('should return null for invalid position', () => {
      const text = 'Line 1\nLine 2';

      const result = calculateLineNumbers(text, 1000, 5);

      assert.strictEqual(result, null);
    });

    test('should return null for negative position', () => {
      const text = 'Line 1\nLine 2';

      const result = calculateLineNumbers(text, -1, 5);

      assert.strictEqual(result, null);
    });
  });

  suite('findQuotePosition', () => {
    test('should find exact quote', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      const quote = 'brown fox';

      const result = findQuotePosition(text, quote);

      assert.strictEqual(result, 10);
    });

    test('should return -1 for non-existent quote', () => {
      const text = 'The quick brown fox';
      const quote = 'purple elephant';

      const result = findQuotePosition(text, quote);

      assert.strictEqual(result, -1);
    });

    test('should use prefix/suffix for disambiguation', () => {
      const text = 'The cat and the cat are here';
      const quote = 'cat';
      const prefix = 'the ';

      const result = findQuotePosition(text, quote, prefix);

      assert.strictEqual(result, 16); // Second occurrence after "the "
    });

    test('should fallback to exact match when prefix/suffix pattern not found', () => {
      const text = 'The quick brown fox';
      const quote = 'brown';
      const prefix = 'wrong';

      const result = findQuotePosition(text, quote, prefix);

      assert.strictEqual(result, 10); // Falls back to first occurrence
    });
  });

  suite('extractContextLines', () => {
    const lines = [
      'Line 1',
      'Line 2',
      'Line 3',
      'Line 4',
      'Line 5',
      'Line 6',
      'Line 7',
    ];

    test('should extract context around middle lines', () => {
      const result = extractContextLines(lines, 4, 4, 2);

      assert.strictEqual(result.before, 'Line 2\nLine 3');
      assert.strictEqual(result.target, 'Line 4');
      assert.strictEqual(result.after, 'Line 5\nLine 6');
      assert.strictEqual(result.actualStart, 2);
      assert.strictEqual(result.actualEnd, 6);
    });

    test('should handle context at start of document', () => {
      const result = extractContextLines(lines, 1, 1, 2);

      assert.strictEqual(result.before, '');
      assert.strictEqual(result.target, 'Line 1');
      assert.strictEqual(result.after, 'Line 2\nLine 3');
      assert.strictEqual(result.actualStart, 1);
    });

    test('should handle context at end of document', () => {
      const result = extractContextLines(lines, 7, 7, 2);

      assert.strictEqual(result.before, 'Line 5\nLine 6');
      assert.strictEqual(result.target, 'Line 7');
      assert.strictEqual(result.after, '');
      assert.strictEqual(result.actualEnd, 7);
    });

    test('should handle multi-line target', () => {
      const result = extractContextLines(lines, 3, 5, 1);

      assert.strictEqual(result.before, 'Line 2');
      assert.strictEqual(result.target, 'Line 3\nLine 4\nLine 5');
      assert.strictEqual(result.after, 'Line 6');
    });
  });

  suite('extractContextByPosition', () => {
    const text = 'The quick brown fox jumps over the lazy dog';

    test('should extract character-based context', () => {
      const quote = 'brown fox';
      const startPos = text.indexOf(quote);
      const endPos = startPos + quote.length;

      const result = extractContextByPosition(text, startPos, endPos, 10);

      assert.strictEqual(result.before, 'The quick ');
      assert.strictEqual(result.target, 'brown fox');
      assert.strictEqual(result.after, ' jumps ove');
    });

    test('should handle context at start', () => {
      const result = extractContextByPosition(text, 0, 3, 10);

      assert.strictEqual(result.before, '');
      assert.strictEqual(result.target, 'The');
      assert.strictEqual(result.after, ' quick bro');
    });

    test('should handle context at end', () => {
      const lastWord = 'dog';
      const startPos = text.length - lastWord.length;

      const result = extractContextByPosition(text, startPos, text.length, 10);

      assert.strictEqual(result.before, ' the lazy ');
      assert.strictEqual(result.target, 'dog');
      assert.strictEqual(result.after, '');
    });
  });
});
