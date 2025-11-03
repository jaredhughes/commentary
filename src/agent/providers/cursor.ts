/**
 * Pure Cursor provider logic
 * No VS Code dependencies - fully testable
 */

import * as path from 'path';
import * as os from 'os';
import { AgentRequest } from '../../types';
import { ProviderStrategy, ProviderConfig, TerminalCommand } from './types';

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
    const tempFileName = `commentary-cursor-${Date.now()}.md`;
    const tempFilePath = path.join(tempDir, tempFileName);

    // Build prompt with file context
    const fileUri = firstNote.file.replace('file://', '');
    const promptWithContext = `# Commentary Review Request

File: ${fileUri}
Comments: ${request.contexts.length}

${prompt}

---
Please review the above comments and provide suggestions for improving the documentation.
`;

    return {
      command: config.cursorCliPath,
      args: [
        '--wait',  // Wait for editor to close
        tempFilePath
      ],
      workingDirectory: path.dirname(fileUri),
      env: {
        // Pass temp file path and prompt as env vars for cleanup
        COMMENTARY_TEMP_FILE: tempFilePath,
        COMMENTARY_PROMPT: promptWithContext
      }
    };
  }

  getClipboardText(
    prompt: string,
    request: AgentRequest,
    _config: ProviderConfig
  ): string {
    // For clipboard method, include clear instructions
    const commentCount = request.contexts.length;
    const fileInfo = request.contexts[0]?.note?.file || 'Unknown file';
    
    return `# Commentary Review Request (${commentCount} comment${commentCount === 1 ? '' : 's'})

File: ${fileInfo}

${prompt}

---
[Copied to clipboard - paste into Cursor chat]
`;
  }

  getSuccessMessage(
    request: AgentRequest,
    method: 'api' | 'cli' | 'clipboard' | 'chat'
  ): string {
    const count = request.contexts.length;
    const commentText = `${count} comment${count === 1 ? '' : 's'}`;

    switch (method) {
      case 'cli':
        return `?? Opening Cursor editor with ${commentText}`;
      case 'clipboard':
        return `?? Copied ${commentText} to clipboard - open Cursor chat to paste`;
      case 'chat':
        return `?? Opening Cursor chat with ${commentText}`;
      default:
        return `? Sent ${commentText} to Cursor`;
    }
  }

  getChatCommand(_config: ProviderConfig): string | null {
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
  const fileUri = firstNote?.file?.replace('file://', '') || 'Unknown file';
  
  const content = `# Commentary Review Request

File: ${fileUri}
Comments: ${request.contexts.length}

${prompt}

---
Please review the above comments and provide suggestions for improving the documentation.
`;

  const fileName = `commentary-cursor-${Date.now()}.md`;

  return { content, fileName };
}
