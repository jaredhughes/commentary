/**
 * Tests for direct Claude API response handling.
 *
 * Guards against the data-loss case where a truncated response
 * (stop_reason === 'max_tokens') is written over the whole document.
 */

import * as assert from 'assert';
import { extractEditableContent } from './apiResponse';

suite('extractEditableContent', () => {
  test('returns the joined text for a normal (end_turn) response', () => {
    const result = extractEditableContent({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: '# Title' }],
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.ok && result.text, '# Title');
  });

  test('joins multiple text blocks and ignores non-text blocks', () => {
    const result = extractEditableContent({
      stop_reason: 'end_turn',
      content: [
        { type: 'text', text: 'line one' },
        { type: 'tool_use' },
        { type: 'text', text: 'line two' },
      ],
    });

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.ok && result.text, 'line one\nline two');
  });

  test('does NOT return content when the response was truncated', () => {
    const result = extractEditableContent({
      stop_reason: 'max_tokens',
      content: [{ type: 'text', text: 'partial doc that got cut off' }],
    });

    assert.strictEqual(result.ok, false);
    assert.strictEqual(!result.ok && result.reason, 'truncated');
  });
});
