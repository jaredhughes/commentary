---
name: Feature Request
about: Suggest an idea for Commentary
title: '[FEATURE] Add CMD+F / Ctrl+F text search to rendered Markdown webview'
labels: enhancement
assignees: ''
---

## Problem Statement

Users cannot search for text within the rendered Markdown preview webview. When reviewing documentation in the Commentary preview, users need to manually scroll through long documents to find specific content. This is inefficient and breaks the workflow, especially for longer documentation files.

**Current behavior:** CMD+F / Ctrl+F does nothing in the webview, or opens VS Code's search (which searches the source Markdown, not the rendered preview).

**Desired behavior:** CMD+F / Ctrl+F should open a search interface within the webview that searches the rendered HTML content, highlights matches, and allows navigation between results.

## Proposed Solution

Add a native browser-style find/search functionality to the rendered Markdown webview:

1. **Keyboard shortcut handling:** Intercept CMD+F (Mac) / Ctrl+F (Windows/Linux) in the webview
2. **Search UI:** Display a search bar at the top of the webview (similar to browser find bars)
3. **Text highlighting:** Highlight all matching text in the rendered content
4. **Navigation:** Provide "Next" and "Previous" buttons to navigate between matches
5. **Match counter:** Show "X of Y matches" indicator
6. **Case sensitivity:** Optional case-sensitive toggle (default: case-insensitive)
7. **Visual styling:** Style the search bar to match the current theme

## Alternatives Considered

1. **VS Code native search** - Doesn't work because it searches source Markdown, not rendered HTML
2. **External search tool** - Breaks workflow, requires leaving the preview
3. **Sidebar search** - Less discoverable, doesn't highlight in context

## Use Cases

1. **Documentation review:** User opens a long README.md in Commentary preview, wants to find all mentions of "API" quickly
2. **Content verification:** User wants to verify a specific term appears in the rendered output
3. **Navigation:** User remembers seeing a section but needs to find it quickly in a long document
4. **Cross-reference checking:** User wants to find all instances of a term to ensure consistency

## Mockups/Examples

Similar to browser find functionality:
- Search bar appears at top of webview when CMD+F / Ctrl+F is pressed
- Search input field with "Next" and "Previous" buttons
- Match counter (e.g., "1 of 5")
- Close button (X or Escape)
- Highlighted matches in the content (yellow background or similar)
- Current match highlighted differently (e.g., blue border)

## Impact

- **User Impact**: High - Essential feature for reviewing longer documents
- **Complexity**: Medium - Requires keyboard handling, UI creation, text search, and highlighting
- **Breaking Changes**: No - Purely additive feature

## Implementation Plan (for AI agents)

### Acceptance Criteria

- [ ] CMD+F (Mac) / Ctrl+F (Windows/Linux) opens search bar in webview
- [ ] Search bar appears at top of webview with input field
- [ ] Typing in search field highlights all matches in rendered content
- [ ] "Next" and "Previous" buttons navigate between matches
- [ ] Match counter shows "X of Y" format
- [ ] Current match is visually distinct from other matches
- [ ] Escape key closes search bar
- [ ] Search works with rendered HTML content (not source Markdown)
- [ ] Search is case-insensitive by default
- [ ] Search bar styling matches current theme
- [ ] Search works across all themes
- [ ] Search highlights don't interfere with comment highlights
- [ ] Search persists when scrolling
- [ ] Search clears when search bar is closed

### Architecture Changes

**Files to create:**
- [ ] `media/search.js` - Client-side search functionality (vanilla JavaScript)
  - Search bar UI creation
- [ ] `media/search.css` - Search bar styling
  - Styles for search bar, input, buttons, match counter
  - Theme-aware styling

**Files to modify:**
- [ ] `src/preview/markdownWebview.ts` - Add search script and CSS to HTML template
  - Include `search.js` and `search.css` in webview HTML
  - Similar to how `overlay.js` is included
- [ ] `media/overlay.js` - Add keyboard event listener for CMD+F / Ctrl+F
  - Intercept keyboard shortcut
  - Initialize search functionality
  - Coordinate with existing overlay functionality

### Implementation Steps

#### Step 1: Create search.js (client-side search functionality)

**File:** `media/search.js`

**Pattern to follow:** `media/overlay.js` structure (vanilla JS, IIFE pattern)

**Key functionality:**
```javascript
(function() {
  'use strict';
  
  let searchBar = null;
  let searchInput = null;
  let currentMatchIndex = -1;
  let matches = [];
  let searchTerm = '';
  
  function initSearch() {
    // Create search bar UI
    // Add event listeners
    // Handle keyboard shortcuts
  }
  
  function showSearchBar() {
    // Display search bar at top of webview
  }
  
  function hideSearchBar() {
    // Hide search bar and clear highlights
  }
  
  function performSearch(term) {
    // Search rendered HTML content
    // Highlight matches
    // Update match counter
  }
  
  function navigateToMatch(direction) {
    // Navigate to next/previous match
    // Scroll match into view
  }
  
  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSearch);
  } else {
    initSearch();
  }
})();
```

**Reference:** Look at `media/overlay.js` lines 123-146 for initialization pattern

#### Step 2: Create search.css (search bar styling)

**File:** `media/search.css`

**Key styles needed:**
- Fixed position search bar at top
- Input field styling
- Button styling (Next, Previous, Close)
- Match counter styling
- Highlight styles for matches
- Theme-aware colors

**Pattern to follow:** `media/overlay.css` structure

#### Step 3: Add keyboard shortcut handler in overlay.js

**File:** `media/overlay.js`

**Location:** Add to `init()` function or create separate handler

**Code pattern:**
```javascript
// In init() function, add:
document.addEventListener('keydown', (e) => {
  // Check for CMD+F (Mac) or Ctrl+F (Windows/Linux)
  if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
    e.preventDefault(); // Prevent browser default
    // Trigger search bar display
    if (window.commentarySearch) {
      window.commentarySearch.show();
    }
  }
});
```

**Reference:** See `media/overlay.js` lines 536-557 for keyboard handling pattern

#### Step 4: Integrate search into webview HTML

**File:** `src/preview/markdownWebview.ts`

**Location:** `getHtmlForWebview()` method

**Changes needed:**
1. Add search.css link (similar to overlay.css line 479)
2. Add search.js script (similar to overlay.js line 568)
3. Ensure search.js has access to rendered content

**Pattern to follow:** Lines 322-327, 479, 568 in `markdownWebview.ts`

#### Step 5: Handle search state and coordination

**Considerations:**
- Search highlights should not interfere with comment highlights
- Search should work when comment bubble is open
- Escape key should close search (not comment bubble if both open)
- Search should clear when webview content updates

**Coordination pattern:**
- Check if comment bubble is open before showing search
- Or allow both to coexist (search bar at top, bubble floating)
- Escape key priority: search bar > comment bubble

#### Step 6: Test with different themes

**Test cases:**
- Search bar visible in light themes
- Search bar visible in dark themes
- Match highlights visible in all themes
- Search bar doesn't break theme styling

### Similar Implementations

**Reference files:**
- `media/overlay.js` - Client-side JavaScript patterns, event handling
- `media/overlay.css` - CSS styling patterns
- `src/preview/markdownWebview.ts` - Webview HTML generation, script inclusion

**Pattern to follow:**
- Use same IIFE pattern as overlay.js
- Use same event listener patterns
- Use same CSS organization as overlay.css
- Follow same script inclusion pattern in markdownWebview.ts

### Testing Requirements

**Unit tests:**
- [ ] Search function finds matches correctly
- [ ] Case-insensitive search works
- [ ] Match navigation works (next/previous)
- [ ] Match counter updates correctly
- [ ] Search clears highlights on close

**Integration tests:**
- [ ] Search works with rendered Markdown content
- [ ] Search works with code blocks
- [ ] Search works with headings
- [ ] Search doesn't break comment functionality
- [ ] Keyboard shortcuts work (CMD+F / Ctrl+F, Escape)

**Manual tests:**
- [ ] Test in Extension Development Host (F5)
- [ ] Test with different themes
- [ ] Test with long documents (1000+ lines)
- [ ] Test with special characters in search term
- [ ] Test on Mac (CMD+F)
- [ ] Test on Windows/Linux (Ctrl+F)
- [ ] Test search persistence during scroll
- [ ] Test search with comment bubble open

**Edge cases:**
- [ ] Empty search term
- [ ] No matches found
- [ ] Single match
- [ ] Search term with regex special characters
- [ ] Search in code blocks
- [ ] Search across multiple rendered elements

### Configuration Changes (if needed)

**No new configuration settings needed** - Search should work out of the box with sensible defaults (case-insensitive).

**Future enhancement consideration:**
- Could add `commentary.search.caseSensitive` setting (default: false)
- Could add `commentary.search.highlightColor` setting for customization

### Dependencies

**No new npm packages needed** - Use native browser APIs:
- `window.getSelection()` - For text selection (already used in overlay.js)
- `document.querySelectorAll()` - For finding elements
- `Element.scrollIntoView()` - For scrolling to matches
- `String.prototype.includes()` / `String.prototype.indexOf()` - For text matching

**VS Code API:**
- No new VS Code API calls needed - this is purely client-side webview functionality

### Implementation Notes

**Key considerations:**
1. **Search in rendered HTML:** Must search the rendered HTML content, not the source Markdown. The rendered content is in `#markdown-content` div.

2. **Highlighting approach:**
   - Option A: Wrap matches in `<mark>` tags with CSS styling
   - Option B: Use `::before` / `::after` pseudo-elements
   - Option C: Add classes to parent elements
   - **Recommended:** Option A (wrap in `<mark>`) - simplest and most compatible

3. **Match navigation:**
   - Store array of match elements
   - Track current match index
   - Scroll current match into view with `scrollIntoView({ behavior: 'smooth', block: 'center' })`

4. **Performance:**
   - Debounce search input (300ms) for long documents
   - Limit search to visible content initially (lazy search)
   - Or search all content but limit highlight rendering

5. **Accessibility:**
   - Add ARIA labels to search bar
   - Ensure keyboard navigation works
   - Announce match count to screen readers

6. **Theme integration:**
   - Use CSS variables from themes for colors
   - Or detect theme and apply appropriate styles
   - Reference: `media/overlay.css` for theme-aware styling patterns

**Error handling:**
- Handle cases where search.js fails to load
- Handle cases where content changes during search
- Clear search state when webview content updates

## Additional Context

This feature is essential for usability, especially for longer documentation files. Users expect CMD+F / Ctrl+F to work in any rendered content view, and its absence is a significant UX gap.

**Related issues:** None currently

**Related features:**
- Comment highlighting (must not interfere)
- Theme switching (search bar must adapt)
- Document navigation (search should work across all content)

## Checklist
- [x] I've searched existing issues to avoid duplicates
- [x] I've considered the impact on existing functionality
- [x] I've thought about backwards compatibility
- [x] I've provided implementation guidance for AI agents
