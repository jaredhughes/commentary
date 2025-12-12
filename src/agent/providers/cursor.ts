/**
 * Pure Cursor provider logic
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
  buildCliPrompt
} from './types';

export class CursorProvider implements ProviderStrategy {
  canUse(config: ProviderConfig): boolean {
    return config.provider === 'cursor' && !!config.cursorCliPath;
  }

  getPreferredMethod(config: ProviderConfig): 'api' | 'cli' | 'clipboard' | 'chat' {
    // If CLI path is configured and interactive mode is enabled, use CLI
    if (config.cursorCliPath && config.cursorInteractive) {
      return 'cli';
    }
    
    // Otherwise fallback to clipboard + chat
    return 'clipboard';
  }

  buildTerminalCommand(
    prompt: string,
    request: AgentRequest,
    config: ProviderConfig
  ): TerminalCommand | null {
    if (!config.cursorCliPath) {
      return null;
    }

    // Get the file being commented on for context
    const firstNote = request.contexts[0]?.note;
    if (!firstNote) {
      return null;
    }

    // Create a temp file with the prompt (similar to Claude approach)
    const tempDir = os.tmpdir();
    const uuid = randomUUID().split('-')[0]; // Use first segment for shorter filename
    const tempFileName = `commentary-cursor-${uuid}.md`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // Build prompt with file context
    const fileUri = firstNote.file.replace('file://', '');
    const fileName = extractFileName(firstNote.file);

    const promptWithContext = buildCliPrompt({
      providerName: 'Commentary',
      fileName,
      commentCount: request.contexts.length,
      prompt,
      footerText: 'Review the ENTIRE document and address the comments. Look for related changes throughout the document that would improve consistency or address similar issues. Don\'t just fix the specific commented sections—consider the broader document context and apply comprehensive improvements.'
    });

    // Interactive mode - session stays open after processing the file
    // File path argument provides initial prompt, then user can continue editing
    return {
      command: config.cursorCliPath,
      args: [tempFilePath],
      workingDirectory: path.dirname(fileUri),
      env: {
        // Pass temp file path and prompt as env vars for cleanup
        commentaryTempFile: tempFilePath,
        commentaryPrompt: promptWithContext
      }
    };
  }

  getClipboardText(
    prompt: string,
    request: AgentRequest
  ): string {
    const fileUri = request.contexts[0]?.note?.file || 'Unknown file';
    const fileName = extractFileName(fileUri);

    return buildClipboardPrompt({
      providerName: 'Commentary',
      fileName,
      commentCount: request.contexts.length,
      prompt,
      footerText: '[Copied to clipboard - paste into Cursor chat]'
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
        return `🚀 Opening Cursor editor with ${commentText}`;
      case 'clipboard':
        return `📋 Copied ${commentText} to clipboard - open Cursor chat to paste`;
      case 'chat':
        return `💬 Opening Cursor chat with ${commentText}`;
      default:
        return `✅ Sent ${commentText} to Cursor`;
    }
  }

  getChatCommand(): string | null {
    // Cursor chat commands (in order of preference)
    // We return the first one to try - the adapter will try alternatives
    return 'aichat.newchataction';
  }
}

/**
 * Pure helper: Get alternative chat commands to try
 */
export function getCursorChatCommands(): string[] {
  return [
    'aichat.newchataction',
    'aichat.openaichat',
    'workbench.action.chat.open',
    'workbench.action.quickchat.toggle'
  ];
}

/**
 * Pure helper: Build temp file content for Cursor CLI
 */
export function buildCursorTempFileContent(
  prompt: string,
  request: AgentRequest
): { content: string; fileName: string } {
  const firstNote = request.contexts[0]?.note;
  const cleanFileName = extractFileName(firstNote?.file || 'Unknown file');

  const content = buildCliPrompt({
    providerName: 'Commentary',
    fileName: cleanFileName,
    commentCount: request.contexts.length,
    prompt,
    footerText: 'Review the ENTIRE document and address the comments. Look for related changes throughout the document that would improve consistency or address similar issues. Apply comprehensive improvements.'
  });

  const uuid = randomUUID().split('-')[0]; // Use first segment for shorter filename
  const fileName = `commentary-cursor-${uuid}.md`;

  return { content, fileName };
}
