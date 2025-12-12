/**
 * Pure functions for button configuration logic
 * Determines button appearance and behavior based on provider settings
 */

export type AgentProvider = 'claude' | 'cursor' | 'codex' | 'openai' | 'vscode' | 'custom';

export interface ButtonConfig {
  icon: string;
  text: string;
  tooltip: string;
}

/**
 * Get button configuration for the AI agent based on provider
 * @param provider - The configured AI agent provider
 * @param hasCursorCli - Whether Cursor CLI is configured (only relevant for cursor provider)
 * @returns Button configuration with icon HTML, text, and tooltip
 */
export function getAgentButtonConfig(provider: AgentProvider, hasCursorCli: boolean = false): ButtonConfig {
  switch (provider) {
    case 'claude':
      return {
        icon: '<i class="codicon codicon-sparkle"></i>',
        text: 'Send to agent',
        tooltip: 'Send comment to Claude Code via terminal'
      };

    case 'cursor':
      // Different icon/text based on whether CLI is configured
      if (hasCursorCli) {
        return {
          icon: '<i class="codicon codicon-terminal"></i>',
          text: 'Send to agent',
          tooltip: 'Send comment to Cursor Agent via terminal'
        };
      } else {
        return {
          icon: '<i class="codicon codicon-copy"></i>',
          text: 'Copy for agent',
          tooltip: 'Copy comment to clipboard for Cursor chat'
        };
      }

    case 'codex':
      return {
        icon: '<i class="codicon codicon-terminal"></i>',
        text: 'Send to agent',
        tooltip: 'Send comment to Codex CLI via terminal'
      };

    case 'openai':
      return {
        icon: '<i class="codicon codicon-rocket"></i>',
        text: 'Send to agent',
        tooltip: 'Send comment to OpenAI API (GPT-4)'
      };

    case 'vscode':
      return {
        icon: '<i class="codicon codicon-comment-discussion"></i>',
        text: 'Send to chat',
        tooltip: 'Send comment to VS Code Chat'
      };

    case 'custom':
      return {
        icon: '<i class="codicon codicon-send"></i>',
        text: 'Send to agent',
        tooltip: 'Send comment to custom agent'
      };

    default:
      // Fallback for unknown providers
      return {
        icon: '<i class="codicon codicon-copy"></i>',
        text: 'Copy for agent',
        tooltip: 'Copy comment to clipboard'
      };
  }
}

/**
 * Get save button configuration
 * @param isMac - Whether the platform is macOS
 * @returns Button configuration with icon HTML and platform-specific tooltip
 */
export function getSaveButtonConfig(isMac: boolean): ButtonConfig {
  const shortcut = isMac ? '⌘+Enter' : 'Ctrl+Enter';
  return {
    icon: '<i class="codicon codicon-save"></i>',
    text: 'Save',
    tooltip: `Save comment (${shortcut})`
  };
}

/**
 * Get delete button configuration
 * @returns Button configuration with icon HTML only (no text)
 */
export function getDeleteButtonConfig(): ButtonConfig {
  return {
    icon: '<i class="codicon codicon-trash"></i>',
    text: '',
    tooltip: 'Delete this comment'
  };
}
