/**
 * Tests for Codex provider
 */

import * as assert from 'assert';
import { CodexProvider, getDefaultCodexCliPath } from './codex';
import { ProviderConfig } from './types';
import { AgentRequest, Note } from '../../types';

suite('Codex Provider', () => {
  let provider: CodexProvider;
  let mockRequest: AgentRequest;

  setup(() => {
    provider = new CodexProvider();

    const mockNote: Note = {
      id: 'test-1',
      file: 'file:///test/file.md',
      quote: { exact: 'test text', prefix: '', suffix: '' },
      position: { start: 0, end: 9 },
      text: 'Test comment',
      createdAt: new Date().toISOString()
    };

    mockRequest = {
      contexts: [{
        note: mockNote,
        contextBefore: 'before',
        contextAfter: 'after'
      }]
    };
  });

  suite('canUse', () => {
    test('should return true when Codex CLI path is configured', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true,
        codexCliPath: '/usr/local/bin/codex'
      };

      assert.strictEqual(provider.canUse(config), true);
    });

    test('should return false when provider is not codex', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        enabled: true,
        codexCliPath: '/usr/local/bin/codex'
      };

      assert.strictEqual(provider.canUse(config), false);
    });

    test('should return false when CLI path is not configured', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true
      };

      assert.strictEqual(provider.canUse(config), false);
    });
  });

  suite('getPreferredMethod', () => {
    test('should prefer CLI when CLI path is configured', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true,
        codexCliPath: '/usr/local/bin/codex'
      };

      assert.strictEqual(provider.getPreferredMethod(config), 'cli');
    });

    test('should fallback to clipboard when CLI path is missing', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true
      };

      assert.strictEqual(provider.getPreferredMethod(config), 'clipboard');
    });
  });

  suite('buildTerminalCommand', () => {
    test('should build command with --full-auto flag and temp file env vars', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true,
        codexCliPath: '/usr/local/bin/codex'
      };

      const command = provider.buildTerminalCommand('test prompt', mockRequest, config);

      assert.ok(command);
      assert.strictEqual(command!.command, '/usr/local/bin/codex');
      // args include --full-auto for autonomous mode
      assert.deepStrictEqual(command!.args, ['--full-auto']);
      // Temp file info in env for adapter to pipe
      assert.ok(command!.env);
      assert.ok(command!.env.commentaryTempFile);
      assert.ok(command!.env.commentaryPrompt);
      assert.ok(command!.env.commentaryTempFile.includes('commentary-codex'));
    });

    test('should return null when CLI path is missing', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true
      };

      const command = provider.buildTerminalCommand('test prompt', mockRequest, config);
      assert.strictEqual(command, null);
    });

    test('should return null when request has no contexts', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true,
        codexCliPath: '/usr/local/bin/codex'
      };

      const emptyRequest: AgentRequest = { contexts: [] };
      const command = provider.buildTerminalCommand('test prompt', emptyRequest, config);
      assert.strictEqual(command, null);
    });
  });

  suite('getClipboardText', () => {
    test('should format clipboard text with comment count', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true
      };

      const text = provider.getClipboardText('test prompt', mockRequest, config);

      assert.ok(text.includes('1 comment'));
      assert.ok(text.includes('test prompt'));
      assert.ok(text.includes('file.md')); // Just filename, not full URI
      assert.ok(text.includes('Codex'));
    });

    test('should pluralize comments correctly', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true
      };

      const multiRequest: AgentRequest = {
        contexts: [mockRequest.contexts[0], mockRequest.contexts[0]]
      };

      const text = provider.getClipboardText('test prompt', multiRequest, config);
      assert.ok(text.includes('2 comments'));
    });
  });

  suite('getSuccessMessage', () => {
    test('should return CLI message for cli method', () => {
      const msg = provider.getSuccessMessage(mockRequest, 'cli');
      assert.ok(msg.includes('🚀'));
      assert.ok(msg.includes('Opening Codex CLI'));
      assert.ok(msg.includes('1 comment'));
    });

    test('should return clipboard message for clipboard method', () => {
      const msg = provider.getSuccessMessage(mockRequest, 'clipboard');
      assert.ok(msg.includes('📋'));
      assert.ok(msg.includes('Copied'));
      assert.ok(msg.includes('clipboard'));
    });
  });

  suite('getChatCommand', () => {
    test('should return null (Codex has no VS Code chat)', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true
      };

      const command = provider.getChatCommand(config);
      assert.strictEqual(command, null);
    });
  });

  suite('getDefaultCodexCliPath helper', () => {
    test('should return a path for known platforms', () => {
      const path = getDefaultCodexCliPath();
      // Path depends on platform, but should be a string or null
      assert.ok(path === null || typeof path === 'string');
      if (path) {
        assert.ok(path.includes('codex'));
      }
    });
  });
});
