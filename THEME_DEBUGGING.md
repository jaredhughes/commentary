# Theme Debugging Guide

## How to Debug Themes

When testing themes, open the webview Developer Tools and check the console for these diagnostic messages:

### 1. Server-side logging (VS Code Extension Host)

Look for these in the VS Code **Debug Console** or **Output** panel:

```
[MarkdownWebview] Theme loading: { themeName: 'pico-amber', ... }
[MarkdownWebview] Theme URI: vscode-webview://...
[MarkdownWebview] Syntax highlighting: { isDarkTheme: false, ... }
```

### 2. Client-side logging (Webview Console)

Right-click in the webview and select "Open Webview Developer Tools", then check Console:

```
[Commentary Webview] Theme loading: { theme: 'pico-amber', ... }
[Commentary Webview] DOM loaded, checking stylesheets: { ... }
[Commentary Webview] CSS variables on :root: { ... }
[Commentary Webview] Computed body styles: { ... }
```

## What to Look For

### Theme Files Loaded
- `themeLink.loaded` should be `true`
- `themeLink.rules` should be > 0 (number of CSS rules)
- `codiconLink.loaded` should be `true`

### CSS Variables (for Pico themes)
- `--pico-font-family` should have a value
- `--pico-background-color` should have a color
- `--pico-color` should have a color

### Computed Styles
- `backgroundColor` should match theme colors
- `color` (text color) should be readable
- `fontFamily` should be set

## Common Issues

### Pico Themes Dark/Light Switching
Pico CSS includes `@media (prefers-color-scheme: dark)` which auto-switches based on system preferences. This is EXPECTED behavior for Pico themes - they're responsive to your OS theme.

### Codicons Not Showing
If the trash icon shows as a square or doesn't appear:
1. Check `codiconLink.loaded` is `true`
2. Check browser console for CSP errors
3. Verify `font-src` in CSP includes `data:`

### Theme Colors Not Applying
1. Check if stylesheet loaded (`.sheet !== null`)
2. Check CSS rule count (should be > 100 for most themes)
3. Look for CSP errors in console
4. Check theme file exists in `media/themes/`

## Verifying Theme Files

Run from project root:

```bash
node scripts/verify-themes.js
```

This will check:
- All theme files exist
- Files have reasonable size
- Files contain CSS rules
- Pico themes are properly configured

## Manual Testing Steps

1. Open a markdown file with Commentary
2. Change theme via `Commentary: Select theme...` command
3. Open webview DevTools
4. Check console for diagnostic output
5. Verify visual appearance matches theme
6. Test switching between light/dark system themes (for Pico)
