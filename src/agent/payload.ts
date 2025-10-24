/**
 * Payload builders for AI agent requests
 */

import * as vscode from 'vscode';
import * as os from 'os';
import { Note, AgentContext, AgentRequest } from '../types';

export class PayloadBuilder {
  /**
   * Build context for a single note
   */
  static async buildContext(note: Note): Promise<AgentContext> {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const contextLines = config.get<number>('contextLines', 6);

    // Get the document
    const uri = vscode.Uri.parse(note.file);
    let contextBefore = '';
    let contextAfter = '';
    let fullDocument: string | undefined;
    let calculatedLines: { start: number; end: number } | undefined;

    try {
      const document = await vscode.workspace.openTextDocument(uri);
      fullDocument = document.getText();

      // If we don't have line numbers, calculate them by finding the exact quote
      if (!note.lines && note.quote.exact) {
        const text = document.getText();
        const quoteIndex = text.indexOf(note.quote.exact);
        if (quoteIndex !== -1) {
          const startPos = document.positionAt(quoteIndex);
          const endPos = document.positionAt(quoteIndex + note.quote.exact.length);
          calculatedLines = {
            start: startPos.line + 1, // 1-indexed for display
            end: endPos.line + 1,
          };
        }
      }

      // Use existing or calculated line numbers
      const lines = note.lines || calculatedLines;

      // Calculate context lines based on position
      if (lines) {
        const startLine = Math.max(0, lines.start - contextLines - 1);
        const endLine = Math.min(document.lineCount - 1, lines.end + contextLines);

        const beforeRange = new vscode.Range(startLine, 0, lines.start - 1, 0);
        const afterRange = new vscode.Range(
          lines.end,
          0,
          endLine,
          document.lineAt(Math.min(endLine, document.lineCount - 1)).text.length
        );

        contextBefore = document.getText(beforeRange);
        contextAfter = document.getText(afterRange);

        // Update the note with calculated lines if they weren't there
        if (!note.lines && calculatedLines) {
          note.lines = calculatedLines;
        }
      } else {
        // Fallback: Use position-based context
        const beforePos = Math.max(0, note.position.start - 200);
        const afterPos = Math.min(fullDocument.length, note.position.end + 200);

        contextBefore = fullDocument.substring(beforePos, note.position.start);
        contextAfter = fullDocument.substring(note.position.end, afterPos);
      }
    } catch (error) {
      console.error('Failed to read document for context:', error);
    }

    return {
      note,
      contextBefore,
      contextAfter,
      fullDocument,
    };
  }

  /**
   * Build request for single comment
   */
  static async buildSingleRequest(note: Note): Promise<AgentRequest> {
    const context = await this.buildContext(note);
    return {
      contexts: [context],
      instruction: 'Review this comment and provide suggestions for improvement.',
    };
  }

  /**
   * Build request for multiple comments
   */
  static async buildMultipleRequest(notes: Note[]): Promise<AgentRequest> {
    const contexts = await Promise.all(notes.map((note) => this.buildContext(note)));

    return {
      contexts,
      instruction:
        'Review these comments and provide suggestions for addressing all of them.',
    };
  }

  /**
   * Get human-readable filename from URI
   */
  private static getFilename(fileUri: string): string {
    try {
      const uri = vscode.Uri.parse(fileUri);
      const pathParts = uri.fsPath.split('/');
      return pathParts[pathParts.length - 1];
    } catch {
      return fileUri;
    }
  }

  /**
   * Get workspace-relative or home-relative path
   */
  private static getRelativePath(fileUri: string): string {
    try {
      const uri = vscode.Uri.parse(fileUri);

      // Try workspace-relative first
      const workspaceRelative = vscode.workspace.asRelativePath(uri, false);
      if (workspaceRelative !== uri.fsPath) {
        return workspaceRelative;
      }

      // Fall back to home-relative
      const homeDir = os.homedir();
      if (uri.fsPath.startsWith(homeDir)) {
        return '~' + uri.fsPath.substring(homeDir.length);
      }

      return uri.fsPath;
    } catch {
      return fileUri;
    }
  }

  /**
   * Get absolute file path from URI
   */
  private static getAbsolutePath(fileUri: string): string {
    try {
      const uri = vscode.Uri.parse(fileUri);
      return uri.fsPath;
    } catch {
      return fileUri;
    }
  }

  /**
   * Format a request as a readable prompt for the AI agent
   */
  static formatAsPrompt(request: AgentRequest): string {
    const lines = [request.instruction || 'Please review the following comments:', ''];

    for (const ctx of request.contexts) {
      const filename = this.getFilename(ctx.note.file);
      const filepath = this.getRelativePath(ctx.note.file);
      const absolutePath = this.getAbsolutePath(ctx.note.file);

      lines.push('---');
      lines.push(`**File:** \`${filepath}\``);
      lines.push(`**Absolute Path:** \`${absolutePath}\``);

      // Document-level comment handling
      if (ctx.note.isDocumentLevel) {
        lines.push('**Scope:** Entire document');
        lines.push('');
        lines.push(`**Comment:** ${ctx.note.text}`);
        lines.push('');

        // For document-level comments, include the full document
        if (ctx.fullDocument) {
          lines.push('**Full Document:**');
          lines.push('```markdown');
          lines.push(ctx.fullDocument);
          lines.push('```');
          lines.push('');
        }
      } else {
        // Regular text-selection comment
        // Add line number if available
        if (ctx.note.lines) {
          if (ctx.note.lines.start === ctx.note.lines.end) {
            lines.push(`**Line:** ${ctx.note.lines.start}`);
          } else {
            lines.push(`**Lines:** ${ctx.note.lines.start}–${ctx.note.lines.end}`);
          }
        } else {
          lines.push(`**Position:** ${ctx.note.position.start}–${ctx.note.position.end}`);
        }

        lines.push('');
        lines.push(`**Comment:** ${ctx.note.text}`);
        lines.push('');
        lines.push('**Selected text:**');
        lines.push(`"${ctx.note.quote.exact}"`);
        lines.push('');

        if (ctx.contextBefore || ctx.contextAfter) {
          lines.push('**Context:**');
          lines.push('');
          if (ctx.contextBefore) {
            lines.push('```markdown');
            lines.push(ctx.contextBefore.trim());
            lines.push('```');
            lines.push('');
          }

          lines.push('**[Selected text appears here]**');
          lines.push('');

          if (ctx.contextAfter) {
            lines.push('```markdown');
            lines.push(ctx.contextAfter.trim());
            lines.push('```');
            lines.push('');
          }
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}
