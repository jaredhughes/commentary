/**
 * Pure Codex CLI provider logic
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

export class CodexProvider implements ProviderStrategy {
  canUse(config: ProviderConfig): boolean {
    return config.provider === 'codex' && !!config.codexCliPath;
  }

  getPreferredMethod(config: ProviderConfig): 'api' | 'cli' | 'clipboard' | 'chat' {
    // Prefer CLI if available
    if (config.codexCliPath) {
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
    if (!config.codexCliPath) {
      return null;
    }

    // Get the file being commented on for context
    const firstNote = request.contexts[0]?.note;
    if (!firstNote) {
      return null;
    }

    const fileUri = firstNote.file.replace('file://', '');
    const fileName = extractFileName(firstNote.file);

    // Build prompt with explicit file path for Codex to edit
    const promptWithFile = buildSimpleCliPrompt(
      fileName,
      prompt,
      `Review the ENTIRE document at ${fileUri}, then address the comments. Look for related changes throughout the document that would improve consistency or address similar issues. Don't just fix the specific commented sections—consider the broader document context and apply comprehensive improvements.`
    );

    // Create temp file path
    const tempDir = os.tmpdir();
    const uuid = randomUUID().split('-')[0]; // Use first segment for shorter filename
    const tempFileName = `commentary-codex-${uuid}.md`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // Codex CLI command for fully autonomous mode
    // --full-auto: runs without human confirmation (approved via webview click)
    // The actual writing of the temp file happens in the adapter layer
    return {
      command: config.codexCliPath,
      args: ['--full-auto'],
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
      providerName: 'Codex',
      fileName,
      commentCount: request.contexts.length,
      prompt,
      footerText: '[Copied to clipboard - paste into Codex]'
    });
  }

  getSuccessMessage(
    request: AgentRequest,
    method: 'api' | 'cli' | 'clipboard' | 'chat'
  ): string {
    const count = request.contexts.length;
    const commentText = `${count} comment${count === 1 ? '' : 's'}`;

    switch (method) {
      case 'cli':
        return `🚀 Opening Codex CLI with ${commentText}`;
      case 'clipboard':
        return `📋 Copied ${commentText} to clipboard for Codex`;
      default:
        return `✅ Sent ${commentText} to Codex`;
    }
  }

  getChatCommand(_config: ProviderConfig): string | null {
    // Codex doesn't have a built-in VS Code chat command
    return null;
  }
}

/**
 * Pure helper: Get default Codex CLI paths by platform
 */
export function getDefaultCodexCliPath(): string | null {
  const platform = process.platform;

  switch (platform) {
    case 'darwin': // macOS
      return '/usr/local/bin/codex';
    case 'linux':
      return '/usr/bin/codex';
    case 'win32': // Windows
      return 'C:\\Program Files\\Codex\\codex.exe';
    default:
      return null;
  }
}
