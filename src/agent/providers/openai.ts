/**
 * Pure OpenAI provider logic
 * No VS Code dependencies - fully testable
 */

import { AgentRequest } from '../../types';
import {
  ProviderStrategy,
  ProviderConfig,
  TerminalCommand,
  extractFileName,
  buildClipboardPrompt
} from './types';

export class OpenAIProvider implements ProviderStrategy {
  canUse(config: ProviderConfig): boolean {
    return config.provider === 'openai' && !!config.openaiApiKey;
  }

  getPreferredMethod(config: ProviderConfig): 'api' | 'cli' | 'clipboard' | 'chat' {
    // OpenAI only supports API
    if (config.openaiApiKey) {
      return 'api';
    }

    // Fallback to clipboard
    return 'clipboard';
  }

  /**
   * Call OpenAI API
   */
  async callApi(prompt: string, config: ProviderConfig): Promise<string> {
    const apiKey = config.openaiApiKey;
    if (!apiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const model = config.openaiModel || 'gpt-4';

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No response from OpenAI';
  }

  buildTerminalCommand(
    _prompt: string,
    _request: AgentRequest,
    _config: ProviderConfig
  ): TerminalCommand | null {
    // OpenAI doesn't have a CLI tool like Claude Code or cursor-agent
    return null;
  }

  getClipboardText(
    prompt: string,
    request: AgentRequest,
    _config: ProviderConfig
  ): string {
    const fileUri = request.contexts[0]?.note?.file || 'Unknown file';
    const fileName = extractFileName(fileUri);

    return buildClipboardPrompt({
      providerName: 'OpenAI',
      fileName,
      commentCount: request.contexts.length,
      prompt,
      emoji: '📝',
      footerText: '*✨ Ready to paste into ChatGPT*'
    });
  }

  getSuccessMessage(
    request: AgentRequest,
    method: 'api' | 'cli' | 'clipboard' | 'chat'
  ): string {
    const count = request.contexts.length;
    const commentText = `${count} comment${count === 1 ? '' : 's'}`;

    switch (method) {
      case 'api':
        return `💡 OpenAI response ready - check Output panel (manual edits required)`;
      case 'clipboard':
        return `📋 Copied ${commentText} to clipboard for ChatGPT`;
      default:
        return `Processed ${commentText}`;
    }
  }

  getChatCommand(_config: ProviderConfig): string | null {
    // OpenAI doesn't have chat commands in editors
    return null;
  }
}
