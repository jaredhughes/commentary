/**
 * Pure types and interfaces for agent providers
 * No VS Code dependencies - fully testable
 */

import { AgentRequest } from '../../types';

/**
 * Supported provider types
 */
export type ProviderType = 'claude' | 'cursor' | 'openai' | 'vscode' | 'custom';

/**
 * Provider configuration (from settings)
 */
export interface ProviderConfig {
  provider: ProviderType;
  enabled: boolean;
  model?: string;

  // Claude-specific
  claudeApiKey?: string;
  claudeCliPath?: string;

  // Cursor-specific
  cursorCliPath?: string;
  cursorInteractive?: boolean;

  // OpenAI-specific
  openaiApiKey?: string;
  openaiModel?: string;

  // Custom provider
  customEndpoint?: string;
  customApiKey?: string;
}

/**
 * Command to be executed (pure data)
 */
export interface TerminalCommand {
  command: string;
  args: string[];
  workingDirectory?: string;
  env?: Record<string, string>;
}

/**
 * Result of attempting to send via a provider
 */
export interface SendResult {
  success: boolean;
  method: 'api' | 'cli' | 'clipboard' | 'chat';
  message: string;
  command?: TerminalCommand;
  clipboardText?: string;
}

/**
 * Provider strategy interface
 * All methods are pure functions (no side effects)
 */
export interface ProviderStrategy {
  /**
   * Check if this provider can be used with the given config
   */
  canUse(config: ProviderConfig): boolean;
  
  /**
   * Determine the best method for this provider
   */
  getPreferredMethod(config: ProviderConfig): 'api' | 'cli' | 'clipboard' | 'chat';
  
  /**
   * Build terminal command for CLI method
   */
  buildTerminalCommand(
    prompt: string,
    request: AgentRequest,
    config: ProviderConfig
  ): TerminalCommand | null;
  
  /**
   * Get clipboard text for clipboard method
   */
  getClipboardText(
    prompt: string,
    request: AgentRequest,
    config: ProviderConfig
  ): string;
  
  /**
   * Get success message for user
   */
  getSuccessMessage(
    request: AgentRequest,
    method: 'api' | 'cli' | 'clipboard' | 'chat'
  ): string;
  
  /**
   * Get VS Code command to execute (for chat method)
   */
  getChatCommand(config: ProviderConfig): string | null;
}

/**
 * Pure function to select the appropriate provider strategy
 */
export function selectProvider(config: ProviderConfig): ProviderType {
  if (!config.enabled) {
    throw new Error('Agent integration is disabled');
  }
  
  return config.provider;
}

/**
 * Pure function to get provider display name
 */
export function getProviderDisplayName(provider: ProviderType): string {
  switch (provider) {
    case 'claude':
      return 'Claude';
    case 'cursor':
      return 'Cursor';
    case 'openai':
      return 'OpenAI';
    case 'vscode':
      return 'VS Code Chat';
    case 'custom':
      return 'AI Agent';
    default:
      return 'AI Agent';
  }
}

/**
 * Pure function to validate provider config
 */
export function validateConfig(config: ProviderConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!config.provider) {
    errors.push('No provider specified');
  }
  
  // Provider-specific validation
  switch (config.provider) {
    case 'claude':
      if (!config.claudeCliPath && !config.claudeApiKey) {
        errors.push('Claude requires either CLI path or API key');
      }
      break;

    case 'cursor':
      if (!config.cursorCliPath) {
        errors.push('Cursor requires CLI path configuration');
      }
      break;

    case 'openai':
      if (!config.openaiApiKey) {
        errors.push('OpenAI requires API key');
      }
      break;

    case 'custom':
      if (!config.customEndpoint) {
        errors.push('Custom provider requires endpoint URL');
      }
      break;
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Pure function to extract clean filename from file URI
 * Converts "file:///Users/jared/project/src/file.md" → "file.md"
 */
export function extractFileName(fileUri: string): string {
  // Handle 'Unknown file' case
  if (!fileUri || fileUri === 'Unknown file') {
    return fileUri;
  }

  // Extract filename from path (handles both file:// URIs and plain paths, both / and \)
  const fileName = fileUri.includes('/') || fileUri.includes('\\')
    ? fileUri.split(/[/\\]/).pop() || fileUri
    : fileUri;

  return fileName;
}

/**
 * Shared prompt formatting options
 */
export interface PromptFormatOptions {
  providerName: string;
  fileName: string;
  commentCount: number;
  prompt: string;
  includeFooter?: boolean;
  footerText?: string;
  emoji?: string;
}

/**
 * Build clipboard prompt text with consistent formatting
 */
export function buildClipboardPrompt(options: PromptFormatOptions): string {
  const { providerName, fileName, commentCount, prompt, emoji, footerText } = options;

  const header = emoji
    ? `# ${emoji} ${providerName} Review Request`
    : `# ${providerName} Review Request (${commentCount} comment${commentCount === 1 ? '' : 's'})`;

  const commentInfo = emoji
    ? `**Comments:** ${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`
    : `Comments: ${commentCount}`;

  const fileInfo = emoji
    ? `**File:** \`${fileName}\``
    : `File: ${fileName}`;

  const parts = [header, ''];

  if (emoji) {
    parts.push(commentInfo, fileInfo);
  } else {
    parts.push(fileInfo);
  }

  parts.push('', '---', '', prompt);

  if (footerText) {
    parts.push('', '---', '', footerText);
  }

  return parts.join('\n');
}

/**
 * Build CLI prompt text with consistent formatting
 */
export function buildCliPrompt(options: PromptFormatOptions): string {
  const { fileName, commentCount, prompt, footerText } = options;

  const parts = [
    '# Commentary Review Request',
    '',
    `File: ${fileName}`,
    `Comments: ${commentCount}`,
    '',
    prompt
  ];

  if (footerText) {
    parts.push('', '---', footerText);
  }

  return parts.join('\n');
}

/**
 * Build simple CLI prompt (for Claude's conversational style)
 */
export function buildSimpleCliPrompt(fileName: string, prompt: string, footerText?: string): string {
  const parts = [
    `I have comments on the file: ${fileName}`,
    '',
    prompt
  ];

  if (footerText) {
    parts.push('', footerText);
  }

  return parts.join('\n');
}
