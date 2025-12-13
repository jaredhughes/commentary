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
  let bubbleOpenedAt = 0; // Timestamp when bubble was opened (to debounce immediate closes)
  let activeHighlight = null; // Temporary highlight while bubble is open
  let trackedRange = null; // Track the range for repositioning on scroll
  let scrollListener = null; // Reference to scroll listener for cleanup
  let isDocumentLevelComment = false; // Track if current bubble is for document-level comment
  let editingNoteId = null; // Track which note is being edited (null for new comments)

  /**
   * Update the theme stylesheet dynamically
   * @param {string} themeName - The name of the theme to load
   * @param {boolean} [vsCodeIsDark] - Whether VS Code is using a dark theme (for Pico themes)
   */
  function updateThemeStylesheet(themeName, vsCodeIsDark) {
    console.log('[OVERLAY] updateThemeStylesheet called with:', themeName, 'vsCodeIsDark:', vsCodeIsDark);

    // Find the existing theme link element
    const themeLink = document.querySelector('link[data-theme-name]');
    if (!themeLink) {
      console.error('[OVERLAY] Could not find theme link element');
      return;
    }

    console.log('[OVERLAY] Current theme link:', themeLink.getAttribute('data-theme-name'));

    // Extract the base URL (without the theme filename and cache buster)
    const currentHref = themeLink.href;
    const urlParts = currentHref.split('/');
    // Remove the filename (last part) and reconstruct base URL
    urlParts.pop();
    const baseUrl = urlParts.join('/');

    // Generate new cache-busting parameter
    const cacheBuster = `${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const newHref = `${baseUrl}/${themeName}.css?v=${cacheBuster}`;

    console.log('[OVERLAY] New theme href:', newHref);
    console.log('[OVERLAY] Base URL extracted:', baseUrl);

    // Create a NEW link element to ensure proper loading (some browsers cache aggressively)
    const newLink = document.createElement('link');
    newLink.rel = 'stylesheet';
    newLink.href = newHref;
    newLink.setAttribute('data-theme-name', themeName);

    // Add load/error handlers to detect loading issues
    newLink.addEventListener('load', () => {
      console.log('[OVERLAY] Theme stylesheet loaded successfully:', themeName);
      // Remove old stylesheet after new one loads
      if (themeLink.parentNode) {
        themeLink.parentNode.removeChild(themeLink);
      }
    });
    newLink.addEventListener('error', (e) => {
      console.error('[OVERLAY] Theme stylesheet FAILED to load:', themeName, e);
      // Keep old stylesheet on error
    });

    // Insert new link right after the old one (to maintain CSS order)
    themeLink.parentNode.insertBefore(newLink, themeLink.nextSibling);

    // Pico themes require data-theme attribute for dark/light mode
    // Body colors are now handled directly in the Pico CSS files
    const isPicoTheme = themeName.startsWith('pico-');

    if (isPicoTheme) {
      // Use VS Code color theme if provided, otherwise fallback to system preference
      let isDark = vsCodeIsDark;
      if (isDark === undefined) {
        isDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
      }
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
      console.log('[OVERLAY] Set data-theme for Pico theme:', isDark ? 'dark' : 'light');
    } else {
      // Remove data-theme attribute for non-Pico themes
      document.documentElement.removeAttribute('data-theme');
    }

    // Also update syntax highlighting theme based on whether theme is dark
    // For Pico themes, use vsCodeIsDark since theme names like 'pico-amber' don't indicate dark/light
    const isDarkTheme = isPicoTheme
      ? vsCodeIsDark
      : (themeName.includes('dark') || themeName === 'sakura-vader' || themeName === 'simple');
    const highlightTheme = isDarkTheme ? 'highlight-dark.css' : 'highlight-light.css';

    const highlightLink = document.querySelector('link[data-highlight-theme]');
    if (highlightLink) {
      const highlightUrlParts = highlightLink.href.split('/');
      highlightUrlParts.pop();
      const highlightBaseUrl = highlightUrlParts.join('/');
      const newHighlightHref = `${highlightBaseUrl}/${highlightTheme}?v=${cacheBuster}`;

      console.log('[OVERLAY] Updating syntax highlighting to:', highlightTheme);
      highlightLink.href = newHighlightHref;
      highlightLink.setAttribute('data-highlight-theme', highlightTheme);
    }

    console.log('[OVERLAY] Theme stylesheet update initiated');

    // Debug: Log full state after theme change
    setTimeout(() => {
      const currentThemeLink = document.querySelector('link[data-theme-name]');
      console.log('[OVERLAY] Post-update state:', {
        htmlDataTheme: document.documentElement.getAttribute('data-theme'),
        themeLinkHref: currentThemeLink?.href,
        themeLinkDataName: currentThemeLink?.getAttribute('data-theme-name'),
        sheetLoaded: currentThemeLink?.sheet !== null,
        computedBgColor: getComputedStyle(document.documentElement).backgroundColor,
        computedColor: getComputedStyle(document.documentElement).color,
      });
    }, 200); // Delay to allow stylesheet to load
  }

  /**
   * Get agent button text and icon based on provider
   */
  function getAgentButtonConfig() {
    return window.commentaryButtonConfigs?.agent || {
      icon: '<i class="codicon codicon-copy"></i>',
      text: 'Copy for agent',
      tooltip: 'Copy comment to clipboard'
    };
  }

  function getSaveButtonConfig() {
    return window.commentaryButtonConfigs?.save || {
      icon: '<i class="codicon codicon-save"></i>',
      text: 'Save',
      tooltip: 'Save comment'
    };
  }

  function getDeleteButtonConfig() {
    return window.commentaryButtonConfigs?.delete || {
      icon: '<i class="codicon codicon-trash"></i>',
      text: '',
      tooltip: 'Delete this comment'
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

    // Listen for selection changes to hide the action button when selection is cleared
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      if (!selection || selection.isCollapsed || selection.toString().trim().length === 0) {
        // Selection was cleared - hide the action button
        if (selectionActionButton) {
          hideSelectionActionButton();
        }
      }
    });
    console.log('[OVERLAY.JS] selectionchange listener added');

    // Intercept clicks on markdown links to open in Commentary
    document.addEventListener('click', handleLinkClick);
    console.log('[OVERLAY.JS] link click listener added');

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

  // Selection action button (Google Docs style - small icon that appears on selection)
  let selectionActionButton = null;
  let pendingSelection = null; // Store selection for when user clicks the action button

  /**
   * Show a small action button near the selection (Google Docs style)
   * User can still copy text freely - clicking this button opens the comment bubble
   */
  function showSelectionActionButton(selection, x, y) {
    hideSelectionActionButton();

    // Store the selection for when user clicks
    pendingSelection = {
      selection: serializeSelection(selection),
      range: selection.getRangeAt(0).cloneRange()
    };

    if (!pendingSelection.selection) {
      console.log('[OVERLAY] Could not serialize selection');
      return;
    }

    // Create small floating button
    const button = document.createElement('button');
    button.className = 'commentary-selection-action';
    button.innerHTML = '<i class="codicon codicon-comment"></i>';
    button.title = 'Add comment';

    // Position the button to the right of the cursor, below the line
    // to avoid overlapping the selected text
    const range = selection.getRangeAt(0);
    const rects = range.getClientRects();
    const lastRect = rects[rects.length - 1]; // Get the last line of selection

    button.style.position = 'fixed';
    if (lastRect) {
      // Position at the end of the last line, slightly below
      button.style.left = `${lastRect.right + 8}px`;
      button.style.top = `${lastRect.top + (lastRect.height / 2) - 14}px`;
    } else {
      // Fallback to mouse position
      button.style.left = `${x + 16}px`;
      button.style.top = `${y + 4}px`;
    }
    button.style.zIndex = '10001';

    // Handle click - open full comment bubble
    button.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (pendingSelection) {
        currentSelection = pendingSelection.selection;
        createActiveHighlight(pendingSelection.range);

        // Position bubble near the selected text using the stored range
        showCommentModal({
          placeholder: 'Add comment...',
          positionType: 'selection',
          range: pendingSelection.range
        });
        bubbleOpenedAt = Date.now();
      }

      hideSelectionActionButton();
    };

    document.body.appendChild(button);
    selectionActionButton = button;
    console.log('[OVERLAY] Selection action button shown');
  }

  /**
   * Hide the selection action button
   */
  function hideSelectionActionButton() {
    if (selectionActionButton) {
      selectionActionButton.remove();
      selectionActionButton = null;
      console.log('[OVERLAY] Selection action button hidden');
    }
    pendingSelection = null;
  }

  /**
   * Handle mouse up event (potential selection)
   */
  function handleMouseUp(event) {
    console.log('[OVERLAY] handleMouseUp fired, target:', event.target);
    console.log('[OVERLAY] commentBubble exists:', !!commentBubble);

    // Ignore events that fire within 100ms of opening the bubble (debounce)
    const timeSinceOpen = Date.now() - bubbleOpenedAt;
    if (bubbleOpenedAt > 0 && timeSinceOpen < 100) {
      console.log('[OVERLAY] Ignoring mouseup - bubble just opened', timeSinceOpen, 'ms ago');
      return;
    }

    // Don't process if clicking inside the bubble
    if (commentBubble && commentBubble.contains(event.target)) {
      console.log('[OVERLAY] Click inside bubble, ignoring');
      return;
    }

    // Don't process if clicking on the selection action button
    if (selectionActionButton && selectionActionButton.contains(event.target)) {
      console.log('[OVERLAY] Click on selection action button, ignoring mouseup');
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

      // Fall through to show selection action button
      console.log('[OVERLAY] New selection detected');
    }

    // Hide any existing selection action button
    hideSelectionActionButton();

    // Only show selection action button if there's a valid text selection
    if (!hasValidSelection) {
      console.log('[OVERLAY] No selection, nothing to show');
      return;
    }

    // Valid selection - show small action button (Google Docs style)
    // User can still copy freely, button only appears after selection
    // Clicking button opens the full comment bubble
    showSelectionActionButton(selection, event.clientX, event.clientY);
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

    console.log('[OVERLAY] Serialized selection:', { exact, prefix, suffix, position });

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
   * Get the markdown content container (excludes overlay elements)
   */
  function getContentContainer() {
    return document.getElementById('markdown-content') || document.body;
  }

  /**
   * Get text before a position
   */
  function getTextBefore(node, offset) {
    // Create a range from start of content to the position
    const container = getContentContainer();
    const range = document.createRange();
    range.setStart(container, 0);
    range.setEnd(node, offset);
    return range.toString();
  }

  /**
   * Get text after a position
   */
  function getTextAfter(node, offset) {
    // Create a range from the position to end of content
    const container = getContentContainer();
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(container, container.childNodes.length);
    return range.toString();
  }

  /**
   * Get text position (character offsets from content container start)
   */
  function getTextPosition(range) {
    const container = getContentContainer();
    try {
      const preRange = range.cloneRange();
      preRange.selectNodeContents(container);
      preRange.setEnd(range.startContainer, range.startOffset);

      const start = preRange.toString().length;
      const length = range.toString().length;
      const end = start + length;

      if (typeof preRange.detach === 'function') {
        preRange.detach();
      }

      return { start, end };
    } catch (error) {
      console.error('[OVERLAY] Failed to calculate precise text position, falling back to indexOf', error);

      const contentText = container.textContent || '';
      const selectedText = range.toString();
      const start = contentText.indexOf(selectedText);
      const end = start === -1 ? -1 : start + selectedText.length;

      return { start, end };
    }
  }

  /**
   * Update bubble and highlight positions based on the tracked range
   */
  function updatePositions() {
    if (!trackedRange || !commentBubble) {
      console.log('[OVERLAY] updatePositions: missing trackedRange or bubble');
      return;
    }

    try {
      // Get current position of the range
      let rects = trackedRange.getClientRects();
      let rect;

      if (rects.length === 0) {
        // Fallback: try getBoundingClientRect
        const boundingRect = trackedRange.getBoundingClientRect();
        if (boundingRect.width === 0 && boundingRect.height === 0) {
          console.log('[OVERLAY] updatePositions: no rects available, using fallback position');
          // Position in center of viewport as fallback
          const bubbleRect = commentBubble.getBoundingClientRect();
          commentBubble.style.left = Math.max(10, (window.innerWidth - bubbleRect.width) / 2) + 'px';
          commentBubble.style.top = Math.max(10, (window.innerHeight - bubbleRect.height) / 3) + 'px';
          return;
        }
        rect = boundingRect;
      } else {
        // Use the first rect for bubble positioning (works for single and multi-line)
        rect = rects[0];
      }
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
    const saveBtnConfig = getSaveButtonConfig();
    saveBtn.innerHTML = saveBtnConfig.icon + (saveBtnConfig.text ? ' ' + saveBtnConfig.text : '');
    saveBtn.title = saveBtnConfig.tooltip;
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
    hideBubble = function () {
      document.removeEventListener('keydown', globalEscapeHandler);
      hideBubble = originalHideBubble; // Restore original
      originalHideBubble();
    };

    // Delete button (only for editing)
    if (noteId) {
      const deleteBtn = document.createElement('button');
      const deleteBtnConfig = getDeleteButtonConfig();
      deleteBtn.innerHTML = deleteBtnConfig.icon;
      deleteBtn.title = deleteBtnConfig.tooltip;
      deleteBtn.className = 'commentary-btn commentary-btn-danger commentary-btn-icon commentary-btn-right';
      deleteBtn.onclick = () => {
        console.log('[OVERLAY] Delete button clicked, noteId:', noteId);
        postMessage({
          type: 'deleteComment',
          noteId: noteId,
          documentUri: window.commentaryDocumentUri
        });
        // Don't hide bubble here - wait for host's removeHighlight message
        // This way bubble stays open if user cancels deletion
      };
      buttonContainer.appendChild(deleteBtn);
    }

    // Note: Copy button removed - users can use standard Cmd+C to copy selected text

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
    let range = findTextRange(note.quote);

    if (!range) {
      console.warn('[OVERLAY] Could not anchor note via quote:', note.id, 'selected text:', note.quote.exact.substring(0, 30));
      range = findRangeFromPosition(note.position);
      if (range) {
        console.warn('[OVERLAY] Falling back to position anchoring for note:', note.id);
      } else {
        return false;
      }
    }

    // Create highlight mark element
    const mark = document.createElement('mark');
    mark.className = 'commentary-highlight';
    mark.dataset.noteId = note.id;
    mark.title = note.text;

    const created = wrapRangeWithMark(range, mark);
    if (!created) {
      console.error('[OVERLAY] Failed to paint highlight:', note.id);
      return false;
    }

    highlights.set(note.id, mark);

    // Click handler function to be attached to all marks
    const clickHandler = () => {
      console.log('[OVERLAY] Click on highlight', note.id);
      // Request the full note data from extension to edit
      postMessage({
        type: 'editHighlightComment',
        noteId: note.id,
      });
      bubbleOpenedAt = Date.now();
    };

    // Add click handler to all marks (handles multi-mark case)
    if (mark._multiMarks) {
      // Multiple marks - add handler to each
      for (const m of mark._multiMarks) {
        m.addEventListener('click', clickHandler);
      }
    } else if (mark._realMark) {
      // Single mark created in fallback - add handler to the real mark
      mark._realMark.addEventListener('click', clickHandler);
    } else {
      // Simple case - mark was created directly
      mark.addEventListener('click', clickHandler);
    }

    console.log('[OVERLAY] Successfully painted highlight:', note.id);
    return true;
  }

  /**
   * Find a text range using TextQuoteSelector with prefix/suffix disambiguation
   */
  function findTextRange(quote) {
    const container = getContentContainer();
    const contentText = container.textContent || '';

    // Use prefix and suffix to find the correct occurrence
    // Build the search pattern: prefix + exact + suffix
    const prefixToUse = quote.prefix || '';
    const suffixToUse = quote.suffix || '';
    const searchText = prefixToUse + quote.exact + suffixToUse;

    // Find the full pattern
    const patternIndex = contentText.indexOf(searchText);

    if (patternIndex === -1) {
      console.warn('[OVERLAY] Could not find text pattern:', {
        prefix: prefixToUse.substring(Math.max(0, prefixToUse.length - 20)),
        exact: quote.exact.substring(0, 50),
        suffix: suffixToUse.substring(0, 20)
      });

      // Fallback: try without prefix/suffix
      const exactIndex = contentText.indexOf(quote.exact);
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

    const range = findRangeAtIndex(exactStart, quote.exact.length);

    // Validate that the found range actually contains the expected text
    if (range) {
      const foundText = range.toString();
      if (foundText !== quote.exact) {
        console.warn('[OVERLAY] Found text does not match expected:', {
          expected: quote.exact,
          found: foundText,
          position: exactStart
        });
        // Don't return null - the text might have minor whitespace differences
        // But log for debugging
      }
    }

    return range;
  }

  /**
   * Helper: Find DOM range at a specific character index
   */
  function findRangeAtIndex(index, length) {
    const container = getContentContainer();
    const range = document.createRange();
    const walker = document.createTreeWalker(
      container,
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
   * Fallback: rebuild range using stored character offsets
   */
  function findRangeFromPosition(position) {
    if (!position) {
      return null;
    }

    const start = Number(position.start);
    const end = Number(position.end);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start < 0) {
      return null;
    }

    return findRangeAtIndex(start, end - start);
  }

  /**
   * Safely wrap DOM range with a <mark>, with fallback for complex selections
   * Uses non-destructive text node wrapping for cross-boundary ranges
   */
  function wrapRangeWithMark(range, mark) {
    try {
      range.surroundContents(mark);
      return true;
    } catch (error) {
      console.warn('[OVERLAY] surroundContents failed, attempting text node wrapping fallback', error);

      // Non-destructive fallback: wrap each text node portion individually
      // This avoids extractContents() which can corrupt DOM structure in lists/code blocks
      try {
        const textNodes = getTextNodesInRange(range);
        if (textNodes.length === 0) {
          console.error('[OVERLAY] No text nodes found in range');
          return false;
        }

        // Create a wrapper to hold references to all mark elements
        const marks = [];

        for (let i = 0; i < textNodes.length; i++) {
          const { node, startOffset, endOffset } = textNodes[i];
          const textContent = node.textContent;

          // Skip empty portions
          if (startOffset >= endOffset || startOffset >= textContent.length) {
            continue;
          }

          // Split text node and wrap the middle portion
          const wrapMark = document.createElement('mark');
          wrapMark.className = 'commentary-highlight';
          wrapMark.dataset.noteId = mark.dataset.noteId;
          wrapMark.title = mark.title;

          // Split the text node: [before][highlighted][after]
          const beforeText = textContent.substring(0, startOffset);
          const highlightText = textContent.substring(startOffset, endOffset);
          const afterText = textContent.substring(endOffset);

          // Skip whitespace-only text (prevents empty mark boxes on newlines)
          if (!highlightText.trim()) {
            continue;
          }

          // Create new nodes
          const parent = node.parentNode;
          if (!parent) {
            continue;
          }

          // Replace original node with: beforeText + mark(highlightText) + afterText
          if (beforeText) {
            parent.insertBefore(document.createTextNode(beforeText), node);
          }

          wrapMark.textContent = highlightText;
          parent.insertBefore(wrapMark, node);
          marks.push(wrapMark);

          if (afterText) {
            parent.insertBefore(document.createTextNode(afterText), node);
          }

          // Remove original node
          parent.removeChild(node);
        }

        if (marks.length === 0) {
          console.error('[OVERLAY] Failed to create any highlight marks');
          return false;
        }

        // Store reference to first mark (or all marks for multi-span highlights)
        // The passed-in mark object will be used as a proxy - copy properties from first mark
        if (marks.length === 1) {
          // Single mark - just return the created one, copy its parent ref
          // Actually we need to update the passed mark reference - use the first created mark
          // Since we can't reassign the reference, we'll store additional marks as data
          marks[0].dataset.highlightGroup = mark.dataset.noteId;
          mark.dataset.highlightGroup = mark.dataset.noteId;
          // Copy the mark element reference for the highlights map
          Object.assign(mark, { _realMark: marks[0] });
        } else {
          // Multiple marks - link them together
          const groupId = mark.dataset.noteId;
          marks.forEach((m, idx) => {
            m.dataset.highlightGroup = groupId;
            m.dataset.highlightIndex = idx;
          });
          mark.dataset.highlightGroup = groupId;
          mark._multiMarks = marks;
        }

        // For click handling, we return true and the caller uses the original mark
        // But we need to make the highlights map work - store first mark as reference
        mark._realMark = marks[0];

        console.log('[OVERLAY] Successfully wrapped', marks.length, 'text node portions');
        return true;
      } catch (fallbackError) {
        console.error('[OVERLAY] highlight text node wrapping failed', fallbackError);
        return false;
      }
    }
  }

  /**
   * Get all text nodes within a range, with their effective start/end offsets
   */
  function getTextNodesInRange(range) {
    const textNodes = [];
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;
    const startOffset = range.startOffset;
    const endOffset = range.endOffset;

    // If start and end are the same text node
    if (startContainer === endContainer && startContainer.nodeType === Node.TEXT_NODE) {
      textNodes.push({
        node: startContainer,
        startOffset: startOffset,
        endOffset: endOffset
      });
      return textNodes;
    }

    // Walk all text nodes in the range
    const walker = document.createTreeWalker(
      range.commonAncestorContainer,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          // Check if this text node is within or overlaps the range
          const nodeRange = document.createRange();
          nodeRange.selectNodeContents(node);

          // Check if node is before range start or after range end
          if (range.compareBoundaryPoints(Range.END_TO_START, nodeRange) >= 0) {
            return NodeFilter.FILTER_REJECT; // Node is after range
          }
          if (range.compareBoundaryPoints(Range.START_TO_END, nodeRange) <= 0) {
            return NodeFilter.FILTER_REJECT; // Node is before range
          }

          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    let node;
    while ((node = walker.nextNode())) {
      let nodeStart = 0;
      let nodeEnd = node.textContent.length;

      // Adjust start offset if this is the start container
      if (node === startContainer) {
        nodeStart = startOffset;
      }

      // Adjust end offset if this is the end container
      if (node === endContainer) {
        nodeEnd = endOffset;
      }

      textNodes.push({
        node: node,
        startOffset: nodeStart,
        endOffset: nodeEnd
      });
    }

    return textNodes;
  }

  /**
   * Helper: Unwrap a single mark element, returning its text content to the DOM
   */
  function unwrapMark(mark) {
    const parent = mark.parentNode;
    if (!parent) {
      return;
    }

    while (mark.firstChild) {
      parent.insertBefore(mark.firstChild, mark);
    }
    parent.removeChild(mark);

    // Normalize text nodes after unwrapping to merge adjacent text nodes
    parent.normalize();
  }

  /**
   * Clear all highlights
   */
  function clearHighlights() {
    console.log('[OVERLAY] Clearing', highlights.size, 'highlights');

    // First, find and remove all marks by highlight group (handles multi-mark case)
    const groupIds = new Set();
    for (const [noteId, mark] of highlights.entries()) {
      if (mark.dataset && mark.dataset.highlightGroup) {
        groupIds.add(mark.dataset.highlightGroup);
      }

      // Handle multi-mark highlights
      if (mark._multiMarks) {
        for (const m of mark._multiMarks) {
          unwrapMark(m);
        }
      } else if (mark._realMark) {
        unwrapMark(mark._realMark);
      } else if (mark.parentNode) {
        unwrapMark(mark);
      }
    }

    // Also find any orphaned marks by data attribute (safety cleanup)
    for (const groupId of groupIds) {
      const orphanedMarks = document.querySelectorAll(`mark[data-highlight-group="${groupId}"]`);
      orphanedMarks.forEach(m => unwrapMark(m));
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
    if (!mark) {
      return;
    }

    // Handle multi-mark highlights
    if (mark._multiMarks) {
      for (const m of mark._multiMarks) {
        unwrapMark(m);
      }
    } else if (mark._realMark) {
      unwrapMark(mark._realMark);
    } else if (mark.parentNode) {
      unwrapMark(mark);
    }

    // Also clean up any marks by data attribute (handles grouped marks)
    if (mark.dataset && mark.dataset.highlightGroup) {
      const groupMarks = document.querySelectorAll(`mark[data-highlight-group="${mark.dataset.highlightGroup}"]`);
      groupMarks.forEach(m => unwrapMark(m));
    }

    highlights.delete(noteId);
  }

  /**
   * Scroll to a highlight
   */
  function scrollToHighlight(noteId) {
    const mark = highlights.get(noteId);
    if (!mark) {
      return;
    }

    // Get the actual mark element(s) for multi-mark highlights
    let targetMark = mark;
    let allMarks = [mark];

    if (mark._multiMarks && mark._multiMarks.length > 0) {
      targetMark = mark._multiMarks[0];
      allMarks = mark._multiMarks;
    } else if (mark._realMark) {
      targetMark = mark._realMark;
      allMarks = [mark._realMark];
    }

    // Scroll to the first mark
    if (targetMark && targetMark.scrollIntoView) {
      targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Add temporary emphasis to all marks in the highlight
    for (const m of allMarks) {
      if (m.classList) {
        m.classList.add('commentary-highlight-focus');
      }
    }
    setTimeout(() => {
      for (const m of allMarks) {
        if (m.classList) {
          m.classList.remove('commentary-highlight-focus');
        }
      }
    }, 2000);
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
    let mark = highlights.get(note.id);
    if (!mark) {
      console.warn('[OVERLAY] No highlight found for note, attempting to rebuild:', note.id);
      const rebuilt = paintHighlight(note);
      if (rebuilt) {
        mark = highlights.get(note.id);
      }
    }

    if (!mark) {
      console.error('[OVERLAY] Unable to rebuild highlight for note:', note.id);
      console.error('[OVERLAY] Available highlight IDs:', Array.from(highlights.keys()));

      // Reset editing state to prevent stale state corruption
      editingNoteId = null;
      currentSelection = null;
      isDocumentLevelComment = false;

      // Show a user-friendly message
      alert('Could not find this comment in the document. Try refreshing the preview.');
      return;
    }

    // Get the actual DOM element(s) for multi-mark highlights
    let targetMark = mark;
    let allMarks = [mark];

    if (mark._multiMarks && mark._multiMarks.length > 0) {
      targetMark = mark._multiMarks[0];
      allMarks = mark._multiMarks;
    } else if (mark._realMark) {
      targetMark = mark._realMark;
      allMarks = [mark._realMark];
    }

    // Only scroll if requested (e.g., when clicking from sidebar)
    if (shouldScroll && targetMark && targetMark.scrollIntoView) {
      targetMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    // Always add visual emphasis to all marks
    for (const m of allMarks) {
      if (m.classList) {
        m.classList.add('commentary-highlight-focus');
      }
    }
    setTimeout(() => {
      for (const m of allMarks) {
        if (m.classList) {
          m.classList.remove('commentary-highlight-focus');
        }
      }
    }, 2000);

    // Get the range for positioning (use first actual mark)
    const range = document.createRange();
    range.selectNode(targetMark);

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

      case 'removeHighlight': {
        const noteIdToRemove = message.noteId;
        const shouldClose = editingNoteId === noteIdToRemove;
        removeHighlight(noteIdToRemove);
        if (shouldClose) {
          hideBubble();
        }
        break;
      }

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

      case 'updateTheme':
        // Update theme dynamically by replacing the theme stylesheet
        console.log('[OVERLAY] Theme update requested:', message.themeName);
        updateThemeStylesheet(message.themeName, message.vsCodeIsDark);
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
   * Handle clicks on links to open markdown files in Commentary
   */
  function handleLinkClick(event) {
    const target = event.target;

    // Check if click is on a link or inside a link
    const link = target.closest('a[href]');
    if (!link) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href) {
      return;
    }

    // Only intercept relative .md links (not external URLs or anchors)
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('#')) {
      return;
    }

    // Check if it's a markdown file (strip fragments/queries before checking extension)
    const normalizedHref = href.split('#')[0].split('?')[0];
    if (normalizedHref.toLowerCase().endsWith('.md')) {
      event.preventDefault();
      console.log('[OVERLAY] Intercepted markdown link:', href);

      // Send message to extension to open in Commentary
      postMessage({
        type: 'openMarkdownLink',
        href: href,
        documentUri: window.commentaryDocumentUri,
      });
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
