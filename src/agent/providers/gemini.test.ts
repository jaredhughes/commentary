/**
 * Tests for Gemini provider
 */

import * as assert from 'assert';
import { GeminiProvider, getDefaultGeminiCliPath } from './gemini';
import { ProviderConfig } from './types';
import { AgentRequest, Note } from '../../types';

suite('Gemini Provider', () => {
  let provider: GeminiProvider;
  let mockRequest: AgentRequest;

  setup(() => {
    provider = new GeminiProvider();

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
    test('should return true when Gemini CLI path is configured', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true,
        geminiCliPath: '/usr/local/bin/gemini'
      };

      assert.strictEqual(provider.canUse(config), true);
    });

    test('should return false when provider is not gemini', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        enabled: true,
        geminiCliPath: '/usr/local/bin/gemini'
      };

      assert.strictEqual(provider.canUse(config), false);
    });

    test('should return false when CLI path is not configured', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true
      };

      assert.strictEqual(provider.canUse(config), false);
    });
  });

  suite('getPreferredMethod', () => {
    test('should prefer CLI when CLI path is configured', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true,
        geminiCliPath: '/usr/local/bin/gemini'
      };

      assert.strictEqual(provider.getPreferredMethod(config), 'cli');
    });

    test('should fallback to clipboard when CLI path is missing', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true
      };

      assert.strictEqual(provider.getPreferredMethod(config), 'clipboard');
    });
  });

  suite('buildTerminalCommand', () => {
    test('should build interactive command with no args by default', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true,
        geminiCliPath: '/usr/local/bin/gemini'
        // geminiMode defaults to 'interactive'
      };

      const command = provider.buildTerminalCommand('test prompt', mockRequest, config);

      assert.ok(command);
      assert.strictEqual(command!.command, '/usr/local/bin/gemini');
      // Interactive mode: no args, prompt piped via stdin
      assert.deepStrictEqual(command!.args, []);
      // Temp file info in env for adapter to use
      assert.ok(command!.env);
      assert.ok(command!.env.commentaryTempFile);
      assert.ok(command!.env.commentaryPrompt);
      assert.ok(command!.env.commentaryTempFile.includes('commentary-gemini'));
      // Interactive mode doesn't use argument-style invocation
      assert.strictEqual(command!.env.commentaryUseArgument, undefined);
    });

    test('should build batch command with -p flag when geminiMode is batch', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true,
        geminiCliPath: '/usr/local/bin/gemini',
        geminiMode: 'batch'
      };

      const command = provider.buildTerminalCommand('test prompt', mockRequest, config);

      assert.ok(command);
      assert.strictEqual(command!.command, '/usr/local/bin/gemini');
      // Batch mode: -p flag for non-interactive prompt mode
      assert.deepStrictEqual(command!.args, ['-p']);
      // Temp file info in env for adapter to use
      assert.ok(command!.env);
      assert.ok(command!.env.commentaryTempFile);
      assert.ok(command!.env.commentaryPrompt);
      assert.ok(command!.env.commentaryTempFile.includes('commentary-gemini'));
      // Batch mode uses argument-style invocation
      assert.strictEqual(command!.env.commentaryUseArgument, 'true');
    });

    test('should return null when CLI path is missing', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true
      };

      const command = provider.buildTerminalCommand('test prompt', mockRequest, config);
      assert.strictEqual(command, null);
    });

    test('should return null when request has no contexts', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true,
        geminiCliPath: '/usr/local/bin/gemini'
      };

      const emptyRequest: AgentRequest = { contexts: [] };
      const command = provider.buildTerminalCommand('test prompt', emptyRequest, config);
      assert.strictEqual(command, null);
    });
  });

  suite('getClipboardText', () => {
    test('should format clipboard text with comment count', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true
      };

      const text = provider.getClipboardText('test prompt', mockRequest, config);

      assert.ok(text.includes('1 comment'));
      assert.ok(text.includes('test prompt'));
      assert.ok(text.includes('file.md')); // Just filename, not full URI
      assert.ok(text.includes('Gemini'));
    });

    test('should pluralize comments correctly', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
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
      assert.ok(msg.includes('Opening Gemini CLI'));
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
    test('should return null (Gemini has no VS Code chat)', () => {
      const config: ProviderConfig = {
        provider: 'gemini',
        enabled: true
      };

      const command = provider.getChatCommand(config);
      assert.strictEqual(command, null);
    });
  });

  suite('getDefaultGeminiCliPath helper', () => {
    test('should return a path for known platforms', () => {
      const path = getDefaultGeminiCliPath();
      // Path depends on platform, but should be a string or null
      assert.ok(path === null || typeof path === 'string');
      if (path) {
        assert.ok(path.includes('gemini'));
      }
    });
  });
});
