import * as assert from 'assert';
import { getAgentButtonConfig, getSaveButtonConfig, getDeleteButtonConfig } from './buttonConfig';

suite('Button Configuration Utils', () => {
  
  suite('getAgentButtonConfig', () => {
    
    // Icons are now consistent based on MODE (send vs copy), not provider
    test('returns send icon for Claude provider (send mode)', () => {
      const config = getAgentButtonConfig('claude');

      assert.ok(config.icon.includes('codicon-send'));
      assert.strictEqual(config.text, 'Send to agent');
      assert.ok(config.tooltip.includes('Claude'));
    });

    test('returns copy icon for Cursor provider without CLI (copy mode)', () => {
      const config = getAgentButtonConfig('cursor', false);

      assert.ok(config.icon.includes('codicon-copy'));
      assert.strictEqual(config.text, 'Copy for agent');
      assert.ok(config.tooltip.includes('Cursor'));
      assert.ok(config.tooltip.includes('clipboard'));
    });

    test('returns send icon for Cursor provider with CLI (send mode)', () => {
      const config = getAgentButtonConfig('cursor', true);

      assert.ok(config.icon.includes('codicon-send'));
      assert.strictEqual(config.text, 'Send to agent');
      assert.ok(config.tooltip.includes('Cursor Agent'));
      assert.ok(config.tooltip.includes('terminal'));
    });

    test('returns send icon for Codex provider (send mode)', () => {
      const config = getAgentButtonConfig('codex');

      assert.ok(config.icon.includes('codicon-send'));
      assert.strictEqual(config.text, 'Send to agent');
      assert.ok(config.tooltip.includes('Codex CLI'));
    });

    test('returns send icon for Gemini provider (send mode)', () => {
      const config = getAgentButtonConfig('gemini');

      assert.ok(config.icon.includes('codicon-send'));
      assert.strictEqual(config.text, 'Send to agent');
      assert.ok(config.tooltip.includes('Gemini CLI'));
    });

    test('returns send icon for VS Code provider (send mode)', () => {
      const config = getAgentButtonConfig('vscode');

      assert.ok(config.icon.includes('codicon-send'));
      assert.strictEqual(config.text, 'Send to chat');
      assert.ok(config.tooltip.includes('VS Code Chat'));
    });

    test('returns send icon for custom provider (send mode)', () => {
      const config = getAgentButtonConfig('custom');

      assert.ok(config.icon.includes('codicon-send'));
      assert.strictEqual(config.text, 'Send to agent');
      assert.ok(config.tooltip.includes('custom'));
    });
    
    test('returns fallback config for unknown provider', () => {
      // Test with a value that's not in the AgentProvider union
      const unknownProvider = 'unknown' as 'claude';
      const config = getAgentButtonConfig(unknownProvider);
      
      assert.ok(config.icon.includes('codicon-copy'));
      assert.strictEqual(config.text, 'Copy for agent');
      assert.ok(config.tooltip.includes('clipboard'));
    });
    
    test('all configs include valid codicon class', () => {
      const providers = ['claude', 'cursor', 'codex', 'gemini', 'vscode', 'custom'] as const;

      for (const provider of providers) {
        const config = getAgentButtonConfig(provider);
        assert.ok(config.icon.includes('class="codicon'),
          `${provider} should have codicon class`);
        assert.ok(config.icon.startsWith('<i '),
          `${provider} icon should be an <i> tag`);
        assert.ok(config.icon.endsWith('</i>'),
          `${provider} icon should close with </i>`);
      }
    });
  });
  
  suite('getSaveButtonConfig', () => {
    
    test('returns save icon with macOS shortcut', () => {
      const config = getSaveButtonConfig(true);

      assert.ok(config.icon.includes('codicon-save'));
      assert.strictEqual(config.text, 'Save');
      assert.ok(config.tooltip.includes('⌘+Enter'));
      assert.ok(!config.tooltip.includes('Ctrl+Enter'));
    });

    test('returns save icon with Windows/Linux shortcut', () => {
      const config = getSaveButtonConfig(false);

      assert.ok(config.icon.includes('codicon-save'));
      assert.strictEqual(config.text, 'Save');
      assert.ok(config.tooltip.includes('Ctrl+Enter'));
      assert.ok(!config.tooltip.includes('⌘+Enter'));
    });
    
    test('always includes valid codicon class', () => {
      const macConfig = getSaveButtonConfig(true);
      const winConfig = getSaveButtonConfig(false);
      
      for (const config of [macConfig, winConfig]) {
        assert.ok(config.icon.includes('class="codicon'));
        assert.ok(config.icon.startsWith('<i '));
        assert.ok(config.icon.endsWith('</i>'));
      }
    });
  });
  
  suite('getDeleteButtonConfig', () => {
    
    test('returns trash icon with no text', () => {
      const config = getDeleteButtonConfig();
      
      assert.ok(config.icon.includes('codicon-trash'));
      assert.strictEqual(config.text, '');
      assert.ok(config.tooltip.includes('Delete'));
    });
    
    test('includes valid codicon class', () => {
      const config = getDeleteButtonConfig();
      
      assert.ok(config.icon.includes('class="codicon'));
      assert.ok(config.icon.startsWith('<i '));
      assert.ok(config.icon.endsWith('</i>'));
    });
  });
  
  suite('Button Config Consistency', () => {
    
    test('all button configs have required properties', () => {
      const configs = [
        getAgentButtonConfig('claude'),
        getAgentButtonConfig('cursor'),
        getSaveButtonConfig(true),
        getDeleteButtonConfig()
      ];
      
      for (const config of configs) {
        assert.ok('icon' in config, 'Should have icon property');
        assert.ok('text' in config, 'Should have text property');
        assert.ok('tooltip' in config, 'Should have tooltip property');
        assert.strictEqual(typeof config.icon, 'string');
        assert.strictEqual(typeof config.text, 'string');
        assert.strictEqual(typeof config.tooltip, 'string');
      }
    });
    
    test('all icons are non-empty strings', () => {
      const configs = [
        getAgentButtonConfig('claude'),
        getSaveButtonConfig(true),
        getDeleteButtonConfig()
      ];
      
      for (const config of configs) {
        assert.ok(config.icon.length > 0, 'Icon should not be empty');
      }
    });
    
    test('all tooltips are non-empty strings', () => {
      const configs = [
        getAgentButtonConfig('claude'),
        getSaveButtonConfig(true),
        getDeleteButtonConfig()
      ];
      
      for (const config of configs) {
        assert.ok(config.tooltip.length > 0, 'Tooltip should not be empty');
      }
    });
  });
});
