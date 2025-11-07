# UX Improvements Plan

## Phase 1: Marketplace Readiness (CRITICAL)

### 1.1 Extension Icon
- [ ] Create 128x128px icon for marketplace
- [ ] Add `icon` field to package.json root
- [ ] Test icon display in Extension Host

**Design:** Simple, recognizable icon representing "commenting on documents"
- Option A: Speech bubble with document corner-fold
- Option B: Document with comment thread
- Option C: Highlight marker over text

### 1.2 Screenshots
- [ ] Screenshot 1: Main commenting workflow (select text → add comment)
- [ ] Screenshot 2: Sidebar with multiple comments
- [ ] Screenshot 3: Theme switching demonstration
- [ ] Screenshot 4: Agent integration (send to Claude/Cursor)
- [ ] Add to README and marketplace listing

### 1.3 Demo Video/GIF
- [ ] Create 30-second demo showing:
  - Opening markdown preview
  - Selecting text and adding comment
  - Viewing comments in sidebar
  - Sending to AI agent
- [ ] Host on GitHub/CDN
- [ ] Add to README header

## Phase 2: Visual Polish

### 2.1 Document Button Redesign
**Current:** Blue theme hardcoded
**Proposed:** Use VS Code theme colors
- [ ] Replace hardcoded colors with CSS variables
- [ ] Use `--vscode-button-background` and related vars
- [ ] Test in light/dark themes

### 2.2 Empty State Messaging
- [ ] Add empty state component to sidebar
- [ ] Show helpful getting-started message
- [ ] Include icon and clear call-to-action

### 2.3 Loading States
- [ ] Add spinner/progress for agent operations
- [ ] Show toast notifications for success/error
- [ ] Add timeout handling (30s) with user feedback

## Phase 3: Command Consistency

### 3.1 Standardize Command Names
**Pattern:** `[Action] [Object] [Context]`

Current issues:
- "Send to agent" vs "Copy for agent" confusion
- "Send all to agent" vs "Send all to Agent" (capitalization)

**Proposed:**
- Cursor (clipboard): "Copy Comment for Cursor" / "Copy All for Cursor"
- Claude (CLI): "Send Comment to Claude" / "Send All to Claude"
- Generic: "Send Comment to Agent" / "Send All to Agent"

### 3.2 Command Palette Organization
- [ ] Add consistent category prefixes
- [ ] Group related commands
- [ ] Add keyboard shortcuts to frequently used commands

## Phase 4: Advanced UX

### 4.1 Keyboard Shortcuts
- [ ] `Cmd+Shift+C`: Toggle Commentary sidebar
- [ ] `Cmd+K Cmd+C`: Add document-level comment
- [ ] `Cmd+/` in sidebar: Focus comment filter/search (future)

### 4.2 Theme Preview
- [ ] Show current theme name in preview title bar
- [ ] Add theme switcher dropdown in preview toolbar

### 4.3 Comment Validation
- [ ] Show inline error message for empty comments
- [ ] Character count (optional)
- [ ] Real-time validation feedback

### 4.4 Agent Configuration Quick-Pick
- [ ] Add "Quick Configure Agent" command
- [ ] Show common presets (Cursor, Claude, OpenAI)
- [ ] One-click provider switching

## Implementation Order

1. **Week 1:** Phase 1 (Marketplace Readiness)
   - Icon creation
   - Screenshots
   - Demo GIF

2. **Week 2:** Phase 2 (Visual Polish)
   - Document button redesign
   - Empty states
   - Loading indicators

3. **Week 3:** Phase 3 (Command Consistency)
   - Standardize naming
   - Keyboard shortcuts

4. **Week 4:** Phase 4 (Advanced UX)
   - Theme preview
   - Agent quick-config
   - Validation improvements

## Success Metrics

- [ ] All marketplace requirements met
- [ ] Zero visual bugs in light/dark themes
- [ ] Commands are intuitive (no user confusion)
- [ ] Operations provide clear feedback
- [ ] Extension feels "native" to VS Code

## Notes

- Follow VS Code design guidelines: https://code.visualstudio.com/api/ux-guidelines/overview
- Use VS Code theme colors: https://code.visualstudio.com/api/references/theme-color
- Test on Windows, Mac, Linux
- Test with popular VS Code themes (Dracula, One Dark, etc.)
