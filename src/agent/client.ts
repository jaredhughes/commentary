/**
 * AI Agent client (provider-agnostic)
 * MVP: Logs to output channel, shows formatted prompt to user
 */

import * as vscode from 'vscode';
import { Note, AgentRequest, AgentResponse } from '../types';
import { PayloadBuilder } from './payload';

export class AgentClient {
  private outputChannel: vscode.OutputChannel;

  constructor(private context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Commentary Agent');
  }

  /**
   * Send a single comment to the agent
   */
  async sendSingleComment(note: Note): Promise<void> {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
      vscode.window.showWarningMessage('AI agent integration is disabled in settings');
      return;
    }

    try {
      const request = await PayloadBuilder.buildSingleRequest(note);
      await this.sendRequest(request);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send comment to agent: ${error}`);
    }
  }

  /**
   * Send multiple comments to the agent
   */
  async sendMultipleComments(notes: Note[]): Promise<void> {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
      vscode.window.showWarningMessage('AI agent integration is disabled in settings');
      return;
    }

    if (notes.length === 0) {
      vscode.window.showInformationMessage('No comments to send');
      return;
    }

    try {
      const request = await PayloadBuilder.buildMultipleRequest(notes);
      await this.sendRequest(request);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send comments to agent: ${error}`);
    }
  }

  /**
   * Send request to agent (MVP: show in output panel and copy to clipboard)
   */
  private async sendRequest(request: AgentRequest): Promise<AgentResponse | void> {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const provider = config.get<string>('provider', 'claude');

    // Format as prompt
    const prompt = PayloadBuilder.formatAsPrompt(request);

    // Log to output channel
    this.outputChannel.clear();
    this.outputChannel.appendLine('=== Commentary Agent Request ===');
    this.outputChannel.appendLine('');
    this.outputChannel.appendLine(prompt);
    this.outputChannel.appendLine('');
    this.outputChannel.appendLine('=== End Request ===');
    this.outputChannel.show();

    // Copy to clipboard
    await vscode.env.clipboard.writeText(prompt);

    // Show notification
    const action = await vscode.window.showInformationMessage(
      `Request copied to clipboard and logged to output (${request.contexts.length} comment(s))`,
      'Open Output',
      'OK'
    );

    if (action === 'Open Output') {
      this.outputChannel.show();
    }

    // TODO: In future versions, actually send HTTP request to agent API
    // For now, this MVP implementation just prepares and displays the prompt
    return this.mockAgentResponse(request);
  }

  /**
   * Mock agent response (for future implementation)
   */
  private mockAgentResponse(request: AgentRequest): AgentResponse {
    return {
      suggestions: request.contexts.map((ctx) => ({
        noteId: ctx.note.id,
        suggestion: 'Agent integration coming soon. Request has been logged.',
      })),
    };
  }

  dispose(): void {
    this.outputChannel.dispose();
  }
}
