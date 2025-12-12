/**
 * Pure Claude provider logic
 * No VS Code dependencies - fully testable
 */

import * as path from 'path';
import * as os from 'os';
import { randomUUID } from 'crypto';
import { AgentRequest } from '../../types';
import {
  ProviderStrategy,
  ProviderConfig,
  TerminalCommand,
  extractFileName,
  buildClipboardPrompt,
  buildSimpleCliPrompt
} from './types';

export class ClaudeProvider implements ProviderStrategy {
  canUse(config: ProviderConfig): boolean {
    return config.provider === 'claude' && !!(config.claudeCliPath || config.claudeApiKey);
  }

  getPreferredMethod(config: ProviderConfig): 'api' | 'cli' | 'clipboard' | 'chat' {
    // Prefer API if available
    if (config.claudeApiKey) {
      return 'api';
    }
    
    // Then CLI if available
    if (config.claudeCliPath) {
      return 'cli';
    }
    
    // Fallback to clipboard
    return 'clipboard';
  }

  buildTerminalCommand(
    prompt: string,
    request: AgentRequest,
    config: ProviderConfig
  ): TerminalCommand | null {
    if (!config.claudeCliPath) {
      return null;
    }

    // Get the file being commented on for context
    const firstNote = request.contexts[0]?.note;
    if (!firstNote) {
      return null;
    }

    const fileUri = firstNote.file.replace('file://', '');
    const fileName = extractFileName(firstNote.file);

    // Build prompt with explicit file path for Claude to edit
    // Include absolute path so Claude's Edit tool can find the file
    const promptWithFile = buildSimpleCliPrompt(
      fileName,
      prompt,
      `Review the ENTIRE document at ${fileUri} and address the comments. Look for related changes throughout the document that would improve consistency or address similar issues. Don't just fix the specific commented sections—consider the broader document context and apply comprehensive improvements. Use the Edit tool to make all changes.`
    );

    // Create temp file path
    const tempDir = os.tmpdir();
    const uuid = randomUUID().split('-')[0]; // Use first segment for shorter filename
    const tempFileName = `commentary-claude-${uuid}.md`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // Claude Code CLI command for interactive session with initial prompt piped via stdin
    // --permission-mode bypassPermissions: bypasses all permission checks including sensitive locations
    //   (required because initial input is piped, and user already approved by clicking "Send")
    // --add-dir: explicitly allow access to the file's directory
    // Note: Interactive mode (no --print) has all tools available by default and stays open for continued interaction
    // The actual writing of the temp file happens in the adapter layer
    return {
      command: config.claudeCliPath,
      args: [
        '--permission-mode', 'bypassPermissions',
        '--add-dir', path.dirname(fileUri)
      ],
      workingDirectory: path.dirname(fileUri),
      env: {
        commentaryTempFile: tempFilePath,
        commentaryPrompt: promptWithFile
      }
    };
  }

  getClipboardText(
    prompt: string,
    request: AgentRequest,
    _config: ProviderConfig
  ): string {
    const fileUri = request.contexts[0]?.note?.file || 'Unknown file';
    const fileName = extractFileName(fileUri);

    return buildClipboardPrompt({
      providerName: 'Claude',
      fileName,
      commentCount: request.contexts.length,
      prompt,
      footerText: '[Copied to clipboard - paste into Claude]'
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
        return `✨ Sending ${commentText} to Claude API`;
      case 'cli':
        return `🚀 Opening Claude Code with ${commentText}`;
      case 'clipboard':
        return `📋 Copied ${commentText} to clipboard for Claude`;
      default:
        return `✅ Sent ${commentText} to Claude`;
    }
  }

  getChatCommand(_config: ProviderConfig): string | null {
    // Claude doesn't have a built-in VS Code chat command
    return null;
  }
}

/**
 * Pure helper: Build temp file content for Claude CLI
 */
export function buildClaudeTempFileContent(
  prompt: string,
  request: AgentRequest
): { content: string; fileName: string } {
  const firstNote = request.contexts[0]?.note;
  const cleanFileName = extractFileName(firstNote?.file || 'Unknown file');

  const content = buildSimpleCliPrompt(
    cleanFileName,
    prompt,
    'Review the ENTIRE document and address the comments. Look for related changes throughout the document that would improve consistency or address similar issues. Apply comprehensive improvements.'
  );

  const uuid = randomUUID().split('-')[0]; // Use first segment for shorter filename
  const fileName = `commentary-claude-${uuid}.md`;

  return { content, fileName };
}

/**
 * Pure helper: Validate Claude API key format
 */
export function isValidClaudeApiKey(apiKey: string | undefined): boolean {
  if (!apiKey) {
    return false;
  }
  
  // Claude API keys typically start with 'sk-ant-'
  return apiKey.startsWith('sk-ant-') && apiKey.length > 20;
}

/**
 * Pure helper: Get default Claude CLI paths by platform
 */
export function getDefaultClaudeCliPath(): string | null {
  const platform = process.platform;
  
  switch (platform) {
    case 'darwin': // macOS
      return '/usr/local/bin/claude';
    case 'linux':
      return '/usr/bin/claude';
    case 'win32': // Windows
      return 'C:\\Program Files\\Claude\\claude.exe';
    default:
      return null;
  }
}
