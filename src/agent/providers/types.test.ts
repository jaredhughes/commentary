/**
 * Tests for provider types and pure utility functions
 */

import * as assert from 'assert';
import {
  ProviderConfig,
  selectProvider,
  getProviderDisplayName,
  validateConfig,
  extractFileName
} from './types';

suite('Provider Types and Utilities', () => {
  
  suite('selectProvider', () => {
    test('should return provider when enabled', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        enabled: true
      };
      
      assert.strictEqual(selectProvider(config), 'claude');
    });
    
    test('should throw when disabled', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        enabled: false
      };
      
      assert.throws(
        () => selectProvider(config),
        /disabled/
      );
    });
  });
  
  suite('getProviderDisplayName', () => {
    test('should return Claude for claude', () => {
      assert.strictEqual(getProviderDisplayName('claude'), 'Claude');
    });
    
    test('should return Cursor for cursor', () => {
      assert.strictEqual(getProviderDisplayName('cursor'), 'Cursor');
    });

    test('should return Codex for codex', () => {
      assert.strictEqual(getProviderDisplayName('codex'), 'Codex');
    });

    test('should return OpenAI for openai', () => {
      assert.strictEqual(getProviderDisplayName('openai'), 'OpenAI');
    });

    test('should return VS Code Chat for vscode', () => {
      assert.strictEqual(getProviderDisplayName('vscode'), 'VS Code Chat');
    });

    test('should return AI Agent for custom', () => {
      assert.strictEqual(getProviderDisplayName('custom'), 'AI Agent');
    });
  });
  
  suite('validateConfig', () => {
    test('should validate Claude with CLI path', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        enabled: true,
        claudeCliPath: '/usr/local/bin/claude'
      };
      
      const result = validateConfig(config);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
    
    test('should validate Claude with API key', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        enabled: true,
        claudeApiKey: 'sk-ant-test-key'
      };
      
      const result = validateConfig(config);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });
    
    test('should invalidate Claude without CLI or API key', () => {
      const config: ProviderConfig = {
        provider: 'claude',
        enabled: true
      };
      
      const result = validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors.length > 0);
      assert.ok(result.errors[0].includes('CLI path or API key'));
    });
    
    test('should validate Cursor with CLI path', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true,
        cursorCliPath: '/usr/local/bin/cursor'
      };
      
      const result = validateConfig(config);
      assert.strictEqual(result.valid, true);
    });
    
    test('should invalidate Cursor without CLI path', () => {
      const config: ProviderConfig = {
        provider: 'cursor',
        enabled: true
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('CLI path'));
    });

    test('should validate Codex with CLI path', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true,
        codexCliPath: '/usr/local/bin/codex'
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should invalidate Codex without CLI path', () => {
      const config: ProviderConfig = {
        provider: 'codex',
        enabled: true
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('CLI path'));
    });

    test('should validate OpenAI with API key', () => {
      const config: ProviderConfig = {
        provider: 'openai',
        enabled: true,
        openaiApiKey: 'sk-test123'
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.errors.length, 0);
    });

    test('should invalidate OpenAI without API key', () => {
      const config: ProviderConfig = {
        provider: 'openai',
        enabled: true
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('API key'));
    });

    test('should validate custom with endpoint', () => {
      const config: ProviderConfig = {
        provider: 'custom',
        enabled: true,
        customEndpoint: 'https://api.example.com'
      };

      const result = validateConfig(config);
      assert.strictEqual(result.valid, true);
    });
    
    test('should invalidate custom without endpoint', () => {
      const config: ProviderConfig = {
        provider: 'custom',
        enabled: true
      };
      
      const result = validateConfig(config);
      assert.strictEqual(result.valid, false);
      assert.ok(result.errors[0].includes('endpoint'));
    });
  });

  suite('extractFileName', () => {
    test('should extract filename from Unix path', () => {
      assert.strictEqual(extractFileName('/home/user/documents/readme.md'), 'readme.md');
    });

    test('should extract filename from Windows path', () => {
      assert.strictEqual(extractFileName('C:\\Documents\\Projects\\readme.md'), 'readme.md');
    });

    test('should extract filename from file:// URI', () => {
      assert.strictEqual(extractFileName('file:///home/user/documents/readme.md'), 'readme.md');
    });

    test('should extract filename from mixed path separators', () => {
      assert.strictEqual(extractFileName('C:\\Documents/Projects/readme.md'), 'readme.md');
    });

    test('should handle filename without path', () => {
      assert.strictEqual(extractFileName('readme.md'), 'readme.md');
    });

    test('should handle Unknown file', () => {
      assert.strictEqual(extractFileName('Unknown file'), 'Unknown file');
    });

    test('should handle empty string', () => {
      assert.strictEqual(extractFileName(''), '');
    });

    test('should handle trailing slash', () => {
      // Trailing slash results in empty string after split().pop()
      // which falls back to original string
      assert.strictEqual(extractFileName('/home/user/documents/'), '/home/user/documents/');
    });

    test('should handle trailing backslash', () => {
      // Trailing backslash results in empty string after split().pop()
      // which falls back to original string
      assert.strictEqual(extractFileName('C:\\Documents\\Projects\\'), 'C:\\Documents\\Projects\\');
    });
  });
});
