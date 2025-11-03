/**
 * Direct API integration with Claude
 * Automatically sends prompts and applies edits to documents
 */

import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { AgentRequest } from '../types';

export class ApiIntegration {
  private anthropic: Anthropic | null = null;

  constructor(private context: vscode.ExtensionContext) {}

  /**
   * Initialize Anthropic client with API key
   */
  private getAnthropicClient(): Anthropic | null {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const apiKey = config.get<string>('apiKey') || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      vscode.window.showErrorMessage(
        'Anthropic API key not configured. Set it in settings or ANTHROPIC_API_KEY environment variable.'
      );
      return null;
    }

    if (!this.anthropic) {
      this.anthropic = new Anthropic({ apiKey });
    }

    return this.anthropic;
  }

  /**
   * Send request to Claude API and apply edits to document
   */
  async sendAndApply(request: AgentRequest, prompt: string): Promise<boolean> {
    const client = this.getAnthropicClient();
    if (!client) {
      return false;
    }

    const config = vscode.workspace.getConfiguration('commentary.agent');
    const model = config.get<string>('model', 'claude-3-5-sonnet-20241022');

    try {
      // Get the first note to identify the file
      const firstNote = request.contexts[0]?.note;
      if (!firstNote) {
        vscode.window.showErrorMessage('No comment found to process');
        return false;
      }

      const fileUri = vscode.Uri.parse(firstNote.file);

      // Show progress
      return await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: 'Commentary',
          cancellable: false,
        },
        async (progress) => {
          progress.report({ message: 'Sending to Claude...' });

          // Read current document content
          const document = await vscode.workspace.openTextDocument(fileUri);
          const originalContent = document.getText();

          // Build the full prompt with instructions to return complete file
          const fullPrompt = `${prompt}

IMPORTANT: You must respond with ONLY the complete updated markdown file content. Do not include any explanations, markdown code fences, or other text. Just the raw markdown content that should replace the file.

Current file content:
${originalContent}`;

          // Call Claude API
          const requestParams: Anthropic.MessageCreateParams = {
            model: model,
            max_tokens: 8000,
            messages: [
              {
                role: 'user',
                content: fullPrompt,
              },
            ],
          };
          const response = await client.messages.create(requestParams);

          progress.report({ message: 'Applying edits...' });

          // Extract response text
          const responseText = response.content
            .filter((block) => block.type === 'text')
            .map((block) => (block as { type: 'text'; text: string }).text)
            .join('\n');

          // Apply edits to document
          const edit = new vscode.WorkspaceEdit();
          const fullRange = new vscode.Range(
            document.positionAt(0),
            document.positionAt(originalContent.length)
          );
          edit.replace(fileUri, fullRange, responseText);

          const success = await vscode.workspace.applyEdit(edit);

          if (success) {
            // Save the document
            await document.save();

            vscode.window.showInformationMessage(
              `✅ Claude has updated your document!`
            );
            return true;
          } else {
            vscode.window.showErrorMessage('Failed to apply Claude\'s edits');
            return false;
          }
        }
      );
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Claude API error: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Check if direct API integration is available
   */
  isAvailable(): boolean {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const apiKey = config.get<string>('apiKey') || process.env.ANTHROPIC_API_KEY;
    return !!apiKey;
  }
}
