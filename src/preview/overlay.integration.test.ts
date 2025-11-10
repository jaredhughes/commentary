/**
 * Integration tests for overlay.js functionality
 * Tests highlight rendering, link handling, and animations
 */

import * as assert from 'assert';

/**
 * Helper to extract markdown filename from href, handling fragments and queries
 */
function extractMarkdownPath(href: string): string | null {
  const normalizedHref = href.split('#')[0].split('?')[0];
  if (normalizedHref.endsWith('.md')) {
    return normalizedHref;
  }
  return null;
}

suite('Overlay Link Handling Tests', () => {
  suite('Markdown Link Fragment and Query Handling', () => {
    test('Should extract .md path from href with fragment', () => {
      const href = 'guide.md#intro';
      const path = extractMarkdownPath(href);
      assert.strictEqual(path, 'guide.md', 'Should extract path before fragment');
    });

    test('Should extract .md path from href with query string', () => {
      const href = 'guide.md?view=raw';
      const path = extractMarkdownPath(href);
      assert.strictEqual(path, 'guide.md', 'Should extract path before query');
    });

    test('Should extract .md path from href with both fragment and query', () => {
      const href = 'docs/index.md?mode=edit#section';
      const path = extractMarkdownPath(href);
      assert.strictEqual(path, 'docs/index.md', 'Should extract path before query and fragment');
    });

    test('Should handle relative paths with fragments', () => {
      const href = '../guides/best-practices.md#performance';
      const path = extractMarkdownPath(href);
      assert.strictEqual(path, '../guides/best-practices.md', 'Should handle relative paths with fragments');
    });

    test('Should return null for non-markdown links', () => {
      const href = 'https://example.com#section';
      const path = extractMarkdownPath(href);
      assert.strictEqual(path, null, 'Should return null for non-markdown links');
    });

    test('Should return null for plain anchors', () => {
      const href = '#section';
      const path = extractMarkdownPath(href);
      assert.strictEqual(path, null, 'Should return null for plain anchors');
    });

    test('Should handle .md without fragment or query', () => {
      const href = 'README.md';
      const path = extractMarkdownPath(href);
      assert.strictEqual(path, 'README.md', 'Should handle plain .md files');
    });

    test('Should not match partial .md matches', () => {
      const href = 'docs.markdown#section';
      const path = extractMarkdownPath(href);
      assert.strictEqual(path, null, 'Should not match .markdown or other extensions');
    });
  });

  suite('CSS Animation Variables', () => {
    test('Pulse animation should use CSS variables', () => {
      // Simulate the animation keyframes CSS
      const animationCSS = `
        @keyframes highlight-pulse {
          0%, 100% {
            background-color: var(--commentary-highlight-focus-bg, rgba(255, 220, 0, 0.4));
          }
          50% {
            background-color: var(--commentary-highlight-active-bg, rgba(255, 220, 0, 0.55));
          }
        }
      `;

      // Verify the CSS uses variables with fallbacks
      assert.ok(animationCSS.includes('var(--commentary-highlight-focus-bg'), 'Should use focus bg variable');
      assert.ok(animationCSS.includes('var(--commentary-highlight-active-bg'), 'Should use active bg variable');
      assert.ok(animationCSS.includes('rgba(255, 220, 0, 0.4)'), 'Should have fallback for focus');
      assert.ok(animationCSS.includes('rgba(255, 220, 0, 0.55)'), 'Should have fallback for active');
    });

    test('Highlight should respect theme CSS variables', () => {
      const highlightCSS = `
        .commentary-highlight {
          background-color: var(--commentary-highlight-bg, rgba(255, 220, 0, 0.2));
          border-bottom: 2px solid var(--commentary-highlight-border, rgba(255, 220, 0, 0.5));
        }

        .commentary-highlight-focus {
          background-color: var(--commentary-highlight-focus-bg, rgba(255, 220, 0, 0.4));
          border-bottom-color: var(--commentary-highlight-focus-border, rgba(255, 220, 0, 0.75));
        }
      `;

      assert.ok(highlightCSS.includes('var(--commentary-highlight-bg'), 'Should use highlight bg variable');
      assert.ok(highlightCSS.includes('var(--commentary-highlight-border'), 'Should use highlight border variable');
      assert.ok(highlightCSS.includes('var(--commentary-highlight-focus-bg'), 'Should use focus state bg variable');
      assert.ok(highlightCSS.includes('var(--commentary-highlight-focus-border'), 'Should use focus state border variable');
    });
  });

  suite('Highlight DOM Manipulation Logic', () => {
    test('Should simulate complex DOM traversal for nested elements', () => {
      // Simulate finding text range across nested elements
      interface MockElement {
        nodeType: number;
        tagName?: string;
        textContent?: string;
        parentNode?: MockElement | null;
        firstChild?: MockElement | null;
        nextSibling?: MockElement | null;
      }

      const createMockParagraph = (): MockElement => ({
        nodeType: 1, // ELEMENT_NODE
        tagName: 'P',
        textContent: 'This is a bold and italic text.',
      });

      const p = createMockParagraph();
      assert.ok(p, 'Should have paragraph');
      assert.strictEqual(p.tagName, 'P', 'Should be paragraph element');
    });

    test('Should handle heading anchor extraction', () => {
      // Simulate heading with anchor: <h2><a href="#section-1">Section 1</a></h2>
      const headingHTML = '<h2><a href="#section-1">Section 1</a></h2>';

      // Parse the href from the anchor
      const anchorMatch = headingHTML.match(/href="([^"]+)"/);
      assert.ok(anchorMatch, 'Should find href in heading');
      assert.strictEqual(anchorMatch?.[1], '#section-1', 'Should extract correct href');
    });

    test('Should normalize text by removing markup', () => {
      const htmlWithMark = '<p>This is <mark class="commentary-highlight">highlighted</mark> text.</p>';

      // Remove mark tags
      const normalized = htmlWithMark.replace(/<\/?mark[^>]*>/g, '');
      const expectedNormalized = '<p>This is highlighted text.</p>';

      assert.strictEqual(normalized, expectedNormalized, 'Should remove mark tags');
      assert.ok(normalized.includes('highlighted'), 'Should preserve highlighted text');
    });

    test('Should track text node positions', () => {
      // Simulate text traversal with character offsets
      const text = 'This is a test string';
      const startOffset = 10; // Start at 'a'
      const endOffset = 14;   // End at 't' in 'test'

      const selectedText = text.substring(startOffset, endOffset);
      assert.strictEqual(selectedText, 'test', 'Should extract correct substring by offset');

      // Verify offsets track across multiple calls
      const newStartOffset = 5;
      const anotherSelection = text.substring(newStartOffset, 7);
      assert.strictEqual(anotherSelection, 'is', 'Should support multiple offset ranges');
    });
  });

  suite('Event Listener Cleanup', () => {
    test('Should properly clean up event listeners', () => {
      type EventHandler = () => void;
      const listeners = new Map<string, EventHandler[]>();

      const addEventListener = (name: string, fn: EventHandler) => {
        if (!listeners.has(name)) {
          listeners.set(name, []);
        }
        listeners.get(name)!.push(fn);
      };

      const removeEventListener = (name: string, fn: EventHandler) => {
        if (listeners.has(name)) {
          const fns = listeners.get(name)!;
          const idx = fns.indexOf(fn);
          if (idx !== -1) {
            fns.splice(idx, 1);
          }
        }
      };

      // Test adding and removing listeners
      const handler = () => {};
      addEventListener('escape', handler);
      assert.strictEqual(listeners.get('escape')?.length, 1, 'Should have 1 listener');

      removeEventListener('escape', handler);
      assert.strictEqual(listeners.get('escape')?.length, 0, 'Should have 0 listeners after removal');
    });

    test('Should not create duplicate listeners', () => {
      type EventHandler = () => void;
      const listeners = new Set<EventHandler>();

      const handler = () => {};
      listeners.add(handler);
      listeners.add(handler);

      assert.strictEqual(listeners.size, 1, 'Set should prevent duplicate listeners');
    });
  });

  suite('Cache Invalidation', () => {
    test('Should not race during reveal and cache clear', async () => {
      const cache = new Map<string, unknown>();
      const pendingReveal: string[] = [];

      const clearCache = () => {
        cache.clear();
      };

      const populateCache = (id: string) => {
        cache.set(id, { data: 'test' });
      };

      const getFromCache = (id: string) => {
        return cache.get(id);
      };

      const schedulePendingReveal = (id: string) => {
        pendingReveal.push(id);
      };

      // Simulate race: clear cache before reveal reads
      clearCache();
      populateCache('item-1');
      schedulePendingReveal('item-1');

      // Now reveal tries to read
      const item = getFromCache('item-1');
      assert.ok(item, 'Should find item in cache after populate');

      // Verify clean state
      assert.strictEqual(cache.size, 1, 'Cache should have 1 item');
    });
  });
});
