/**
 * Regression tests for issue #27 — selecting text in the rendered Markdown
 * preview no longer shows the comment popup.
 *
 * These drive the REAL media/overlay.js inside a jsdom DOM so we exercise the
 * actual selection -> action button -> bubble flow rather than a reimplementation.
 *
 * Two failure modes are covered:
 *   1. Clicking the action button collapses the text selection, which fires
 *      `selectionchange`; the old code tore the button down before its click
 *      handler could run, so the bubble never opened.
 *   2. `mouseup` read `window.getSelection()` synchronously, before the webview
 *      finalized the selection, so `isCollapsed` was true and the button never
 *      appeared.
 */

import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// jsdom is only used in tests; require to avoid pulling DOM lib types into the build.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JSDOM } = require('jsdom');

const OVERLAY_PATH = path.resolve(__dirname, '../../../media/overlay.js');

interface FakeSelectionState {
  collapsed: boolean;
}

interface LoadedOverlay {
  window: any;
  document: any;
  flush: () => void;
  pendingTimers: () => number;
  selectionState: FakeSelectionState;
  setSelectionCollapsed: (collapsed: boolean) => void;
}

/**
 * Load media/overlay.js into a fresh jsdom window with controllable
 * requestAnimationFrame and getSelection so the event cascade is deterministic.
 */
function loadOverlay(): LoadedOverlay {
  const overlaySrc = fs.readFileSync(OVERLAY_PATH, 'utf8');

  const dom = new JSDOM(
    `<!DOCTYPE html><html><body>
       <div id="markdown-content"><p id="para">hello world this is some selectable preview text</p></div>
     </body></html>`,
    { runScripts: 'dangerously', pretendToBeVisual: true }
  );

  const { window } = dom;

  // overlay.js posts messages to the extension host through this hook.
  window.commentaryPostMessage = () => {};
  window.commentaryDocumentUri = 'file:///test/doc.md';

  // Silence the overlay's verbose [OVERLAY] logging during tests.
  window.console = { log() {}, error() {}, warn() {}, info() {}, debug() {} };

  // Controllable timer queue so we can drive overlay.js's debounced selection
  // read deterministically. clearTimeout removes a pending entry, which is how
  // the multi-click coalescing is exercised.
  const timers: Array<{ id: number; cb: () => void }> = [];
  let nextTimerId = 1;
  window.setTimeout = (cb: () => void) => {
    const id = nextTimerId++;
    timers.push({ id, cb });
    return id;
  };
  window.clearTimeout = (id: number) => {
    const idx = timers.findIndex((t) => t.id === id);
    if (idx >= 0) {
      timers.splice(idx, 1);
    }
  };
  // overlay no longer uses rAF, but keep it synchronous in case any path does.
  window.requestAnimationFrame = (cb: (t: number) => void) => {
    cb(0);
    return 1;
  };
  const flush = () => {
    const pending = timers.splice(0);
    pending.forEach((t) => t.cb());
  };
  const pendingTimers = () => timers.length;

  // A real Range over the preview text so serializeSelection() works in jsdom.
  const textNode = window.document.getElementById('para').firstChild;
  const range = window.document.createRange();
  range.setStart(textNode, 0);
  range.setEnd(textNode, 5); // "hello"
  // jsdom Ranges have no layout, so getClientRects() is missing — overlay.js
  // calls it for positioning and falls back to the mouse coords when empty.
  range.getClientRects = () => [];
  range.getBoundingClientRect = () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });

  const selectionState: FakeSelectionState = { collapsed: false };
  window.getSelection = () => ({
    get isCollapsed() {
      return selectionState.collapsed;
    },
    rangeCount: 1,
    toString: () => (selectionState.collapsed ? '' : 'hello'),
    getRangeAt: () => range,
  });

  // Inject and execute overlay.js. In jsdom readyState is still 'loading' at
  // eval time, so overlay defers init() to DOMContentLoaded — fire it ourselves.
  const scriptEl = window.document.createElement('script');
  scriptEl.textContent = overlaySrc;
  window.document.body.appendChild(scriptEl);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));

  return {
    window,
    document: window.document,
    flush,
    pendingTimers,
    selectionState,
    setSelectionCollapsed: (collapsed: boolean) => {
      selectionState.collapsed = collapsed;
    },
  };
}

function dispatchMouseUp(o: LoadedOverlay): void {
  o.document.dispatchEvent(
    new o.window.MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: 40, clientY: 40 })
  );
}

function actionButton(o: LoadedOverlay): any {
  return o.document.querySelector('.commentary-selection-action');
}

suite('Overlay selection-to-comment (issue #27)', () => {
  test('shows the action button when a valid selection exists after mouseup', () => {
    const o = loadOverlay();
    o.setSelectionCollapsed(false);

    dispatchMouseUp(o);
    o.flush(); // run the deferred selection read

    assert.ok(actionButton(o), 'expected the comment action button to appear after selecting text');
  });

  test('appears even when the selection is finalized after mouseup (deferred read)', () => {
    const o = loadOverlay();

    // mouseup fires before the webview finalizes the selection.
    o.setSelectionCollapsed(true);
    dispatchMouseUp(o);

    // Selection finalizes a tick later, before the debounce fires.
    o.setSelectionCollapsed(false);
    o.flush();

    assert.ok(
      actionButton(o),
      'expected the action button to appear once the selection is finalized'
    );
  });

  test('action button survives the selectionchange fired by clicking it', () => {
    const o = loadOverlay();
    o.setSelectionCollapsed(false);

    dispatchMouseUp(o);
    o.flush();
    const button = actionButton(o);
    assert.ok(button, 'precondition: action button should be present before clicking it');

    // Pressing the button collapses the document selection in a real browser.
    button.dispatchEvent(new o.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    o.setSelectionCollapsed(true);
    o.document.dispatchEvent(new o.window.Event('selectionchange'));

    assert.ok(
      actionButton(o),
      'action button must NOT be torn down by the selectionchange that its own click triggers'
    );
  });

  test('debounces multi-click so the button does not flash between clicks (triple-click)', () => {
    const o = loadOverlay();
    o.setSelectionCollapsed(false);

    // First mouseup (e.g. the 2nd click of a triple-click selecting a word).
    dispatchMouseUp(o);
    assert.strictEqual(o.pendingTimers(), 1, 'first mouseup should schedule exactly one pending show');
    assert.ok(!actionButton(o), 'button must NOT appear yet — still within the debounce window');

    // A rapid follow-up mouseup (the 3rd click) should reset the timer, not stack a second one.
    dispatchMouseUp(o);
    assert.strictEqual(
      o.pendingTimers(),
      1,
      'a rapid second mouseup must cancel the prior schedule, leaving exactly one pending show'
    );
    assert.ok(!actionButton(o), 'button must still NOT be visible mid multi-click');

    // Once the clicks settle and the debounce fires, the button appears exactly once.
    o.flush();
    assert.strictEqual(
      o.document.querySelectorAll('.commentary-selection-action').length,
      1,
      'exactly one action button should appear after the clicks settle'
    );
  });
});
