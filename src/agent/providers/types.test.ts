/**
 * Tests for provider types and pure utility functions
 */

import * as assert from 'assert';
import {
  ProviderConfig,
  selectProvider,
  getProviderDisplayName,
  validateConfig
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
    
    test('should validate OpenAI with API key', () => {
      const config: ProviderConfig = {
        provider: 'openai',
        enabled: true,
        openaiApiKey: 'sk-test-key'
      };
      
      const result = validateConfig(config);
      assert.strictEqual(result.valid, true);
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
});
