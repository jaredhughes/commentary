# Theme & Codicon Debugging - Summary

## Changes Made

### 1. Added Comprehensive Logging

**Server-side (Extension Host):**
- Logs theme name, config, and URIs in `markdownWebview.ts`
- Shows which theme is being loaded and its file path
- Logs syntax highlighting theme selection

**Client-side (Webview):**
- Logs theme file load status on DOM ready
- Counts CSS rules loaded from each stylesheet
- Checks Pico CSS variables on `:root`
- Logs computed styles (background, color, font)

### 2. Fixed Codicons

- **Installed**: `@vscode/codicons@^0.0.41` (was missing)
- **CSP Updated**: Added `data:` to `font-src` to allow embedded fonts
- **Added Diagnostic**: Tracks if codicon.css loads successfully
- **Usage**: Delete button now shows trash icon via `<i class="codicon codicon-trash"></i>`

### 3. Pico Theme Investigation

**Key Finding**: Pico CSS themes ALWAYS include `@media (prefers-color-scheme: dark)`:
- Both `pico.classless.amber.css` AND `pico.classless.conditional.amber.css` have this
- The difference is CSS selector scoping (`.pico` class), not dark mode behavior
- This is INTENTIONAL - Pico themes adapt to system dark/light mode

**Verified**:
- All 8 Pico variants copied correctly
- Each is ~78KB with 2458 lines
- All contain CSS variables: `--pico-font-family`, `--pico-background-color`, etc.

### 4. Created Debug Tools

**`scripts/verify-themes.js`**:
- Checks all 20 expected theme files exist
- Validates file size and CSS rules
- Specifically checks Pico themes for:
  - Media queries
  - `[data-theme]` attributes
  - `prefers-color-scheme` usage

**`THEME_DEBUGGING.md`**:
- Step-by-step debugging guide
- What to look for in console logs
- Common issues and solutions
- Manual testing checklist

## How to Test

1. **Compile and Run**:
   ```bash
   npm run compile
   # Press F5 to launch Extension Development Host
   ```

2. **Open a Markdown file** with Commentary

3. **Open Webview DevTools**:
   - Right-click in the preview
   - Select "Open Webview Developer Tools"
   - Check Console tab

4. **Look for these logs**:
   ```
   [Commentary Webview] Theme loading: { theme: 'pico-amber', ... }
   [Commentary Webview] DOM loaded, checking stylesheets: { 
     themeLink: { loaded: true, rules: 2000+ },
     codiconLink: { loaded: true, rules: 500+ },
     ...
   }
   ```

5. **Verify visually**:
   - Theme colors apply correctly
   - Trash icon shows in delete button (not a square)
   - Pico themes change when you switch OS dark/light mode

6. **Test theme switching**:
   - Run command: `Commentary: Select theme...`
   - Choose different theme
   - Check console logs again
   - Verify visual change

## Expected Behavior

### Pico Themes
- **Dark/Light switching is NORMAL** - they respond to `prefers-color-scheme`
- To test: Change macOS to Dark Mode → Pico theme should darken
- Each color variant (amber, blue, cyan, etc.) changes the accent color, not dark/light

### Codicons
- Trash icon should appear as actual icon, not square
- If square appears → font didn't load (check CSP errors)

### Other Themes
- Water, Sakura, Simple, etc. should look consistent
- May or may not respond to system theme (depends on theme CSS)

## Files Modified

1. `src/preview/markdownWebview.ts` - Added logging, fixed CSP
2. `scripts/verify-themes.js` - New verification script
3. `package.json` - Already had all dependencies
4. `THEME_DEBUGGING.md` - New debugging guide

## Pass Console Output Back

When testing, copy and paste these console outputs:

1. **From VS Code Debug Console**:
   - Search for `[MarkdownWebview]`

2. **From Webview DevTools Console**:
   - All `[Commentary Webview]` messages

This will help diagnose any remaining issues!
