---
name: Bug Report
about: Create a report to help us improve Commentary
title: '[BUG] Pico themes are not loading'
labels: bug
assignees: ''
---

## Description

Pico CSS themes (pico-amber, pico-blue, pico-cyan, pico-green, pico-grey, pico-pink, pico-purple, pico-red) are not loading or displaying correctly in the rendered Markdown webview. When selecting a Pico theme, the preview either shows no styling, default browser styles, or incorrect colors.

## Steps to Reproduce

1. Open any Markdown file (`.md`)
2. Right-click → "Open with Commentary" (or use command palette)
3. Open command palette (`⌘⇧P` / `Ctrl+Shift+P`)
4. Run "Commentary: Select theme..."
5. Select any Pico theme (e.g., "Pico Amber", "Pico Blue")
6. Observe the rendered preview

**Expected:** Preview displays with Pico theme styling (professional appearance with accent colors, proper typography)

**Actual:** Preview shows no styling, default browser styles, or incorrect appearance

## Expected Behavior

Pico themes should:
- Load CSS from `media/themes/pico-*.css` files
- Display with proper Pico CSS styling (typography, spacing, colors)
- Adapt to system dark/light mode preference (Pico themes are classless and use `prefers-color-scheme`)
- Show accent colors (amber, blue, cyan, etc.) appropriately
- Apply consistent styling across all rendered Markdown elements

## Actual Behavior

Pico themes either:
- Don't load at all (no CSS applied)
- Load but don't apply styling correctly
- Show default browser styles instead of Pico styling
- Don't adapt to dark/light mode correctly

## Environment

- **VS Code Version**: [e.g. 1.85.0]
- **Commentary Version**: [e.g. 1.1.1]
- **OS**: [e.g. macOS 14.0, Windows 11, Ubuntu 22.04]
- **Storage Mode**: [workspace/sidecar]
- **Theme**: [Any Pico theme - pico-amber, pico-blue, etc.]
- **Agent Provider**: [N/A - not relevant]

## Configuration

```json
{
  "commentary.theme.name": "pico-amber",
  "commentary.storage.mode": "workspace"
}
```

## Screenshots/Videos

If applicable, add screenshots showing:
- What the preview looks like with a Pico theme selected
- Comparison with a working theme (e.g., water-dark)
- Browser DevTools showing CSS loading status

## Console Output

Open VS Code Developer Tools (`Help > Toggle Developer Tools`) and check the Console tab. Look for:

1. **Theme loading messages:**
```
[MarkdownWebview] Theme loading: { theme: 'pico-amber', ... }
[OVERLAY] updateThemeStylesheet called with: pico-amber
```

2. **CSS loading errors:**
```
Failed to load resource: .../pico-amber.css
```

3. **CSS variable checks:**
```
[Commentary Webview] CSS variables on :root: { --pico-font-family: ..., ... }
```

Paste relevant console output here:

```
[Paste console output here]
```

## Additional Context

**Pico CSS Characteristics:**
- Pico themes use **classless CSS** (no classes needed, applies to semantic HTML)
- Pico themes rely on **`prefers-color-scheme` media queries** for dark/light mode
- Pico themes may require **`data-theme` attribute** on HTML element for explicit theme control
- Pico themes use **CSS custom properties** (`--pico-*` variables)

**Potential Issues:**
1. Webview may not respect `prefers-color-scheme` media queries
2. HTML element may need `data-theme="light"` or `data-theme="dark"` attribute
3. CSS file paths may be incorrect
4. CSP (Content Security Policy) may be blocking CSS
5. Theme CSS may be loading but not applying due to specificity issues
6. Cache-busting query parameters may be interfering

## Implementation Notes (for AI agents)

### Root Cause Analysis

**Investigation steps:**

1. **Check if Pico theme files exist:**
   ```bash
   ls -la media/themes/pico-*.css
   ```
   - Verify all 8 Pico theme files are present
   - Check file sizes (should be > 10KB each)
   - Verify files contain `--pico-` CSS variables

2. **Check CSS loading in webview:**
   - Inspect `<link>` element with `data-theme-name="pico-amber"` (or other Pico theme)
   - Verify `href` attribute points to correct file
   - Check if stylesheet loads (no 404 errors)
   - Verify CSS content is present in DevTools

3. **Check CSS application:**
   - Inspect `<html>` or `<body>` element
   - Check computed styles for Pico CSS variables (`--pico-font-family`, `--pico-background-color`, etc.)
   - Verify `prefers-color-scheme` media queries are evaluated
   - Check if `data-theme` attribute is needed

4. **Compare with working themes:**
   - Test with `water-dark` theme (known working)
   - Compare HTML structure differences
   - Compare CSS loading mechanism
   - Identify what's different about Pico themes

### Affected Components

**Files to investigate:**
- [ ] `src/preview/markdownWebview.ts` - Theme loading and HTML generation
  - Line 358-361: Theme URI generation
  - Line 473: Theme CSS link injection
  - Check if `data-theme` attribute needed on `<html>` element
  
- [ ] `media/overlay.js` - Theme update handling
  - Line 30-76: `updateThemeStylesheet()` function
  - Check if Pico-specific handling needed
  
- [ ] `scripts/copy-themes.js` - Theme file copying
  - Line 86-117: Pico theme source paths
  - Verify source files exist in `node_modules/@picocss/pico/css/`
  - Check if file paths are correct

- [ ] `src/extension.ts` - Theme validation
  - Line 31-79: `validateThemeFiles()` function
  - Check if Pico themes are validated correctly

### Proposed Solution

**Option 1: Add `data-theme` attribute support**

Pico themes may require explicit `data-theme` attribute. Modify HTML generation:

```typescript
// In markdownWebview.ts getHtmlForWebview()
const isPicoTheme = themeName.startsWith('pico-');
const htmlElementAttrs = isPicoTheme 
  ? `data-theme="${isDarkTheme ? 'dark' : 'light'}"`
  : '';

return `<!DOCTYPE html>
<html lang="en" ${htmlElementAttrs}>
```

**Option 2: Ensure `prefers-color-scheme` works in webview**

Webviews may not respect system color scheme. Detect VS Code theme and apply:

```typescript
const colorTheme = vscode.window.activeColorTheme;
const isDark = colorTheme.kind === vscode.ColorThemeKind.Dark;
// Apply data-theme or inject CSS override
```

**Option 3: Fix CSS loading path**

Verify Pico CSS files are being loaded from correct path. Check:
- File exists at `media/themes/pico-*.css`
- URI generation is correct
- CSP allows CSS loading

**Option 4: Add Pico-specific CSS overrides**

If Pico CSS loads but doesn't apply, may need base styles:

```css
/* Ensure Pico variables are applied */
:root {
  color-scheme: light dark; /* Let Pico handle it */
}
```

### Testing Strategy

**Unit tests:**
- [ ] Test theme URI generation for Pico themes
- [ ] Test HTML generation includes `data-theme` if needed
- [ ] Test theme file existence validation

**Integration tests:**
- [ ] Test Pico theme loads in webview
- [ ] Test Pico theme applies styling correctly
- [ ] Test Pico theme adapts to dark/light mode
- [ ] Test all 8 Pico theme variants

**Manual tests:**
- [ ] Select each Pico theme variant
- [ ] Verify styling applies correctly
- [ ] Test in light VS Code theme
- [ ] Test in dark VS Code theme
- [ ] Check browser DevTools for CSS loading
- [ ] Verify CSS variables are set
- [ ] Compare with working theme (water-dark)

### Related Code Patterns

**Theme loading pattern:**
- Reference: `src/preview/markdownWebview.ts` lines 355-361
- Similar to: How other themes are loaded (water-dark, sakura-light)

**Theme update pattern:**
- Reference: `media/overlay.js` lines 30-76
- Similar to: How theme changes are handled dynamically

**Theme validation pattern:**
- Reference: `src/extension.ts` lines 31-79
- Similar to: How theme files are checked on activation

**Pico-specific considerations:**
- Pico uses classless CSS (no classes needed)
- Pico relies on semantic HTML structure
- Pico uses CSS custom properties extensively
- Pico themes adapt via `prefers-color-scheme` or `data-theme`

### Debugging Steps

1. **Verify theme files exist:**
   ```bash
   npm run compile
   ls -la media/themes/pico-*.css
   ```

2. **Check theme file content:**
   ```bash
   head -50 media/themes/pico-amber.css
   # Should see --pico- CSS variables
   ```

3. **Test in Extension Development Host:**
   - Press F5
   - Open Markdown file
   - Select Pico theme
   - Open DevTools (Help > Toggle Developer Tools)
   - Check Console for errors
   - Check Elements tab for CSS loading

4. **Compare with working theme:**
   - Select `water-dark` theme
   - Note what works
   - Select `pico-amber` theme
   - Compare differences

5. **Check CSS variables:**
   ```javascript
   // In browser console:
   getComputedStyle(document.documentElement).getPropertyValue('--pico-font-family')
   // Should return a font family, not empty
   ```

## Checklist
- [x] I've searched existing issues to avoid duplicates
- [x] I've included all relevant environment details
- [x] I've checked the console for errors
- [x] I've tested with the latest version of Commentary
- [x] I've provided implementation guidance for AI agents
