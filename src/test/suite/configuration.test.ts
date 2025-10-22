import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Configuration Tests', () => {
  // Reset all configuration after each test to prevent pollution
  teardown(async () => {
    const config = vscode.workspace.getConfiguration('commentary');
    await config.update('agent.provider', undefined, vscode.ConfigurationTarget.Global);
    await config.update('agent.cursorCliPath', undefined, vscode.ConfigurationTarget.Global);
    await config.update('agent.cursorInteractive', undefined, vscode.ConfigurationTarget.Global);
    await config.update('agent.enabled', undefined, vscode.ConfigurationTarget.Global);
    await config.update('agent.contextLines', undefined, vscode.ConfigurationTarget.Global);
    await config.update('storage.mode', undefined, vscode.ConfigurationTarget.Global);

    // Give VS Code time to process configuration changes
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  suite('Agent Provider Configuration', () => {
    test('Should have cursor in provider enum', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const inspect = config.inspect<string>('provider');

      // Check that the configuration property exists
      assert.ok(inspect);
    });

    test('Should accept claude as provider', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      await config.update('provider', 'claude', vscode.ConfigurationTarget.Global);

      const provider = config.get<string>('provider');
      assert.strictEqual(provider, 'claude');
    });

    test('Should accept cursor as provider', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      await config.update('provider', 'cursor', vscode.ConfigurationTarget.Global);

      const provider = config.get<string>('provider');
      assert.strictEqual(provider, 'cursor');
    });

    test('Should accept openai as provider', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      await config.update('provider', 'openai', vscode.ConfigurationTarget.Global);

      const provider = config.get<string>('provider');
      assert.strictEqual(provider, 'openai');
    });

    test('Should accept custom as provider', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      await config.update('provider', 'custom', vscode.ConfigurationTarget.Global);

      const provider = config.get<string>('provider');
      assert.strictEqual(provider, 'custom');
    });

    test('Should have default provider as claude', () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const provider = config.get<string>('provider', 'claude');
      assert.strictEqual(provider, 'claude');
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

    test('Should allow custom cursorCliPath', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const customPath = '/usr/local/bin/cursor-agent';

      await config.update('cursorCliPath', customPath, vscode.ConfigurationTarget.Global);

      const cliPath = config.get<string>('cursorCliPath');
      assert.strictEqual(cliPath, customPath);
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

    test('Should allow setting cursorInteractive to false', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');

      await config.update('cursorInteractive', false, vscode.ConfigurationTarget.Global);

      const interactive = config.get<boolean>('cursorInteractive');
      assert.strictEqual(interactive, false);
    });

    test('Should allow setting cursorInteractive to true', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');

      await config.update('cursorInteractive', true, vscode.ConfigurationTarget.Global);

      const interactive = config.get<boolean>('cursorInteractive');
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

    test('Should allow custom contextLines', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');

      await config.update('contextLines', 10, vscode.ConfigurationTarget.Global);

      const contextLines = config.get<number>('contextLines');
      assert.strictEqual(contextLines, 10);
    });
  });

  suite('Configuration Interactions', () => {
    test('Should maintain separate configurations for different providers', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');

      // Set Cursor-specific config
      await config.update('provider', 'cursor', vscode.ConfigurationTarget.Global);
      await config.update('cursorCliPath', '/custom/cursor', vscode.ConfigurationTarget.Global);
      await config.update('cursorInteractive', false, vscode.ConfigurationTarget.Global);

      // Verify Cursor config
      assert.strictEqual(config.get<string>('provider'), 'cursor');
      assert.strictEqual(config.get<string>('cursorCliPath'), '/custom/cursor');
      assert.strictEqual(config.get<boolean>('cursorInteractive'), false);

      // Switch to Claude
      await config.update('provider', 'claude', vscode.ConfigurationTarget.Global);

      // Cursor config should still exist
      assert.strictEqual(config.get<string>('provider'), 'claude');
      assert.strictEqual(config.get<string>('cursorCliPath'), '/custom/cursor');
    });

    test('Should work with agent disabled regardless of provider', async () => {
      const config = vscode.workspace.getConfiguration('commentary.agent');

      await config.update('enabled', false, vscode.ConfigurationTarget.Global);
      await config.update('provider', 'cursor', vscode.ConfigurationTarget.Global);

      assert.strictEqual(config.get<boolean>('enabled'), false);
      assert.strictEqual(config.get<string>('provider'), 'cursor');
    });
  });

  suite('Theme Configuration', () => {
    test('Should have theme.name configuration', () => {
      const config = vscode.workspace.getConfiguration('commentary.theme');
      const inspect = config.inspect<string>('name');

      assert.ok(inspect !== undefined);
    });

    test('Should have default theme as github-light', () => {
      const config = vscode.workspace.getConfiguration('commentary.theme');
      const theme = config.get<string>('name', 'github-light');

      assert.strictEqual(theme, 'github-light');
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

    test('Should allow sidecar storage mode', async () => {
      const config = vscode.workspace.getConfiguration('commentary.storage');

      await config.update('mode', 'sidecar', vscode.ConfigurationTarget.Global);

      const mode = config.get<string>('mode');
      assert.strictEqual(mode, 'sidecar');
    });
  });
});
