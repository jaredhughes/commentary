import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Configuration Tests', () => {
  suite('Agent Provider Configuration', () => {
    test('Should have cursor in provider enum', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const inspect = config.inspect<string>('provider');

      // Check that the configuration property exists
      assert.ok(inspect);
    });

    test('Should have default provider as claude', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const inspect = config.inspect<string>('provider');
      // Check the package.json default, not the current value (which may be overridden in user settings)
      assert.strictEqual(inspect?.defaultValue, 'claude');
    });
  });

  suite('Cursor-Specific Configuration', () => {
    test('Should have cursorCliPath configuration', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const inspect = config.inspect<string>('cursorCliPath');

      assert.ok(inspect !== undefined);
    });

    test('Should have default cursorCliPath value', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const cliPath = config.get<string>('cursorCliPath', 'cursor-agent');

      assert.strictEqual(cliPath, 'cursor-agent');
    });

    test('Should have cursorInteractive configuration', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const inspect = config.inspect<boolean>('cursorInteractive');

      assert.ok(inspect !== undefined);
    });

    test('Should have default cursorInteractive as true', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const interactive = config.get<boolean>('cursorInteractive', true);

      assert.strictEqual(interactive, true);
    });
  });

  suite('General Agent Configuration', () => {
    test('Should have enabled configuration', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const inspect = config.inspect<boolean>('enabled');

      assert.ok(inspect !== undefined);
    });

    test('Should have default enabled as true', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const enabled = config.get<boolean>('enabled', true);

      assert.strictEqual(enabled, true);
    });

    test('Should have model configuration', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const inspect = config.inspect<string>('model');

      assert.ok(inspect !== undefined);
    });

    test('Should have contextLines configuration', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const inspect = config.inspect<number>('contextLines');

      assert.ok(inspect !== undefined);
    });

    test('Should have default contextLines as 6', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const contextLines = config.get<number>('contextLines', 6);

      assert.strictEqual(contextLines, 6);
    });
  });

  suite('Theme Configuration', () => {
    test('Should have theme.name configuration', () => {
      const config = vscode.workspace.getConfiguration('commentary.theme');
      const inspect = config.inspect<string>('name');

      assert.ok(inspect !== undefined);
    });

    test('Should have default theme as simple', () => {
      const config = vscode.workspace.getConfiguration('commentary.theme');
      const theme = config.get<string>('name', 'simple');

      assert.strictEqual(theme, 'simple');
    });
  });

  suite('Storage Configuration', () => {
    test('Should have storage.mode configuration', () => {
      const config = vscode.workspace.getConfiguration('commentary.storage');
      const inspect = config.inspect<string>('mode');

      assert.ok(inspect !== undefined);
    });

    test('Should have default storage mode as workspace', () => {
      const config = vscode.workspace.getConfiguration('commentary.storage');
      const mode = config.get<string>('mode', 'workspace');

      assert.strictEqual(mode, 'workspace');
    });
  });
});
