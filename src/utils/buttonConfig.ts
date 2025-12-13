/**
 * Pure functions for button configuration logic
 * Determines button appearance and behavior based on provider settings
 */

export type AgentProvider = 'claude' | 'cursor' | 'codex' | 'gemini' | 'vscode' | 'custom';

export interface ButtonConfig {
  icon: string;
  text: string;
  tooltip: string;
}

/**
 * Get button configuration for the AI agent based on provider
 * All providers use terminal icon to emphasize CLI/terminal integration
 *
 * @param provider - The configured AI agent provider
 * @param hasCursorCli - Whether Cursor CLI is configured (kept for backward compatibility)
 * @returns Button configuration with icon HTML, text, and tooltip
 */
export function getAgentButtonConfig(provider: AgentProvider, hasCursorCli: boolean = false): ButtonConfig {
  // Use terminal icon for all providers (all-in on CLI/terminal integration)
  const terminalIcon = '<i class="codicon codicon-terminal"></i>';

  switch (provider) {
    case 'claude':
      return {
        icon: terminalIcon,
        text: 'Send to agent',
        tooltip: 'Send comment to Claude Code via terminal'
      };

    case 'cursor':
      return {
        icon: terminalIcon,
        text: 'Send to agent',
        tooltip: 'Send comment to Cursor Agent via terminal'
      };

    case 'codex':
      return {
        icon: terminalIcon,
        text: 'Send to agent',
        tooltip: 'Send comment to Codex CLI via terminal'
      };

    case 'gemini':
      return {
        icon: terminalIcon,
        text: 'Send to agent',
        tooltip: 'Send comment to Gemini CLI via terminal'
      };

    case 'vscode':
      return {
        icon: terminalIcon,
        text: 'Send to chat',
        tooltip: 'Send comment to VS Code Chat'
      };

    case 'custom':
      return {
        icon: terminalIcon,
        text: 'Send to agent',
        tooltip: 'Send comment to custom agent'
      };

    default:
      // Fallback for unknown providers
      return {
        icon: terminalIcon,
        text: 'Send to agent',
        tooltip: 'Send comment via terminal'
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
