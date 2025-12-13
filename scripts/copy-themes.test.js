#!/usr/bin/env node
/**
 * Tests for copy-themes.js build script
 * Run with: node scripts/copy-themes.test.js
 */

const fs = require('fs');
const path = require('path');

const themesDir = path.join(__dirname, '..', 'media', 'themes');
const overlayJs = path.join(__dirname, '..', 'media', 'overlay.js');
const overlayCss = path.join(__dirname, '..', 'media', 'overlay.css');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.error(`✗ ${name}`);
    console.error(`  ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Test: Pico CSS files have compatibility section
const picoThemes = ['pico-amber', 'pico-blue', 'pico-cyan', 'pico-green', 'pico-grey', 'pico-pink', 'pico-purple', 'pico-red'];

for (const theme of picoThemes) {
  test(`${theme}.css has VS Code webview compatibility CSS`, () => {
    const filePath = path.join(themesDir, `${theme}.css`);
    assert(fs.existsSync(filePath), `File not found: ${filePath}`);

    const content = fs.readFileSync(filePath, 'utf8');

    // Check for compatibility comment
    assert(
      content.includes('Commentary VS Code webview compatibility'),
      'Missing compatibility comment'
    );

    // Check for link color override
    assert(
      content.includes('a {') && content.includes('color: var(--pico-color)'),
      'Missing link color override'
    );

    // Check for hover states
    assert(
      content.includes('a:hover') && content.includes('a:active') && content.includes('a:focus'),
      'Missing hover/active/focus states'
    );

    // Check for body color override
    assert(
      content.includes('html, body {') && content.includes('background-color: var(--pico-background-color)'),
      'Missing body color override'
    );
  });
}

// Test: Overlay CSS has theme isolation
test('overlay.css has isolated textarea styles', () => {
  const content = fs.readFileSync(overlayCss, 'utf8');

  // Check for !important on key properties to prevent theme leakage
  assert(
    content.includes('.commentary-textarea') && content.includes('!important'),
    'Textarea missing !important isolation'
  );

  // Check for hardcoded colors (not CSS variables that themes could override)
  assert(
    content.includes('border: 1px solid #30363d !important'),
    'Textarea missing hardcoded border color'
  );

  assert(
    content.includes('background: #0d1117 !important'),
    'Textarea missing hardcoded background color'
  );
});

// Test: Overlay CSS scopes selection styles
test('overlay.css scopes selection styles to Commentary elements', () => {
  const content = fs.readFileSync(overlayCss, 'utf8');

  // Should NOT have global ::selection
  const hasGlobalSelection = /^::selection\s*\{/m.test(content);
  assert(!hasGlobalSelection, 'Has unscoped global ::selection rule');

  // Should have scoped selection
  assert(
    content.includes('.commentary-bubble ::selection') || content.includes('.commentary-textarea::selection'),
    'Missing scoped selection styles'
  );
});

// Test: Overlay JS does not have copy button
test('overlay.js does not create copy button in bubble', () => {
  const content = fs.readFileSync(overlayJs, 'utf8');

  // Should not have copy button creation
  const hasCopyButton = content.includes("copyBtn.innerHTML = '<i class=\"codicon codicon-copy\">'");
  assert(!hasCopyButton, 'Still has copy button creation code');

  // Should have comment about removal
  assert(
    content.includes('Copy button removed'),
    'Missing comment about copy button removal'
  );
});

// Test: Overlay CSS has inline display for highlights
test('overlay.css highlights are display: inline', () => {
  const content = fs.readFileSync(overlayCss, 'utf8');

  assert(
    content.includes('.commentary-highlight') && content.includes('display: inline'),
    'Highlights missing display: inline'
  );
});

// Test: Overlay JS uses markdown-content container for text operations
test('overlay.js uses markdown-content container instead of document.body', () => {
  const content = fs.readFileSync(overlayJs, 'utf8');

  // Should have getContentContainer function
  assert(
    content.includes('function getContentContainer()') &&
    content.includes("getElementById('markdown-content')"),
    'Missing getContentContainer function'
  );

  // findTextRange should use container
  assert(
    content.includes('const container = getContentContainer()') &&
    content.includes('const contentText = container.textContent'),
    'findTextRange not using content container'
  );

  // findRangeAtIndex should use container
  const findRangeAtIndexMatch = content.match(/function findRangeAtIndex[\s\S]*?const walker = document\.createTreeWalker\(\s*(\w+)/);
  assert(
    findRangeAtIndexMatch && findRangeAtIndexMatch[1] === 'container',
    'findRangeAtIndex should walk container, not document.body'
  );
});

// Test: Overlay JS skips whitespace-only text nodes
test('overlay.js skips whitespace-only text in wrapRangeWithMark', () => {
  const content = fs.readFileSync(overlayJs, 'utf8');

  // Should have whitespace check before creating marks
  assert(
    content.includes("if (!highlightText.trim())") &&
    content.includes('continue'),
    'Missing whitespace-only text filter in wrapRangeWithMark'
  );

  // Should have comment explaining why
  assert(
    content.includes('whitespace-only text') || content.includes('empty mark'),
    'Missing comment explaining whitespace filter'
  );
});

// Summary
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
