/**
 * Commentary overlay script - injected into Markdown preview
 * Handles text selection, comment bubbles, and highlighting
 */

(function () {
  'use strict';

  // VS Code API for messaging
  const vscode = acquireVsCodeApi();

  let currentSelection = null;
  let commentBubble = null;
  let highlights = new Map(); // noteId -> highlight element

  /**
   * Initialize the overlay
   */
  function init() {
    console.log('Commentary overlay initialized');

    // Listen for mouseup to detect selections
    document.addEventListener('mouseup', handleMouseUp);

    // Listen for messages from extension
    window.addEventListener('message', handleHostMessage);

    // Notify extension that preview is ready
    postMessage({ type: 'ready' });
  }

  /**
   * Handle mouse up event (potential selection)
   */
  function handleMouseUp(event) {
    // Small delay to ensure selection is finalized
    setTimeout(() => {
      const selection = window.getSelection();

      if (!selection || selection.isCollapsed) {
        // No selection, hide bubble
        hideBubble();
        return;
      }

      const text = selection.toString().trim();
      if (!text || text.length === 0) {
        hideBubble();
        return;
      }

      // Valid selection - serialize and show bubble
      currentSelection = serializeSelection(selection);
      if (currentSelection) {
        showBubble(selection, event.clientX, event.clientY);
      }
    }, 10);
  }

  /**
   * Serialize a DOM selection into our anchor format
   */
  function serializeSelection(selection) {
    const range = selection.getRangeAt(0);
    const exact = selection.toString();

    // Get prefix and suffix for TextQuoteSelector
    const prefix = getPrefix(range.startContainer, range.startOffset, 32);
    const suffix = getSuffix(range.endContainer, range.endOffset, 32);

    // Get text position
    const position = getTextPosition(range);

    return {
      quote: {
        exact: exact,
        prefix: prefix,
        suffix: suffix,
      },
      position: position,
    };
  }

  /**
   * Get prefix text before selection
   */
  function getPrefix(node, offset, length) {
    const textBefore = getTextBefore(node, offset);
    return textBefore.slice(-length);
  }

  /**
   * Get suffix text after selection
   */
  function getSuffix(node, offset, length) {
    const textAfter = getTextAfter(node, offset);
    return textAfter.slice(0, length);
  }

  /**
   * Get text before a position
   */
  function getTextBefore(node, offset) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.substring(0, offset);
    }
    // Simplified - in production, walk the DOM tree
    return '';
  }

  /**
   * Get text after a position
   */
  function getTextAfter(node, offset) {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent.substring(offset);
    }
    // Simplified - in production, walk the DOM tree
    return '';
  }

  /**
   * Get text position (character offsets from document start)
   */
  function getTextPosition(range) {
    // Simplified - in production, calculate accurate offsets
    const bodyText = document.body.textContent || '';
    const selectedText = range.toString();
    const start = bodyText.indexOf(selectedText);
    const end = start + selectedText.length;

    return { start, end };
  }

  /**
   * Show comment bubble near selection
   */
  function showBubble(selection, x, y) {
    hideBubble();

    commentBubble = document.createElement('div');
    commentBubble.className = 'commentary-bubble';

    // Position near cursor
    commentBubble.style.position = 'fixed';
    commentBubble.style.left = x + 'px';
    commentBubble.style.top = (y + 20) + 'px';

    // Create bubble content
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add comment...';
    textarea.className = 'commentary-textarea';

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'commentary-buttons';

    const saveBtn = document.createElement('button');
    saveBtn.textContent = 'Save';
    saveBtn.className = 'commentary-btn commentary-btn-primary';
    saveBtn.onclick = () => saveComment(textarea.value);

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = 'Cancel';
    cancelBtn.className = 'commentary-btn';
    cancelBtn.onclick = hideBubble;

    const agentBtn = document.createElement('button');
    agentBtn.textContent = '→ Agent';
    agentBtn.className = 'commentary-btn commentary-btn-agent';
    agentBtn.onclick = () => sendToAgent(textarea.value);

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(agentBtn);

    commentBubble.appendChild(textarea);
    commentBubble.appendChild(buttonContainer);

    document.body.appendChild(commentBubble);

    // Focus textarea
    textarea.focus();
  }

  /**
   * Hide comment bubble
   */
  function hideBubble() {
    if (commentBubble) {
      commentBubble.remove();
      commentBubble = null;
    }
    currentSelection = null;
  }

  /**
   * Save comment
   */
  function saveComment(text) {
    if (!text.trim() || !currentSelection) {
      return;
    }

    postMessage({
      type: 'saveComment',
      selection: currentSelection,
      commentText: text.trim(),
    });

    hideBubble();
    window.getSelection()?.removeAllRanges();
  }

  /**
   * Send selection and comment to agent
   */
  function sendToAgent(text) {
    if (!currentSelection) {
      return;
    }

    // First save the comment
    if (text.trim()) {
      saveComment(text);
    }

    // Note: Actual agent sending is handled by extension host
  }

  /**
   * Paint highlights from notes
   */
  function paintHighlights(notes) {
    // Clear existing highlights
    clearHighlights();

    for (const note of notes) {
      paintHighlight(note);
    }
  }

  /**
   * Paint a single highlight
   */
  function paintHighlight(note) {
    // Try to find the text using the quote selector
    const range = findTextRange(note.quote);

    if (!range) {
      console.warn('Could not anchor note:', note.id);
      return;
    }

    // Create highlight mark element
    const mark = document.createElement('mark');
    mark.className = 'commentary-highlight';
    mark.dataset.noteId = note.id;
    mark.title = note.text;

    // Wrap the range
    try {
      range.surroundContents(mark);
      highlights.set(note.id, mark);

      // Add click handler
      mark.addEventListener('click', () => {
        postMessage({
          type: 'revealComment',
          noteId: note.id,
        });
      });
    } catch (error) {
      console.error('Failed to paint highlight:', error);
    }
  }

  /**
   * Find a text range using TextQuoteSelector
   */
  function findTextRange(quote) {
    const bodyText = document.body.textContent || '';
    const index = bodyText.indexOf(quote.exact);

    if (index === -1) {
      return null;
    }

    // Simplified range finding - in production, use proper DOM traversal
    const range = document.createRange();
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let currentPos = 0;
    let startNode = null;
    let startOffset = 0;
    let endNode = null;
    let endOffset = 0;

    while (walker.nextNode()) {
      const node = walker.currentNode;
      const nodeLength = node.textContent.length;

      if (currentPos <= index && currentPos + nodeLength > index) {
        startNode = node;
        startOffset = index - currentPos;
      }

      if (currentPos <= index + quote.exact.length && currentPos + nodeLength >= index + quote.exact.length) {
        endNode = node;
        endOffset = index + quote.exact.length - currentPos;
        break;
      }

      currentPos += nodeLength;
    }

    if (startNode && endNode) {
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    }

    return null;
  }

  /**
   * Clear all highlights
   */
  function clearHighlights() {
    for (const [noteId, mark] of highlights.entries()) {
      // Unwrap the mark element
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);
      }
    }
    highlights.clear();
  }

  /**
   * Remove a specific highlight
   */
  function removeHighlight(noteId) {
    const mark = highlights.get(noteId);
    if (mark && mark.parentNode) {
      const parent = mark.parentNode;
      while (mark.firstChild) {
        parent.insertBefore(mark.firstChild, mark);
      }
      parent.removeChild(mark);
      highlights.delete(noteId);
    }
  }

  /**
   * Scroll to a highlight
   */
  function scrollToHighlight(noteId) {
    const mark = highlights.get(noteId);
    if (mark) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add temporary emphasis
      mark.classList.add('commentary-highlight-focus');
      setTimeout(() => {
        mark.classList.remove('commentary-highlight-focus');
      }, 2000);
    }
  }

  /**
   * Handle messages from extension host
   */
  function handleHostMessage(event) {
    const message = event.data;

    switch (message.type) {
      case 'paintHighlights':
        paintHighlights(message.notes || []);
        break;

      case 'removeHighlight':
        removeHighlight(message.noteId);
        break;

      case 'scrollToHighlight':
        scrollToHighlight(message.noteId);
        break;

      case 'clearAllHighlights':
        clearHighlights();
        break;
    }
  }

  /**
   * Send message to extension host
   */
  function postMessage(message) {
    vscode.postMessage(message);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
