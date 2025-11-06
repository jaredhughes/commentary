/**
 * AI Agent client (provider-agnostic)
 * Thin wrapper around ProviderAdapter - handles high-level orchestration
 */

import * as vscode from 'vscode';
import { Note, AgentRequest, AgentResponse } from '../types';
import { PayloadBuilder } from './payload';
import { ProviderAdapter } from './providerAdapter';
import { ApiIntegration } from './apiIntegration';

export class AgentClient {
  private outputChannel: vscode.OutputChannel;
  private adapter: ProviderAdapter;
  private apiIntegration: ApiIntegration;

  constructor(
    private context: vscode.ExtensionContext,
    adapter?: ProviderAdapter
  ) {
    this.outputChannel = vscode.window.createOutputChannel('Commentary Agent');
    this.adapter = adapter || new ProviderAdapter(context);
    this.apiIntegration = new ApiIntegration(context);
  }

  /**
   * Send a single comment to the agent
   * @returns The method used (cli, api, clipboard, chat) or undefined if failed
   */
  async sendSingleComment(note: Note): Promise<'cli' | 'api' | 'clipboard' | 'chat' | undefined> {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
      vscode.window.showWarningMessage('AI agent integration is disabled in settings');
      return undefined;
    }

    try {
      const request = await PayloadBuilder.buildSingleRequest(note);
      return await this.sendRequest(request);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send comment to agent: ${error}`);
      return undefined;
    }
  }

  /**
   * Send multiple comments to the agent
   * Returns the method used for conditional deletion
   */
  async sendMultipleComments(notes: Note[]): Promise<'cli' | 'api' | 'clipboard' | 'chat' | undefined> {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const enabled = config.get<boolean>('enabled', true);

    if (!enabled) {
      vscode.window.showWarningMessage('AI agent integration is disabled in settings');
      return undefined;
    }

    if (notes.length === 0) {
      vscode.window.showInformationMessage('No comments to send');
      return undefined;
    }

    try {
      const request = await PayloadBuilder.buildMultipleRequest(notes);
      return await this.sendRequest(request);
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send comments to agent: ${error}`);
      return undefined;
    }
  }

  /**
   * Send request to agent using new provider adapter
   * @returns The method used (cli, api, clipboard, chat) or undefined if failed
   */
  private async sendRequest(request: AgentRequest): Promise<'cli' | 'api' | 'clipboard' | 'chat' | undefined> {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const provider = config.get<string>('provider', 'cursor');

    // Format as prompt
    const prompt = PayloadBuilder.formatAsPrompt(request);

    // Log to output channel for debugging
    this.outputChannel.clear();
    this.outputChannel.appendLine(`=== Commentary Request (${provider}) ===`);
    this.outputChannel.appendLine(prompt);

    try {
      // FIRST: Try direct API integration (Claude API only for now)
      if (provider === 'claude' && this.apiIntegration.isAvailable()) {
        const success = await this.apiIntegration.sendAndApply(request, prompt);
        if (success) {
          return 'api'; // API method was used
        }
        // If API fails, fall through to adapter
      }

      // Use the new provider adapter for all provider methods
      const result = await this.adapter.send(prompt, request);

      if (result.success) {
        return result.method; // Return the method that was used
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to send to agent: ${error}`);
      this.outputChannel.show();
      throw error;
    }
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
    this.adapter.dispose();
  }
}
