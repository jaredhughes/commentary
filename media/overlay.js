/**
 * Commentary overlay script - injected into Markdown preview
 * Handles text selection, comment bubbles, and highlighting
 */

console.log('[OVERLAY.JS] Script is loading...');

(function () {
  'use strict';

  console.log('[OVERLAY.JS] IIFE starting...');

  // Note: VS Code API is already acquired in the HTML template
  // and available as window.commentaryPostMessage

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
    const isClaude = provider === 'claude';

    console.log('[OVERLAY] getAgentButtonConfig - provider:', provider, 'isClaude:', isClaude);

    return {
      icon: isClaude ? '✨' : '📋',
      text: isClaude ? 'Send to agent' : 'Copy for agent',
      tooltip: isClaude
        ? 'Send comment to Claude Code via terminal'
        : 'Copy comment to clipboard and open Cursor chat'
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

    // Listen for mouseup to detect selections
    document.addEventListener('mouseup', handleMouseUp);
    console.log('[OVERLAY.JS] mouseup listener added');

    // Listen for messages from extension
    window.addEventListener('message', handleHostMessage);
    console.log('[OVERLAY.JS] message listener added');

    // Notify extension that preview is ready
    postMessage({ type: 'ready' });
    console.log('[OVERLAY.JS] Ready message sent');
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
    // Create a range from start of document to the position
    const range = document.createRange();
    range.setStart(document.body, 0);
    range.setEnd(node, offset);
    return range.toString();
  }

  /**
   * Get text after a position
   */
  function getTextAfter(node, offset) {
    // Create a range from the position to end of document
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(document.body, document.body.childNodes.length);
    return range.toString();
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
   * Create and show comment modal (unified function for all cases)
   * @param {Object} options - Configuration options
   * @param {string} options.placeholder - Textarea placeholder text
   * @param {string} [options.value=''] - Initial textarea value (for editing)
   * @param {string} [options.noteId] - Note ID (for editing)
   * @param {'selection'|'button'} options.positionType - How to position the modal
   * @param {Selection} [options.selection] - DOM selection (for selection-based positioning)
   * @param {Range} [options.range] - DOM range (alternative to selection for positioning)
   * @param {number} [options.x] - X coordinate (for button-based positioning)
   * @param {number} [options.y] - Y coordinate (for button-based positioning)
   */
  function showCommentModal(options) {
    const {
      placeholder = 'Add comment...',
      value = '',
      noteId = null,
      positionType,
      selection = null,
      range = null,
      x = 0,
      y = 0
    } = options;

    // Don't call hideBubble() here - it clears currentSelection!
    // Just remove old bubble if it exists
    if (commentBubble) {
      commentBubble.remove();
    }

    // For selection-based positioning, store the range for repositioning on scroll
    if (positionType === 'selection') {
      if (range) {
        trackedRange = range;
      } else if (selection) {
        trackedRange = selection.getRangeAt(0);
      }
    }

    commentBubble = document.createElement('div');
    commentBubble.className = 'commentary-bubble';
    commentBubble.style.position = 'fixed';

    // Temporarily append to measure dimensions
    commentBubble.style.visibility = 'hidden';
    document.body.appendChild(commentBubble);

    // Create textarea
    const textarea = document.createElement('textarea');
    textarea.placeholder = placeholder;
    textarea.value = value;
    textarea.className = 'commentary-textarea';

    // Create button container
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'commentary-buttons';

    // Submit button (primary action)
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
      await handleAgentSubmit(text.trim(), currentSelection, isDocumentLevelComment, noteId);
      hideBubble();
      if (positionType === 'selection') {
        window.getSelection()?.removeAllRanges();
      }
    };
    buttonContainer.appendChild(submitBtn);

    // Save button
    const saveBtn = document.createElement('button');
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const shortcut = isMac ? '⌘+Enter' : 'Ctrl+Enter';
    saveBtn.innerHTML = '💾 Save';
    saveBtn.title = `Save comment (${shortcut})`;
    saveBtn.className = 'commentary-btn';
    saveBtn.onclick = () => saveComment(textarea.value);
    buttonContainer.appendChild(saveBtn);

    // Input validation: Enable/disable buttons based on text content
    const updateButtonStates = () => {
      const hasText = textarea.value.trim().length > 0;
      submitBtn.disabled = !hasText;
      saveBtn.disabled = !hasText;
    };

    // Set initial button states
    updateButtonStates();

    // Update button states on input
    textarea.addEventListener('input', updateButtonStates);

    // Add keyboard shortcuts (after button creation so we can check disabled state)
    textarea.addEventListener('keydown', (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!saveBtn.disabled) {
          saveComment(textarea.value);
        }
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        hideBubble();
      }
    });

    // Add global escape handler (when bubble is open but textarea isn't focused)
    const globalEscapeHandler = (e) => {
      if (e.key === 'Escape' && commentBubble) {
        e.preventDefault();
        e.stopPropagation();
        hideBubble();
      }
    };
    document.addEventListener('keydown', globalEscapeHandler);
    
    // Clean up global handler when bubble is hidden
    const originalHideBubble = hideBubble;
    hideBubble = function() {
      document.removeEventListener('keydown', globalEscapeHandler);
      hideBubble = originalHideBubble; // Restore original
      originalHideBubble();
    };

    // Delete button (only for editing)
    if (noteId) {
      const deleteBtn = document.createElement('button');
      deleteBtn.innerHTML = '<i class="codicon codicon-trash"></i>';
      deleteBtn.title = 'Delete this comment';
      deleteBtn.className = 'commentary-btn commentary-btn-danger commentary-btn-icon commentary-btn-right';
      deleteBtn.onclick = () => {
        console.log('[OVERLAY] Delete button clicked, noteId:', noteId);
        if (confirm('Delete this comment?')) {
          console.log('[OVERLAY] User confirmed deletion');
          postMessage({
            type: 'deleteComment',
            noteId: noteId,
            documentUri: window.commentaryDocumentUri
          });
          hideBubble();
        }
      };
      buttonContainer.appendChild(deleteBtn);
    }

    commentBubble.appendChild(textarea);
    commentBubble.appendChild(buttonContainer);

    // Position the modal
    commentBubble.style.visibility = 'visible';

    if (positionType === 'selection' && trackedRange) {
      // Position relative to selected text with scroll tracking
      updatePositions();
      scrollListener = () => updatePositions();
      window.addEventListener('scroll', scrollListener, true);
    } else {
      // Position at fixed coordinates (button-based)
      const bubbleRect = commentBubble.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const padding = 10;

      let finalX = x;
      let finalY = y;

      // Horizontal constraint
      if (finalX + bubbleRect.width + padding > viewportWidth) {
        finalX = viewportWidth - bubbleRect.width - padding;
      }
      if (finalX < padding) {
        finalX = padding;
      }

      // Vertical constraint
      if (finalY + bubbleRect.height + padding > viewportHeight) {
        finalY = viewportHeight - bubbleRect.height - padding;
      }
      if (finalY < padding) {
        finalY = padding;
      }

      commentBubble.style.left = finalX + 'px';
      commentBubble.style.top = finalY + 'px';
    }

    // Focus textarea
    textarea.focus();
    if (value) {
      textarea.select(); // Select existing text for easy editing
    }
  }

  /**
   * Show comment bubble near selection (wrapper)
   */
  function showBubble(selection, x, y) {
    showCommentModal({
      placeholder: 'Add comment...',
      positionType: 'selection',
      selection: selection
    });
  }

  /**
   * Show comment bubble for document-level comments (near the button)
   */
  function showBubbleForDocument() {
    // Get button position
    const button = document.querySelector('.commentary-doc-button');
    let x = 70; // Default: right of button
    let y = 20; // Default: slightly below top

    if (button) {
      const buttonRect = button.getBoundingClientRect();
      x = buttonRect.right + 10; // 10px to the right of button
      y = buttonRect.top;
    }

    showCommentModal({
      placeholder: 'Add comment for entire document...',
      positionType: 'button',
      x: x,
      y: y
    });
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
        documentUri: window.commentaryDocumentUri
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
    console.log('[OVERLAY] paintHighlights called with', notes.length, 'notes');

    // Clear existing highlights
    clearHighlights();
    console.log('[OVERLAY] Cleared existing highlights');

    let successCount = 0;
    let failCount = 0;

    for (const note of notes) {
      const success = paintHighlight(note);
      if (success) {
        successCount++;
      } else {
        failCount++;
      }
    }

    console.log('[OVERLAY] Painted highlights: success=' + successCount + ', failed=' + failCount);
    console.log('[OVERLAY] Highlights map now has', highlights.size, 'entries');
  }

  /**
   * Paint a single highlight
   */
  function paintHighlight(note) {
    console.log('[OVERLAY] Painting highlight for note:', note.id, 'text:', note.text.substring(0, 30));

    // Skip document-level comments (no visible highlight)
    if (note.isDocumentLevel) {
      console.log('[OVERLAY] Skipping document-level comment:', note.id);
      return true;
    }

    // Try to find the text using the quote selector
    const range = findTextRange(note.quote);

    if (!range) {
      console.warn('[OVERLAY] Could not anchor note:', note.id, 'selected text:', note.quote.exact.substring(0, 30));
      return false;
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

      console.log('[OVERLAY] Successfully painted highlight:', note.id);
      return true;
    } catch (error) {
      console.error('[OVERLAY] Failed to paint highlight:', note.id, error);
      return false;
    }
  }

  /**
   * Find a text range using TextQuoteSelector with prefix/suffix disambiguation
   */
  function findTextRange(quote) {
    const bodyText = document.body.textContent || '';

    // Use prefix and suffix to find the correct occurrence
    // Build the search pattern: prefix + exact + suffix
    const prefixToUse = quote.prefix || '';
    const suffixToUse = quote.suffix || '';
    const searchText = prefixToUse + quote.exact + suffixToUse;

    // Find the full pattern
    const patternIndex = bodyText.indexOf(searchText);

    if (patternIndex === -1) {
      console.warn('[OVERLAY] Could not find text pattern:', {
        prefix: prefixToUse.substring(Math.max(0, prefixToUse.length - 20)),
        exact: quote.exact.substring(0, 50),
        suffix: suffixToUse.substring(0, 20)
      });

      // Fallback: try without prefix/suffix
      const exactIndex = bodyText.indexOf(quote.exact);
      if (exactIndex === -1) {
        console.error('[OVERLAY] Could not find exact text either');
        return null;
      }

      console.warn('[OVERLAY] Found exact text without prefix/suffix at:', exactIndex);
      return findRangeAtIndex(exactIndex, quote.exact.length);
    }

    // Calculate the actual start position (after the prefix)
    const exactStart = patternIndex + prefixToUse.length;
    console.log('[OVERLAY] Found text range at position:', exactStart);

    return findRangeAtIndex(exactStart, quote.exact.length);
  }

  /**
   * Helper: Find DOM range at a specific character index
   */
  function findRangeAtIndex(index, length) {
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

      // Find start node
      if (!startNode && currentPos <= index && currentPos + nodeLength > index) {
        startNode = node;
        startOffset = index - currentPos;
      }

      // Find end node
      if (currentPos <= index + length && currentPos + nodeLength >= index + length) {
        endNode = node;
        endOffset = index + length - currentPos;
        break;
      }

      currentPos += nodeLength;
    }

    if (startNode && endNode) {
      try {
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
      } catch (error) {
        console.error('[OVERLAY] Failed to create range:', error, {
          startOffset,
          endOffset,
          startNodeLength: startNode.textContent.length,
          endNodeLength: endNode.textContent.length
        });
        return null;
      }
    }

    console.error('[OVERLAY] Could not find start/end nodes for range');
    return null;
  }

  /**
   * Clear all highlights
   */
  function clearHighlights() {
    console.log('[OVERLAY] Clearing', highlights.size, 'highlights');

    for (const [noteId, mark] of highlights.entries()) {
      // Unwrap the mark element
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) {
          parent.insertBefore(mark.firstChild, mark);
        }
        parent.removeChild(mark);

        // Normalize text nodes after unwrapping to merge adjacent text nodes
        parent.normalize();
      }
    }
    highlights.clear();

    // Normalize the entire markdown content container to ensure clean text nodes
    const markdownContent = document.getElementById('markdown-content');
    if (markdownContent) {
      markdownContent.normalize();
    }

    console.log('[OVERLAY] All highlights cleared and text nodes normalized');
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
  function showEditBubble(note, shouldScroll = false) {
    console.log('[OVERLAY] Showing edit bubble for note:', note.id, 'shouldScroll:', shouldScroll);
    console.log('[OVERLAY] Current highlights map:', highlights);
    console.log('[OVERLAY] Highlights map size:', highlights.size);

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
      console.error('[OVERLAY] Available highlight IDs:', Array.from(highlights.keys()));

      // Show a user-friendly message
      alert('Could not find this comment in the document. Try refreshing the preview.');
      return;
    }

    // Only scroll if requested (e.g., when clicking from sidebar)
    if (shouldScroll) {
      mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    
    // Always add visual emphasis
    mark.classList.add('commentary-highlight-focus');
    setTimeout(() => {
      mark.classList.remove('commentary-highlight-focus');
    }, 2000);

    // Get the range for positioning
    const range = document.createRange();
    range.selectNode(mark);

    // Use unified modal function
    showCommentModal({
      placeholder: 'Edit comment...',
      value: note.text,
      noteId: note.id,
      positionType: 'selection',
      range: range
    });
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

    // Get button position
    const button = document.querySelector('.commentary-doc-button');
    let x = 70; // Default: right of button
    let y = 20; // Default: slightly below top

    if (button) {
      const buttonRect = button.getBoundingClientRect();
      x = buttonRect.right + 10;
      y = buttonRect.top;
    }

    // Use unified modal function
    showCommentModal({
      placeholder: 'Edit document comment...',
      value: note.text,
      noteId: note.id,
      positionType: 'button',
      x: x,
      y: y
    });
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
        showEditBubble(message.note, message.shouldScroll);
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

      case 'updateProvider':
        // Update provider and refresh any visible edit bubbles
        window.commentaryAgentProvider = message.provider;
        console.log('[OVERLAY] Provider updated to:', message.provider);

        // If there's a visible edit bubble, update its button text
        if (commentBubble && commentBubble.parentNode) {
          const submitBtn = commentBubble.querySelector('.commentary-btn-primary');
          if (submitBtn) {
            const agentConfig = getAgentButtonConfig();
            submitBtn.innerHTML = `${agentConfig.icon} ${agentConfig.text}`;
            submitBtn.title = agentConfig.tooltip;
            console.log('[OVERLAY] Updated submit button to:', agentConfig.text);
          }
        }
        break;
    }
  }

  /**
   * Send message to extension host
   */
  function postMessage(message) {
    window.commentaryPostMessage(message);
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
