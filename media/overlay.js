/**
 * Commentary overlay script - injected into Markdown preview
 * Handles text selection, comment bubbles, and highlighting
 */

console.log('[OVERLAY.JS] Script is loading...');

(function () {
  'use strict';

  console.log('[OVERLAY.JS] IIFE starting...');

  // VS Code API for messaging
  const vscode = acquireVsCodeApi();
  console.log('[OVERLAY.JS] vscode API acquired:', vscode);

  let currentSelection = null;
  let commentBubble = null;
  let highlights = new Map(); // noteId -> highlight element
  let bubbleJustOpened = false; // Track if bubble was just created to avoid immediate close
  let activeHighlight = null; // Temporary highlight while bubble is open
  let trackedRange = null; // Track the range for repositioning on scroll
  let scrollListener = null; // Reference to scroll listener for cleanup
  let isDocumentLevelComment = false; // Track if current bubble is for document-level comment
  let editingNoteId = null; // Track which note is being edited (null for new comments)

  /**
   * Get agent button text and icon based on provider
   */
  function getAgentButtonConfig() {
    const provider = window.commentaryAgentProvider || 'cursor';
    const isCursor = provider === 'cursor';

    return {
      icon: isCursor ? '📋' : '➤',
      text: isCursor ? 'Copy for agent' : 'Send to agent',
      tooltip: isCursor
        ? 'Copy comment to clipboard for pasting into Cursor'
        : 'Send comment to AI agent for automatic processing'
    };
  }

  /**
   * Handle agent submission - sends to extension which handles Cursor chat opening
   */
  async function handleAgentSubmit(commentText, selection, isDocumentLevel, noteId) {
    // Always send to extension - it will handle provider-specific logic
    // (including opening Cursor chat view and copying to clipboard)
    postMessage({
      type: 'saveAndSubmitToAgent',
      selection: selection,
      commentText: commentText,
      isDocumentLevel: isDocumentLevel,
      noteId: noteId
    });
  }

  /**
   * Initialize the overlay
   */
  function init() {
    console.log('[OVERLAY.JS] init() called');
    console.log('[OVERLAY.JS] Commentary overlay initialized');

    // Create document comment button
    createDocumentCommentButton();
    console.log('[OVERLAY.JS] Document comment button created');

    // Make headings and paragraphs editable
    makeEditableElements();
    console.log('[OVERLAY.JS] Made headings and paragraphs editable');

    // Listen for mouseup to detect selections
    document.addEventListener('mouseup', handleMouseUp);
    console.log('[OVERLAY.JS] mouseup listener added');

    // Listen for Cmd+S to blur contenteditable before save (so edit gets applied)
    document.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        // If focus is on contenteditable, blur it first to trigger save
        const activeElement = document.activeElement;
        if (activeElement && activeElement.getAttribute('contenteditable') === 'plaintext-only') {
          console.log('[OVERLAY] Cmd+S pressed, blurring contenteditable element');
          activeElement.blur();
          // The blur will trigger our edit, and the native save will happen after
        }
      }
    });
    console.log('[OVERLAY.JS] Cmd+S listener added');

    // Listen for messages from extension
    window.addEventListener('message', handleHostMessage);
    console.log('[OVERLAY.JS] message listener added');

    // Notify extension that preview is ready
    postMessage({ type: 'ready' });
    console.log('[OVERLAY.JS] Ready message sent');
  }

  /**
   * Make headings and paragraphs contenteditable for quick text fixes
   */
  function makeEditableElements() {
    // Find all headings, paragraphs, and list items in the main content
    const editableSelector = 'h1, h2, h3, h4, h5, h6, p, li';
    const elements = document.querySelectorAll(editableSelector);

    elements.forEach((element) => {
      // Skip if inside a blockquote, code, pre, or other special containers
      if (element.closest('pre, code, blockquote, table')) {
        return;
      }

      // Make contenteditable with plaintext-only to prevent HTML formatting
      element.setAttribute('contenteditable', 'plaintext-only');
      element.style.cursor = 'text';

      // Store original text for comparison (normalize it)
      let originalText = element.textContent.replace(/\s+/g, ' ').trim();

      // Handle editing
      element.addEventListener('focus', () => {
        console.log('[OVERLAY] Element focused for editing');
        // Re-capture and normalize on focus in case content changed
        originalText = element.textContent.replace(/\s+/g, ' ').trim();
      });

      element.addEventListener('blur', () => {
        // Normalize text - remove any extra whitespace/newlines that may have been added
        const newText = element.textContent.replace(/\s+/g, ' ').trim();
        console.log('[OVERLAY] Element blur - checking for changes');

        // Only update if text actually changed
        if (newText !== originalText && newText.trim() !== '') {
          console.log('[OVERLAY] Text changed from:', originalText, 'to:', newText);
          updateDocumentText(element, originalText, newText);
        } else {
          // Restore original text if nothing changed (cleans up any formatting mess)
          element.textContent = originalText;
        }
      });

      // Prevent Enter from creating new lines (keep it simple)
      element.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          element.blur(); // Finish editing
        }
      });

      // Prevent paste from bringing in HTML - paste as plain text only
      element.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
      });
    });
  }

  /**
   * Update the markdown document with edited text
   */
  function updateDocumentText(element, oldText, newText) {
    console.log('[OVERLAY] Sending document update request');

    // Send message to extension to update the file
    postMessage({
      type: 'updateDocumentText',
      oldText: oldText.trim(),
      newText: newText.trim(),
    });
  }

  /**
   * Create floating button for document-level comments
   */
  function createDocumentCommentButton() {
    const button = document.createElement('button');
    button.className = 'commentary-doc-button';
    button.innerHTML = '💬';
    button.title = 'Comment on document';
    button.setAttribute('aria-label', 'Add comment for entire document');

    button.onclick = () => {
      // Check if a document-level comment already exists
      const existingDocComment = Array.from(highlights.entries()).find(([noteId, mark]) => {
        // Document comments don't have visible highlights, so check our stored notes
        return false; // We'll rely on the extension to handle duplicate prevention
      });

      // Request to add/edit document comment (extension will handle if one exists)
      postMessage({
        type: 'addDocumentComment',
      });
    };

    document.body.appendChild(button);
    console.log('[OVERLAY] Document comment button created');
  }

  /**
   * Handle mouse up event (potential selection)
   */
  function handleMouseUp(event) {
    console.log('[OVERLAY] handleMouseUp fired, target:', event.target);
    console.log('[OVERLAY] commentBubble exists:', !!commentBubble);
    console.log('[OVERLAY] bubbleJustOpened:', bubbleJustOpened);

    // Ignore events that fire immediately after opening the bubble
    if (bubbleJustOpened) {
      console.log('[OVERLAY] Ignoring mouseup - bubble just opened');
      bubbleJustOpened = false;
      return;
    }

    // Don't process if clicking inside the bubble
    if (commentBubble && commentBubble.contains(event.target)) {
      console.log('[OVERLAY] Click inside bubble, ignoring');
      return;
    }

    // Check for selection first
    const selection = window.getSelection();
    const hasSelection = selection && !selection.isCollapsed;
    const text = hasSelection ? selection.toString().trim() : '';
    const hasValidSelection = hasSelection && text.length > 0;

    console.log('[OVERLAY] Has valid selection:', hasValidSelection);

    // If bubble is open and user clicked outside
    if (commentBubble) {
      console.log('[OVERLAY] Bubble is open, user clicked outside');
      hideBubble();

      // If no new selection, we're done
      if (!hasValidSelection) {
        console.log('[OVERLAY] No new selection, bubble closed');
        return;
      }

      // Fall through to create new selection with bubble
      console.log('[OVERLAY] New selection detected, will create new bubble');
    }

    // Only show new bubble if there's a valid text selection
    if (!hasValidSelection) {
      console.log('[OVERLAY] No selection and no bubble to show');
      return;
    }

    // Valid selection - serialize and show bubble
    currentSelection = serializeSelection(selection);
    console.log('[OVERLAY] currentSelection set:', currentSelection);
    if (currentSelection) {
      // Create visual highlight before browser selection is cleared
      const range = selection.getRangeAt(0);
      createActiveHighlight(range);

      showBubble(selection, event.clientX, event.clientY);
      bubbleJustOpened = true; // Set flag to ignore next mouseup
      console.log('[OVERLAY] bubbleJustOpened flag set');
    }
  }

  /**
   * Serialize a DOM selection into our anchor format
   */
  function serializeSelection(selection) {
    const range = selection.getRangeAt(0);
    const exact = selection.toString();

    // Get prefix and suffix for TextQuoteSelector
    // Using 100 chars for better agent context when editing/rewriting
    const prefix = getPrefix(range.startContainer, range.startOffset, 100);
    const suffix = getSuffix(range.endContainer, range.endOffset, 100);

    // Get text position
    const position = getTextPosition(range);

    console.log('[OVERLAY] Serialized selection:', {exact, prefix, suffix, position});

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
   * Increased to 100 chars for better agent context
   */
  function getPrefix(node, offset, length) {
    const textBefore = getTextBefore(node, offset);
    return textBefore.slice(-length);
  }

  /**
   * Get suffix text after selection
   * Increased to 100 chars for better agent context
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
   * Update bubble and highlight positions based on the tracked range
   */
  function updatePositions() {
    if (!trackedRange || !commentBubble) {
      return;
    }

    try {
      // Get current position of the range
      const rects = trackedRange.getClientRects();
      if (rects.length === 0) {
        return;
      }

      // Use the first rect for bubble positioning (works for single and multi-line)
      const rect = rects[0];
      const bubbleRect = commentBubble.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 10;
      const offset = 10; // Offset from text

      // Calculate ideal position (below text, aligned with left edge)
      let left = rect.left;
      let top = rect.bottom + offset;

      // Check if bubble fits below text
      const fitsBelow = (top + bubbleRect.height + padding) <= viewportHeight;

      // Check if bubble fits above text
      const fitsAbove = (rect.top - bubbleRect.height - offset) >= padding;

      // Position vertically: prefer below, fallback to above, then clamp
      if (fitsBelow) {
        top = rect.bottom + offset;
      } else if (fitsAbove) {
        top = rect.top - bubbleRect.height - offset;
      } else {
        // Doesn't fit either above or below - position at top with padding
        // or bottom with padding, whichever gives more space
        const spaceAbove = rect.top - padding;
        const spaceBelow = viewportHeight - rect.bottom - padding;

        if (spaceBelow >= spaceAbove) {
          // More space below - align to bottom of viewport
          top = viewportHeight - bubbleRect.height - padding;
        } else {
          // More space above - align to top of viewport
          top = padding;
        }
      }

      // Position horizontally: ensure bubble stays within viewport
      // Try to align with left edge of selection
      left = rect.left;

      // If would overflow right edge, shift left
      if (left + bubbleRect.width + padding > viewportWidth) {
        left = viewportWidth - bubbleRect.width - padding;
      }

      // If would overflow left edge, shift right
      if (left < padding) {
        left = padding;
      }

      // Final safety clamps
      left = Math.max(padding, Math.min(left, viewportWidth - bubbleRect.width - padding));
      top = Math.max(padding, Math.min(top, viewportHeight - bubbleRect.height - padding));

      // Update bubble position
      commentBubble.style.left = left + 'px';
      commentBubble.style.top = top + 'px';

      // Update active highlight positions
      if (activeHighlight) {
        // Remove old highlight divs
        while (activeHighlight.firstChild) {
          activeHighlight.removeChild(activeHighlight.firstChild);
        }

        // Create new highlight divs for current positions
        for (let i = 0; i < rects.length; i++) {
          const r = rects[i];
          const highlightDiv = document.createElement('div');
          highlightDiv.className = 'commentary-active-highlight';
          highlightDiv.style.position = 'fixed';
          highlightDiv.style.left = r.left + 'px';
          highlightDiv.style.top = r.top + 'px';
          highlightDiv.style.width = r.width + 'px';
          highlightDiv.style.height = r.height + 'px';
          highlightDiv.style.pointerEvents = 'none';
          activeHighlight.appendChild(highlightDiv);
        }
      }
    } catch (error) {
      console.error('[OVERLAY] Failed to update positions:', error);
    }
  }

  /**
   * Show comment bubble near selection
   */
  function showBubble(selection, x, y) {
    // Don't call hideBubble() here - it clears currentSelection!
    // Just remove old bubble if it exists
    if (commentBubble) {
      commentBubble.remove();
    }

    // Store the range for repositioning on scroll
    trackedRange = selection.getRangeAt(0);

    commentBubble = document.createElement('div');
    commentBubble.className = 'commentary-bubble';

    // Position near cursor with viewport bounds checking
    commentBubble.style.position = 'fixed';

    // Temporarily append to measure dimensions
    commentBubble.style.visibility = 'hidden';
    document.body.appendChild(commentBubble);

    // Create bubble content
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add comment...';
    textarea.className = 'commentary-textarea';

    // Add keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      // Cmd+Enter / Ctrl+Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveComment(textarea.value);
      }
      // Escape to close
      if (e.key === 'Escape') {
        e.preventDefault();
        hideBubble();
      }
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'commentary-buttons';

    const saveBtn = document.createElement('button');
    // Detect platform for keyboard shortcut hint
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcut = isMac ? '⌘+Enter' : 'Ctrl+Enter';
    saveBtn.innerHTML = '💾 Save';
    saveBtn.title = `Save comment (${shortcut})`;
    saveBtn.className = 'commentary-btn';
    saveBtn.onclick = () => {
      console.log('[OVERLAY] Save button clicked!');
      saveComment(textarea.value);
    };

    const submitBtn = document.createElement('button');
    const agentConfig = getAgentButtonConfig();
    submitBtn.innerHTML = `${agentConfig.icon} ${agentConfig.text}`;
    submitBtn.title = agentConfig.tooltip;
    submitBtn.className = 'commentary-btn commentary-btn-primary';
    submitBtn.onclick = async () => {
      const text = textarea.value;
      if (!text.trim()) {
        return;
      }
      // Handle submission based on provider
      await handleAgentSubmit(text.trim(), currentSelection, isDocumentLevelComment, null);
      hideBubble();
      window.getSelection()?.removeAllRanges();
    };

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(submitBtn);

    commentBubble.appendChild(textarea);
    commentBubble.appendChild(buttonContainer);

    // Make visible before positioning (needed for accurate getBoundingClientRect)
    commentBubble.style.visibility = 'visible';

    // Use updatePositions for initial positioning based on the range
    updatePositions();

    // Add scroll listener to keep bubble positioned with text
    scrollListener = () => {
      updatePositions();
    };
    window.addEventListener('scroll', scrollListener, true); // Use capture for all scroll events

    // Focus textarea
    textarea.focus();
  }

  /**
   * Show comment bubble for document-level comments (near the button)
   */
  function showBubbleForDocument() {
    // Don't call hideBubble() here - it clears currentSelection!
    // Just remove old bubble if it exists
    if (commentBubble) {
      commentBubble.remove();
    }

    commentBubble = document.createElement('div');
    commentBubble.className = 'commentary-bubble';

    // Get button position
    const button = document.querySelector('.commentary-doc-button');
    let x = 70; // Default: right of button
    let y = 20; // Default: slightly below top

    if (button) {
      const buttonRect = button.getBoundingClientRect();
      x = buttonRect.right + 10; // 10px to the right of button
      y = buttonRect.top;
    }

    // Position near button with viewport bounds checking
    commentBubble.style.position = 'fixed';

    // Temporarily append to measure dimensions
    commentBubble.style.visibility = 'hidden';
    document.body.appendChild(commentBubble);

    // Create bubble content
    const textarea = document.createElement('textarea');
    textarea.placeholder = 'Add comment for entire document...';
    textarea.className = 'commentary-textarea';

    // Add keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      // Cmd+Enter / Ctrl+Enter to save
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveComment(textarea.value);
      }
      // Escape to cancel
      else if (e.key === 'Escape') {
        e.preventDefault();
        hideBubble();
      }
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'commentary-buttons';

    const saveBtn = document.createElement('button');
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcut = isMac ? '⌘+Enter' : 'Ctrl+Enter';
    saveBtn.innerHTML = '💾 Save';
    saveBtn.title = `Save comment (${shortcut})`;
    saveBtn.className = 'commentary-btn';
    saveBtn.onclick = () => saveComment(textarea.value);

    const submitBtn = document.createElement('button');
    const agentConfig = getAgentButtonConfig();
    submitBtn.innerHTML = `${agentConfig.icon} ${agentConfig.text}`;
    submitBtn.title = agentConfig.tooltip;
    submitBtn.className = 'commentary-btn commentary-btn-primary';
    submitBtn.onclick = async () => {
      const text = textarea.value;
      if (!text.trim()) {
        return;
      }
      // Handle submission based on provider
      await handleAgentSubmit(text.trim(), currentSelection, isDocumentLevelComment, null);
      hideBubble();
    };

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(submitBtn);

    commentBubble.appendChild(textarea);
    commentBubble.appendChild(buttonContainer);

    // Now measure and position with bounds checking
    const bubbleRect = commentBubble.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10;

    // Horizontal constraint
    if (x + bubbleRect.width + padding > viewportWidth) {
      x = viewportWidth - bubbleRect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }

    // Vertical constraint
    if (y + bubbleRect.height + padding > viewportHeight) {
      y = viewportHeight - bubbleRect.height - padding;
    }
    if (y < padding) {
      y = padding;
    }

    commentBubble.style.left = x + 'px';
    commentBubble.style.top = y + 'px';
    commentBubble.style.visibility = 'visible';

    // Focus textarea
    textarea.focus();
  }

  /**
   * Create a visual highlight for the active selection
   * Uses positioned divs instead of DOM manipulation to avoid errors
   */
  function createActiveHighlight(range) {
    console.log('[OVERLAY] Creating active highlight');

    // Remove any existing active highlight
    removeActiveHighlight();

    try {
      // Get all the rectangles for this range (handles multi-line)
      const rects = range.getClientRects();
      console.log('[OVERLAY] Selection has', rects.length, 'rectangles');

      // Create a container for all highlight divs
      activeHighlight = document.createElement('div');
      activeHighlight.className = 'commentary-active-highlight-container';

      // Create a div for each rectangle
      for (let i = 0; i < rects.length; i++) {
        const rect = rects[i];
        const highlightDiv = document.createElement('div');
        highlightDiv.className = 'commentary-active-highlight';
        highlightDiv.style.position = 'fixed';
        highlightDiv.style.left = rect.left + 'px';
        highlightDiv.style.top = rect.top + 'px';
        highlightDiv.style.width = rect.width + 'px';
        highlightDiv.style.height = rect.height + 'px';
        highlightDiv.style.pointerEvents = 'none'; // Don't block interactions
        activeHighlight.appendChild(highlightDiv);
      }

      document.body.appendChild(activeHighlight);
      console.log('[OVERLAY] Active highlight created with', rects.length, 'divs');
    } catch (error) {
      console.error('[OVERLAY] Failed to create active highlight:', error);
    }
  }

  /**
   * Remove the active highlight
   */
  function removeActiveHighlight() {
    if (activeHighlight && activeHighlight.parentNode) {
      console.log('[OVERLAY] Removing active highlight');
      activeHighlight.remove();
      activeHighlight = null;
    }
  }

  /**
   * Hide comment bubble
   */
  function hideBubble() {
    console.log('[OVERLAY] hideBubble called');
    if (commentBubble) {
      console.log('[OVERLAY] Removing bubble from DOM');
      commentBubble.remove();
      commentBubble = null;
    }

    // Remove scroll listener
    if (scrollListener) {
      window.removeEventListener('scroll', scrollListener, true);
      scrollListener = null;
    }

    // Clear tracked range
    trackedRange = null;

    removeActiveHighlight();
    console.log('[OVERLAY] Clearing currentSelection');
    currentSelection = null;
    isDocumentLevelComment = false; // Reset document-level flag
    editingNoteId = null; // Reset editing state
  }

  /**
   * Save comment (new or edited)
   */
  function saveComment(text) {
    console.log('saveComment called with:', text);
    console.log('currentSelection:', currentSelection);
    console.log('isDocumentLevelComment:', isDocumentLevelComment);
    console.log('editingNoteId:', editingNoteId);

    if (!text.trim() || !currentSelection) {
      console.log('Skipping save - empty text or no selection');
      return;
    }

    let message;

    if (editingNoteId) {
      // Editing existing comment
      message = {
        type: 'updateComment',
        noteId: editingNoteId,
        commentText: text.trim(),
      };
    } else {
      // Creating new comment
      message = {
        type: 'saveComment',
        selection: currentSelection,
        commentText: text.trim(),
        isDocumentLevel: isDocumentLevelComment,
        // documentUri will be added by the extension host
      };
    }

    console.log('Sending message:', message);
    postMessage(message);

    hideBubble();

    // Only clear selection if it's not a document-level comment
    if (!isDocumentLevelComment && !editingNoteId) {
      window.getSelection()?.removeAllRanges();
    }
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

      // Add click handler to edit comment
      mark.addEventListener('click', () => {
        console.log('[OVERLAY] Click on highlight', note.id);
        // Request the full note data from extension to edit
        postMessage({
          type: 'editHighlightComment',
          noteId: note.id,
        });
        bubbleJustOpened = true;
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
   * Show edit bubble for an existing comment
   */
  function showEditBubble(note) {
    console.log('[OVERLAY] Showing edit bubble for note:', note.id);

    // Set up state for editing
    editingNoteId = note.id;
    currentSelection = {
      quote: note.quote,
      position: note.position
    };

    // Get the highlight element to position near it
    const mark = highlights.get(note.id);
    if (!mark) {
      console.error('[OVERLAY] No highlight found for note:', note.id);
      return;
    }

    // Scroll to the highlight and add visual emphasis
    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    mark.classList.add('commentary-highlight-focus');
    setTimeout(() => {
      mark.classList.remove('commentary-highlight-focus');
    }, 2000);

    // Remove old bubble if exists
    if (commentBubble) {
      commentBubble.remove();
    }

    // Get the range for positioning
    const range = document.createRange();
    range.selectNode(mark);
    trackedRange = range;

    commentBubble = document.createElement('div');
    commentBubble.className = 'commentary-bubble';
    commentBubble.style.position = 'fixed';
    commentBubble.style.visibility = 'hidden';
    document.body.appendChild(commentBubble);

    // Create textarea with existing comment text
    const textarea = document.createElement('textarea');
    textarea.value = note.text; // Pre-fill with existing comment
    textarea.className = 'commentary-textarea';
    textarea.placeholder = 'Edit comment...';

    // Add keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveComment(textarea.value);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideBubble();
      }
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'commentary-buttons';

    const saveBtn = document.createElement('button');
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcut = isMac ? '⌘+Enter' : 'Ctrl+Enter';
    saveBtn.innerHTML = '💾 Save';
    saveBtn.title = `Save changes (${shortcut})`;
    saveBtn.className = 'commentary-btn';
    saveBtn.onclick = () => saveComment(textarea.value);

    const submitBtn = document.createElement('button');
    const agentConfig = getAgentButtonConfig();
    submitBtn.innerHTML = `${agentConfig.icon} ${agentConfig.text}`;
    submitBtn.title = agentConfig.tooltip;
    submitBtn.className = 'commentary-btn commentary-btn-primary';
    submitBtn.onclick = async () => {
      const text = textarea.value;
      if (!text.trim()) {
        return;
      }
      // Handle submission based on provider (includes noteId for editing)
      await handleAgentSubmit(text.trim(), currentSelection, note.isDocumentLevel, note.id);
      hideBubble();
    };

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(submitBtn);

    commentBubble.appendChild(textarea);
    commentBubble.appendChild(buttonContainer);

    // Position the bubble
    commentBubble.style.visibility = 'visible';
    updatePositions();

    // Add scroll listener
    scrollListener = () => {
      updatePositions();
    };
    window.addEventListener('scroll', scrollListener, true);

    // Focus textarea and select all text for easy editing
    textarea.focus();
    textarea.select();
  }

  /**
   * Show edit bubble for document-level comment (positioned near button)
   */
  function showEditBubbleForDocumentComment(note) {
    console.log('[OVERLAY] Showing edit bubble for document comment:', note.id);

    // Set up state for editing
    editingNoteId = note.id;
    isDocumentLevelComment = true;
    currentSelection = {
      quote: note.quote,
      position: note.position
    };

    // Remove old bubble if exists
    if (commentBubble) {
      commentBubble.remove();
    }

    commentBubble = document.createElement('div');
    commentBubble.className = 'commentary-bubble';
    commentBubble.style.position = 'fixed';

    // Get button position
    const button = document.querySelector('.commentary-doc-button');
    let x = 70; // Default: right of button
    let y = 20; // Default: slightly below top

    if (button) {
      const buttonRect = button.getBoundingClientRect();
      x = buttonRect.right + 10;
      y = buttonRect.top;
    }

    // Temporarily append to measure dimensions
    commentBubble.style.visibility = 'hidden';
    document.body.appendChild(commentBubble);

    // Create textarea with existing comment text
    const textarea = document.createElement('textarea');
    textarea.value = note.text;
    textarea.className = 'commentary-textarea';
    textarea.placeholder = 'Edit document comment...';

    // Add keyboard shortcuts
    textarea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        saveComment(textarea.value);
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideBubble();
      }
    });

    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'commentary-buttons';

    const saveBtn = document.createElement('button');
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcut = isMac ? '⌘+Enter' : 'Ctrl+Enter';
    saveBtn.innerHTML = '💾 Save';
    saveBtn.title = `Save changes (${shortcut})`;
    saveBtn.className = 'commentary-btn';
    saveBtn.onclick = () => saveComment(textarea.value);

    const submitBtn = document.createElement('button');
    const agentConfig = getAgentButtonConfig();
    submitBtn.innerHTML = `${agentConfig.icon} ${agentConfig.text}`;
    submitBtn.title = agentConfig.tooltip;
    submitBtn.className = 'commentary-btn commentary-btn-primary';
    submitBtn.onclick = async () => {
      const text = textarea.value;
      if (!text.trim()) {
        return;
      }
      // Handle submission based on provider (includes noteId for editing)
      await handleAgentSubmit(text.trim(), currentSelection, true, note.id);
      hideBubble();
    };

    buttonContainer.appendChild(saveBtn);
    buttonContainer.appendChild(submitBtn);

    commentBubble.appendChild(textarea);
    commentBubble.appendChild(buttonContainer);

    // Position with viewport bounds checking
    const bubbleRect = commentBubble.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 10;

    if (x + bubbleRect.width + padding > viewportWidth) {
      x = viewportWidth - bubbleRect.width - padding;
    }
    if (x < padding) {
      x = padding;
    }
    if (y + bubbleRect.height + padding > viewportHeight) {
      y = viewportHeight - bubbleRect.height - padding;
    }
    if (y < padding) {
      y = padding;
    }

    commentBubble.style.left = x + 'px';
    commentBubble.style.top = y + 'px';
    commentBubble.style.visibility = 'visible';

    // Focus textarea and select all text
    textarea.focus();
    textarea.select();
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

      case 'showEditBubble':
        showEditBubble(message.note);
        break;

      case 'showEditBubbleForDocument':
        showEditBubbleForDocumentComment(message.note);
        break;

      case 'showNewDocumentBubble':
        // Set up for new document comment
        isDocumentLevelComment = true;
        currentSelection = {
          quote: {
            exact: '[Entire Document]',
            prefix: '',
            suffix: ''
          },
          position: {
            start: 0,
            end: document.body.textContent.length
          }
        };
        showBubbleForDocument();
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
  console.log('[OVERLAY.JS] Checking document.readyState:', document.readyState);
  if (document.readyState === 'loading') {
    console.log('[OVERLAY.JS] Document still loading, waiting for DOMContentLoaded');
    document.addEventListener('DOMContentLoaded', init);
  } else {
    console.log('[OVERLAY.JS] Document already loaded, calling init() now');
    init();
  }
  console.log('[OVERLAY.JS] IIFE complete');
})();

console.log('[OVERLAY.JS] Script fully loaded');
