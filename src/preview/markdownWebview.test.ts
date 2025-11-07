/**
 * Tests for MarkdownWebviewProvider theme system
 */

import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('Theme System Tests', () => {
  const themesDir = path.join(__dirname, '../../media/themes');
  const highlightDir = path.join(__dirname, '../../media');

  suite('Theme File Integrity', () => {
    test('All configured themes should exist', () => {
      const expectedThemes = [
        'water-light.css',
        'water-dark.css',
        'sakura-light.css',
        'sakura-dark.css',
        'sakura-vader.css',
        'sakura-pink.css',
        'sakura-earthly.css',
        'pico-amber.css',
        'pico-blue.css',
        'pico-cyan.css',
        'pico-green.css',
        'pico-grey.css',
        'pico-pink.css',
        'pico-purple.css',
        'pico-red.css',
        'simple.css',
        'matcha.css',
        'latex.css',
        'tufte.css',
        'new.css',
      ];

      for (const theme of expectedThemes) {
        const themePath = path.join(themesDir, theme);
        assert.ok(
          fs.existsSync(themePath),
          `Theme file missing: ${theme}`
        );
      }
    });

    test('Syntax highlighting CSS files should exist', () => {
      const highlightFiles = ['highlight-light.css', 'highlight-dark.css'];

      for (const file of highlightFiles) {
        const filePath = path.join(highlightDir, file);
        assert.ok(
          fs.existsSync(filePath),
          `Highlight file missing: ${file}`
        );
      }
    });

    test('Theme files should not be empty', () => {
      const files = fs.readdirSync(themesDir);
      const cssFiles = files.filter((f) => f.endsWith('.css'));

      for (const file of cssFiles) {
        const filePath = path.join(themesDir, file);
        const stats = fs.statSync(filePath);
        assert.ok(stats.size > 0, `Theme file is empty: ${file}`);
        assert.ok(stats.size > 100, `Theme file too small: ${file} (${stats.size} bytes)`);
      }
    });

    test('Theme files should contain valid CSS', () => {
      const files = fs.readdirSync(themesDir);
      const cssFiles = files.filter((f) => f.endsWith('.css'));

      for (const file of cssFiles) {
        const filePath = path.join(themesDir, file);
        const content = fs.readFileSync(filePath, 'utf8');

        // Basic CSS validation
        assert.ok(content.includes('{'), `Theme file missing opening brace: ${file}`);
        assert.ok(content.includes('}'), `Theme file missing closing brace: ${file}`);
        assert.ok(content.includes(':'), `Theme file missing CSS properties: ${file}`);
      }
    });
  });

  suite('Theme Configuration', () => {
    test('Default theme should be valid', () => {
      const config = vscode.workspace.getConfiguration('commentary');
      const defaultTheme = config.inspect<string>('theme.name')?.defaultValue;

      assert.strictEqual(defaultTheme, 'simple', 'Default theme should be simple');

      // Verify the theme file exists
      const themeFile = path.join(themesDir, `${defaultTheme}.css`);
      assert.ok(fs.existsSync(themeFile), 'Default theme CSS file should exist');
    });

    test('All theme enum values should match available files', () => {
      // Get the package.json configuration
      const packageJson = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../../package.json'),
          'utf8'
        )
      );

      const themeEnumValues =
        packageJson.contributes.configuration.properties[
          'commentary.theme.name'
        ].enum;

      // Check that every enum value has a corresponding file
      for (const themeName of themeEnumValues) {
        const themeFile = path.join(themesDir, `${themeName}.css`);
        assert.ok(
          fs.existsSync(themeFile),
          `Theme enum value "${themeName}" has no corresponding CSS file`
        );
      }
    });

    test('All theme files should be in enum', () => {
      const files = fs.readdirSync(themesDir);
      const cssFiles = files.filter((f) => f.endsWith('.css'));

      const packageJson = JSON.parse(
        fs.readFileSync(
          path.join(__dirname, '../../package.json'),
          'utf8'
        )
      );

      const themeEnumValues =
        packageJson.contributes.configuration.properties[
          'commentary.theme.name'
        ].enum;

      for (const file of cssFiles) {
        const themeName = path.basename(file, '.css');
        assert.ok(
          themeEnumValues.includes(themeName),
          `Theme file "${file}" is not in package.json enum`
        );
      }
    });
  });

  suite('Cache Busting', () => {
    test('Cache busting should add unique query parameter', () => {
      // Simulate what markdownWebview.ts does
      const cacheBuster1 = Date.now();
      const themeUri = 'vscode-resource://theme.css';
      const themeUriWithCache1 = `${themeUri}?v=${cacheBuster1}`;

      // Wait a tiny bit
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      return delay(2).then(() => {
        const cacheBuster2 = Date.now();
        const themeUriWithCache2 = `${themeUri}?v=${cacheBuster2}`;

        // URLs should be different due to different timestamps
        assert.notStrictEqual(
          themeUriWithCache1,
          themeUriWithCache2,
          'Cache-busted URLs should be unique'
        );

        // Both should contain the query parameter
        assert.ok(themeUriWithCache1.includes('?v='), 'First URL should have cache-busting param');
        assert.ok(themeUriWithCache2.includes('?v='), 'Second URL should have cache-busting param');
      });
    });
  });

  suite('Codicons Integration', () => {
    test('Codicons should be copied to media directory', () => {
      const codiconsDir = path.join(__dirname, '../../media/codicons');
      assert.ok(fs.existsSync(codiconsDir), 'Codicons directory should exist');

      const codiconCss = path.join(codiconsDir, 'codicon.css');
      const codiconTtf = path.join(codiconsDir, 'codicon.ttf');

      assert.ok(fs.existsSync(codiconCss), 'codicon.css should exist');
      assert.ok(fs.existsSync(codiconTtf), 'codicon.ttf font file should exist');
    });

    test('Codicon CSS should not be empty', () => {
      const codiconCss = path.join(__dirname, '../../media/codicons/codicon.css');
      const stats = fs.statSync(codiconCss);
      assert.ok(stats.size > 0, 'codicon.css should not be empty');
    });
  });
});
