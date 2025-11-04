/**
 * Tests for Cursor provider
 */

import * as assert from 'assert';
import { CursorProvider, getCursorChatCommands, buildCursorTempFileContent } from './cursor';
import { ProviderConfig } from './types';
import { AgentRequest, Note } from '../../types';

suite('Cursor Provider', () => {
  let provider: CursorProvider;
  let mockRequest: AgentRequest;

  setup(() => {
    provider = new CursorProvider();
    
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
    test('should return true when Cursor CLI path is configured', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true,
        cursorCliPath: '/usr/local/bin/cursor'
      };
      
      assert.strictEqual(provider.canUse(config), true);
    });
    
    test('should return false when provider is not cursor', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        enabled: true,
        cursorCliPath: '/usr/local/bin/cursor'
      };
      
      assert.strictEqual(provider.canUse(config), false);
    });
    
    test('should return false when CLI path is not configured', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true
      };
      
      assert.strictEqual(provider.canUse(config), false);
    });
  });
  
  suite('getPreferredMethod', () => {
    test('should prefer CLI when interactive mode is enabled', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true,
        cursorCliPath: '/usr/local/bin/cursor',
        cursorInteractive: true
      };
      
      assert.strictEqual(provider.getPreferredMethod(config), 'cli');
    });
    
    test('should fallback to clipboard when interactive is disabled', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true,
        cursorCliPath: '/usr/local/bin/cursor',
        cursorInteractive: false
      };
      
      assert.strictEqual(provider.getPreferredMethod(config), 'clipboard');
    });
    
    test('should fallback to clipboard when CLI path is missing', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true
      };
      
      assert.strictEqual(provider.getPreferredMethod(config), 'clipboard');
    });
  });
  
  suite('buildTerminalCommand', () => {
    test('should build command with temp file', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true,
        cursorCliPath: '/usr/local/bin/cursor'
      };
      
      const command = provider.buildTerminalCommand('test prompt', mockRequest, config);

      assert.ok(command);
      assert.strictEqual(command!.command, '/usr/local/bin/cursor');
      assert.ok(command!.args[0].includes('commentary-cursor'));
      assert.ok(command!.env);
      assert.ok(command!.env.commentaryTempFile);
      assert.ok(command!.env.commentaryPrompt);
    });
    
    test('should return null when CLI path is missing', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true
      };
      
      const command = provider.buildTerminalCommand('test prompt', mockRequest, config);
      assert.strictEqual(command, null);
    });
    
    test('should return null when request has no contexts', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true,
        cursorCliPath: '/usr/local/bin/cursor'
      };
      
      const emptyRequest: AgentRequest = { contexts: [] };
      const command = provider.buildTerminalCommand('test prompt', emptyRequest, config);
      assert.strictEqual(command, null);
    });
  });
  
  suite('getClipboardText', () => {
    test('should format clipboard text with comment count', () => {
      const text = provider.getClipboardText('test prompt', mockRequest);

      assert.ok(text.includes('1 comment'));
      assert.ok(text.includes('test prompt'));
      assert.ok(text.includes('file:///test/file.md'));
    });

    test('should pluralize comments correctly', () => {
      const multiRequest: AgentRequest = {
        contexts: [mockRequest.contexts[0], mockRequest.contexts[0]]
      };

      const text = provider.getClipboardText('test prompt', multiRequest);
      assert.ok(text.includes('2 comments'));
    });
  });
  
  suite('getSuccessMessage', () => {
    test('should return CLI message for cli method', () => {
      const msg = provider.getSuccessMessage(mockRequest, 'cli');
      assert.ok(msg.includes('Opening Cursor editor'));
      assert.ok(msg.includes('1 comment'));
    });
    
    test('should return clipboard message for clipboard method', () => {
      const msg = provider.getSuccessMessage(mockRequest, 'clipboard');
      assert.ok(msg.includes('Copied'));
      assert.ok(msg.includes('clipboard'));
    });
    
    test('should return chat message for chat method', () => {
      const msg = provider.getSuccessMessage(mockRequest, 'chat');
      assert.ok(msg.includes('Opening Cursor chat'));
    });
  });
  
  suite('getChatCommand', () => {
    test('should return Cursor chat command', () => {
      const command = provider.getChatCommand();
      assert.strictEqual(command, 'aichat.newchataction');
    });
  });
  
  suite('getCursorChatCommands helper', () => {
    test('should return array of chat commands', () => {
      const commands = getCursorChatCommands();
      assert.ok(Array.isArray(commands));
      assert.ok(commands.length > 0);
      assert.ok(commands.includes('aichat.newchataction'));
    });
  });
  
  suite('buildCursorTempFileContent helper', () => {
    test('should build temp file content with prompt', () => {
      const { content, fileName } = buildCursorTempFileContent('test prompt', mockRequest);
      
      assert.ok(content.includes('test prompt'));
      assert.ok(content.includes('/test/file.md'));
      assert.ok(content.includes('1'));
      assert.ok(fileName.includes('commentary-cursor'));
      assert.ok(fileName.endsWith('.md'));
    });
  });
});
