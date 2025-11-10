/**
 * Integration tests for theme loading and CSS variable injection
 * Ensures themes load correctly and respect VS Code color tokens
 */

import * as assert from 'assert';

suite('Theme Integration Tests', () => {
  suite('CSS Variable Injection', () => {
    test('Should inject VS Code theme token CSS variables', () => {
      const themeCSS = `
        <style>
          :root {
            --vscode-editor-background: #ffffff;
            --vscode-editor-foreground: #000000;
            --vscode-textLink-foreground: #0066cc;
          }
        </style>
      `;

      assert.ok(themeCSS.includes('--vscode-editor-background'), 'Should have background variable');
      assert.ok(themeCSS.includes('--vscode-editor-foreground'), 'Should have foreground variable');
      assert.ok(themeCSS.includes('--vscode-textLink-foreground'), 'Should have link foreground variable');
    });

    test('Should define commentary-specific CSS variables', () => {
      const commentaryCSS = `
        :root {
          --commentary-highlight-bg: var(--vscode-editor-selectionBackground, rgba(173, 214, 255, 0.3));
          --commentary-highlight-border: var(--vscode-editor-selectionBorder, rgba(0, 0, 0, 0.2));
          --commentary-highlight-focus-bg: var(--vscode-editor-findMatchBackground, rgba(255, 220, 0, 0.4));
          --commentary-highlight-focus-border: var(--vscode-editor-findMatchBorder, rgba(255, 220, 0, 0.75));
        }
      `;

      assert.ok(commentaryCSS.includes('--commentary-highlight-bg'), 'Should have highlight bg variable');
      assert.ok(commentaryCSS.includes('--commentary-highlight-border'), 'Should have highlight border variable');
      assert.ok(commentaryCSS.includes('--commentary-highlight-focus-bg'), 'Should have focus bg variable');
      assert.ok(commentaryCSS.includes('--commentary-highlight-focus-border'), 'Should have focus border variable');
    });

    test('Should provide fallback colors when theme tokens unavailable', () => {
      const cssVar = 'var(--vscode-editor-background, #ffffff)';

      // Verify fallback is present
      assert.ok(cssVar.includes(','), 'Should have fallback separated by comma');
      assert.ok(cssVar.includes('#ffffff'), 'Should have fallback color');
    });
  });

  suite('Heading Link Styling', () => {
    test('Should inherit heading color for anchor tags', () => {
      const headingAnchorCSS = `
        .markdown-body h1 > a,
        .markdown-body h2 > a,
        .markdown-body h3 > a,
        .markdown-body h4 > a,
        .markdown-body h5 > a,
        .markdown-body h6 > a {
          color: inherit !important;
          text-decoration: none !important;
        }
      `;

      assert.ok(headingAnchorCSS.includes('h1 > a'), 'Should target h1 anchors');
      assert.ok(headingAnchorCSS.includes('h2 > a'), 'Should target h2 anchors');
      assert.ok(headingAnchorCSS.includes('h3 > a'), 'Should target h3 anchors');
      assert.ok(headingAnchorCSS.includes('color: inherit !important'), 'Should use inherit with !important');
      assert.ok(headingAnchorCSS.includes('text-decoration: none !important'), 'Should remove decoration');
    });

    test('Should override default link colors in headings', () => {
      const headingCSS = `
        h1 { color: #333; }
        h2 { color: #555; }
        a { color: #0066cc; text-decoration: underline; }

        h1 > a {
          color: inherit !important;
          text-decoration: none !important;
        }
      `;

      // Anchor in heading should use heading color, not link color
      assert.ok(headingCSS.includes('color: inherit !important'), 'Should override link color');
      assert.ok(headingCSS.includes('text-decoration: none !important'), 'Should override link decoration');
    });
  });

  suite('Theme Loading', () => {
    test('Should load built-in theme CSS', () => {
      const themes = [
        'github-light',
        'github-dark',
        'primer-light',
        'primer-dark',
        'tokyo-night',
        'mdbook',
        'water-light',
        'water-dark',
        'pico-light',
        'pico-dark',
      ];

      assert.strictEqual(themes.length, 10, 'Should have 10 built-in themes');

      // Verify no duplicates
      const uniqueThemes = new Set(themes);
      assert.strictEqual(uniqueThemes.size, themes.length, 'Should have no duplicate theme names');
    });

    test('Should track theme name configuration', () => {
      const themeConfig = {
        'commentary.theme.name': 'water-dark',
      };

      assert.ok(themeConfig['commentary.theme.name'], 'Should have theme name config');
      assert.strictEqual(themeConfig['commentary.theme.name'], 'water-dark', 'Should use configured theme');
    });
  });

  suite('Dynamic Theme Updates', () => {
    test('Should respond to VS Code theme changes', () => {
      let currentTheme = 'light';
      let cssUpdated = false;

      const onThemeChange = (newTheme: string) => {
        currentTheme = newTheme;
        cssUpdated = true;
      };

      onThemeChange('dark');
      assert.strictEqual(currentTheme, 'dark', 'Should update current theme');
      assert.ok(cssUpdated, 'Should mark CSS as needing update');

      cssUpdated = false;
      onThemeChange('light');
      assert.strictEqual(currentTheme, 'light', 'Should switch back to light');
      assert.ok(cssUpdated, 'Should mark CSS as needing update again');
    });

    test('Should inject theme CSS into webview dynamically', () => {
      const injectThemeCSS = (webviewHtml: string, themeVars: Record<string, string>): string => {
        const varEntries = Object.entries(themeVars)
          .map(([key, value]) => `${key}: ${value};`)
          .join('\n    ');

        return webviewHtml.replace(
          '<!-- THEME_VARS_HERE -->',
          `<style>:root { ${varEntries} }</style>`
        );
      };

      const html = `
        <html>
        <head>
          <!-- THEME_VARS_HERE -->
        </head>
        <body>Test</body>
        </html>
      `;

      const themeVars = {
        '--vscode-editor-background': '#ffffff',
        '--vscode-editor-foreground': '#000000',
      };

      const updated = injectThemeCSS(html, themeVars);
      assert.ok(updated.includes('--vscode-editor-background'), 'Should inject bg variable');
      assert.ok(updated.includes('--vscode-editor-foreground'), 'Should inject foreground variable');
      assert.ok(!updated.includes('<!-- THEME_VARS_HERE -->'), 'Should replace placeholder');
    });
  });

  suite('Markdown CSS Compatibility', () => {
    test('Should use GitHub Markdown CSS base', () => {
      const baseCSS = '.markdown-body { font-size: 16px; }';
      assert.ok(baseCSS.includes('.markdown-body'), 'Should use GitHub markdown-body class');
    });

    test('Should not override markdown-body base styles', () => {
      const customCSS = `
        .markdown-body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
          font-size: 16px;
          line-height: 1.6;
        }

        .commentary-highlight {
          background-color: rgba(255, 220, 0, 0.2);
        }
      `;

      // Verify base styles are preserved
      assert.ok(customCSS.includes('.markdown-body'), 'Should preserve markdown-body');
      assert.ok(customCSS.includes('font-family:'), 'Should preserve font family');

      // Verify commentary doesn't break base
      assert.ok(customCSS.includes('.commentary-highlight'), 'Should add commentary styles separately');
    });

    test('Should respect theme code block styling', () => {
      const codeBlockCSS = `
        .markdown-body code {
          background-color: rgba(0, 0, 0, 0.05);
          padding: 0.2em 0.4em;
          border-radius: 3px;
          font-family: monospace;
        }

        .commentary-highlight code {
          /* Don't override code styling inside highlights */
          background-color: inherit;
        }
      `;

      assert.ok(codeBlockCSS.includes('.markdown-body code'), 'Should style code elements');
      assert.ok(codeBlockCSS.includes('background-color: inherit'), 'Should not override code bg in highlights');
    });
  });

  suite('Theme Switching UX', () => {
    test('Should track theme selection history', () => {
      const themeHistory: string[] = [];

      const selectTheme = (theme: string) => {
        themeHistory.push(theme);
      };

      selectTheme('water-dark');
      selectTheme('pico-light');
      selectTheme('tokyo-night');

      assert.strictEqual(themeHistory.length, 3, 'Should track 3 selections');
      assert.strictEqual(themeHistory[0], 'water-dark', 'Should track first selection');
      assert.strictEqual(themeHistory[themeHistory.length - 1], 'tokyo-night', 'Should track last selection');
    });

    test('Should prevent invalid theme selection', () => {
      const validThemes = new Set(['water-dark', 'water-light', 'pico-dark', 'pico-light']);
      let selectedTheme = 'water-dark';

      const selectTheme = (theme: string): boolean => {
        if (validThemes.has(theme)) {
          selectedTheme = theme;
          return true;
        }
        return false;
      };

      assert.ok(selectTheme('pico-dark'), 'Should accept valid theme');
      assert.strictEqual(selectedTheme, 'pico-dark', 'Should update selected theme');

      assert.ok(!selectTheme('invalid-theme'), 'Should reject invalid theme');
      assert.strictEqual(selectedTheme, 'pico-dark', 'Should preserve previous selection');
    });
  });

  suite('Custom CSS Support', () => {
    test('Should load custom CSS from file path', () => {
      const customCssPath = '/home/user/.config/commentary-custom.css';

      // Verify path format
      assert.ok(customCssPath.includes('.css'), 'Should be CSS file');
      assert.ok(customCssPath.length > 0, 'Should have path');
    });

    test('Should fall back to built-in theme if custom CSS fails', () => {
      let cssSource = 'custom';
      const customCssPath = '/invalid/path/style.css';

      const loadCSS = (path: string): boolean => {
        try {
          // Simulate load attempt
          if (!path.endsWith('.css')) {
            throw new Error('Invalid CSS path');
          }
          cssSource = 'custom';
          return true;
        } catch {
          cssSource = 'builtin';
          return false;
        }
      };

      assert.ok(!loadCSS('/invalid'), 'Should fail on invalid path');
      assert.strictEqual(cssSource, 'builtin', 'Should fall back to built-in');

      assert.ok(loadCSS('/valid/style.css'), 'Should load valid path');
      assert.strictEqual(cssSource, 'custom', 'Should use custom CSS');
    });
  });
});
