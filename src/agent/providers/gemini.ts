/**
 * Pure Gemini CLI provider logic
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

export class GeminiProvider implements ProviderStrategy {
  canUse(config: ProviderConfig): boolean {
    return config.provider === 'gemini' && !!config.geminiCliPath;
  }

  getPreferredMethod(config: ProviderConfig): 'api' | 'cli' | 'clipboard' | 'chat' {
    // Prefer CLI if available
    if (config.geminiCliPath) {
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
    if (!config.geminiCliPath) {
      return null;
    }

    // Get the file being commented on for context
    const firstNote = request.contexts[0]?.note;
    if (!firstNote) {
      return null;
    }

    const fileUri = firstNote.file.replace('file://', '');
    const fileName = extractFileName(firstNote.file);

    // Build prompt for Gemini
    const promptWithFile = buildSimpleCliPrompt(
      fileName,
      prompt,
      `File location: ${fileUri}`
    );

    // Create temp file path
    const tempDir = os.tmpdir();
    const uuid = randomUUID().split('-')[0]; // Use first segment for shorter filename
    const tempFileName = `commentary-gemini-${uuid}.md`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // Check mode setting (defaults to 'interactive')
    const mode = config.geminiMode || 'interactive';
    const isBatch = mode === 'batch';

    // Gemini CLI: interactive mode (stays open) or batch mode (executes and closes)
    // The actual writing of the temp file happens in the adapter layer
    return {
      command: config.geminiCliPath,
      args: isBatch ? ['-p'] : [],  // Use '-p' flag for batch/prompt mode
      workingDirectory: path.dirname(fileUri),
      env: {
        commentaryTempFile: tempFilePath,
        commentaryPrompt: promptWithFile,
        // Use argument-style invocation for batch mode, piping for interactive
        ...(isBatch ? { commentaryUseArgument: 'true' } : {})
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
      providerName: 'Gemini',
      fileName,
      commentCount: request.contexts.length,
      prompt,
      footerText: '[Copied to clipboard - paste into Gemini]'
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
        return `🚀 Opening Gemini CLI with ${commentText}`;
      case 'clipboard':
        return `📋 Copied ${commentText} to clipboard for Gemini`;
      default:
        return `✅ Sent ${commentText} to Gemini`;
    }
  }

  getChatCommand(_config: ProviderConfig): string | null {
    // Gemini doesn't have a built-in VS Code chat command
    return null;
  }
}

/**
 * Pure helper: Get default Gemini CLI paths by platform
 */
export function getDefaultGeminiCliPath(): string | null {
  const platform = process.platform;

  switch (platform) {
    case 'darwin': // macOS
      return '/usr/local/bin/gemini';
    case 'linux':
      return '/usr/bin/gemini';
    case 'win32': // Windows
      return 'C:\\Program Files\\Gemini\\gemini.exe';
    default:
      return null;
  }
}
