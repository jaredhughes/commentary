/**
 * Payload builders for AI agent requests
 */

import * as vscode from 'vscode';
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

    try {
      const document = await vscode.workspace.openTextDocument(uri);
      fullDocument = document.getText();

      // Calculate context lines based on position
      if (note.lines) {
        const startLine = Math.max(0, note.lines.start - contextLines - 1);
        const endLine = Math.min(document.lineCount - 1, note.lines.end + contextLines);

        const beforeRange = new vscode.Range(startLine, 0, note.lines.start - 1, 0);
        const afterRange = new vscode.Range(
          note.lines.end,
          0,
          endLine,
          document.lineAt(endLine).text.length
        );

        contextBefore = document.getText(beforeRange);
        contextAfter = document.getText(afterRange);
      } else {
        // Use position-based context
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
   * Format a request as a readable prompt for the AI agent
   */
  static formatAsPrompt(request: AgentRequest): string {
    const lines = [request.instruction || 'Please review the following comments:', ''];

    for (const ctx of request.contexts) {
      lines.push('---', `Comment: ${ctx.note.text}`, '');
      lines.push('Selected text:');
      lines.push(`"${ctx.note.quote.exact}"`, '');

      if (ctx.contextBefore || ctx.contextAfter) {
        lines.push('Context:');
        if (ctx.contextBefore) {
          lines.push('```markdown');
          lines.push(ctx.contextBefore.trim());
          lines.push('```', '');
        }

        lines.push('**[Selected text appears here]**', '');

        if (ctx.contextAfter) {
          lines.push('```markdown');
          lines.push(ctx.contextAfter.trim());
          lines.push('```', '');
        }
      }

      lines.push('');
    }

    return lines.join('\n');
  }
}
