/**
 * AI Agent client (provider-agnostic)
 * MVP: Logs to output channel, shows formatted prompt to user
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
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
   * Get human-friendly provider name
   */
  private getProviderDisplayName(provider: string): string {
    switch (provider) {
      case 'claude':
        return 'Claude';
      case 'cursor':
        return 'Cursor';
      case 'openai':
        return 'OpenAI';
      case 'custom':
        return 'AI Agent';
      default:
        return 'AI Agent';
    }
  }

  /**
   * Send request to agent
   */
  private async sendRequest(request: AgentRequest): Promise<AgentResponse | void> {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    const provider = config.get<string>('provider', 'claude');
    const providerName = this.getProviderDisplayName(provider);

    // Format as prompt
    const prompt = PayloadBuilder.formatAsPrompt(request);

    // Try to send via Claude CLI in terminal
    if (provider === 'claude') {
      const usedCLI = await this.sendViaClaudeCLI(prompt, request);
      if (usedCLI) {
        return this.mockAgentResponse(request);
      }
    }

    // Try to send via Cursor CLI in terminal
    if (provider === 'cursor') {
      const usedCLI = await this.sendViaCursorCLI(prompt, request);
      if (usedCLI) {
        return this.mockAgentResponse(request);
      }
    }

    // Fallback: Log to output channel and copy to clipboard
    this.outputChannel.clear();
    this.outputChannel.appendLine(`=== Commentary ${providerName} Request ===`);
    this.outputChannel.appendLine('');
    this.outputChannel.appendLine(prompt);
    this.outputChannel.appendLine('');
    this.outputChannel.appendLine('=== End Request ===');
    this.outputChannel.show();

    // Copy to clipboard
    await vscode.env.clipboard.writeText(prompt);

    // Show clearer instructions for next steps
    const action = await vscode.window.showInformationMessage(
      `📋 Prompt copied to clipboard! Paste it into ${providerName}.`,
      'View Full Prompt',
      'Got it'
    );

    if (action === 'View Full Prompt') {
      this.outputChannel.show();
    }

    return this.mockAgentResponse(request);
  }

  /**
   * Send prompt via Claude CLI in integrated terminal
   */
  private async sendViaClaudeCLI(prompt: string, request: AgentRequest): Promise<boolean> {
    try {
      // Check if claude CLI is available
      const terminal = vscode.window.createTerminal({
        name: 'Commentary → Claude',
        hideFromUser: false,
      });

      terminal.show();

      // Get the file being commented on
      const firstNote = request.contexts[0]?.note;
      if (!firstNote) {
        return false;
      }

      const fileUri = vscode.Uri.parse(firstNote.file);
      const filePath = fileUri.fsPath;

      // Create a temporary file with the prompt
      const tempPromptPath = path.join(
        os.tmpdir(),
        `commentary-prompt-${Date.now()}.md`
      );

      fs.writeFileSync(tempPromptPath, prompt);

      // Execute: cat prompt.md | claude --output-file original.md
      // This will send the prompt to Claude and save the response back to the original file
      const command = `cat "${tempPromptPath}" | claude --output-file "${filePath}"`;

      terminal.sendText(command);

      vscode.window.showInformationMessage(
        `🤖 Sending ${request.contexts.length} comment(s) to Claude CLI...`,
        'View Terminal'
      ).then((action) => {
        if (action === 'View Terminal') {
          terminal.show();
        }
      });

      // Clean up temp file after a delay
      setTimeout(() => {
        try {
          fs.unlinkSync(tempPromptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 5000);

      return true;
    } catch (error) {
      console.error('Failed to use Claude CLI:', error);
      return false;
    }
  }

  /**
   * Send prompt via Cursor CLI in integrated terminal
   */
  private async sendViaCursorCLI(prompt: string, request: AgentRequest): Promise<boolean> {
    try {
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const cliPath = config.get<string>('cursorCliPath', 'cursor-agent');
      const interactive = config.get<boolean>('cursorInteractive', true);
      const model = config.get<string>('model', 'claude-3-5-sonnet-20241022');

      // Create terminal
      const terminal = vscode.window.createTerminal({
        name: 'Commentary → Cursor',
        hideFromUser: false,
      });

      terminal.show();

      // Get the file being commented on
      const firstNote = request.contexts[0]?.note;
      if (!firstNote) {
        return false;
      }

      // Create a temporary file with the prompt
      const tempPromptPath = path.join(
        os.tmpdir(),
        `commentary-prompt-${Date.now()}.md`
      );

      fs.writeFileSync(tempPromptPath, prompt);

      // Build the Cursor command
      let command: string;
      if (interactive) {
        // Interactive mode: pipe prompt and allow conversational response
        command = `cat "${tempPromptPath}" | ${cliPath} --model ${model}`;
      } else {
        // Non-interactive mode: run the prompt and exit
        command = `${cliPath} -p "$(cat '${tempPromptPath}')" --model ${model} --no-interactive`;
      }

      terminal.sendText(command);

      vscode.window.showInformationMessage(
        `🤖 Sending ${request.contexts.length} comment(s) to Cursor Agent...`,
        'View Terminal'
      ).then((action) => {
        if (action === 'View Terminal') {
          terminal.show();
        }
      });

      // Clean up temp file after a delay
      setTimeout(() => {
        try {
          fs.unlinkSync(tempPromptPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 5000);

      return true;
    } catch (error) {
      console.error('Failed to use Cursor CLI:', error);
      return false;
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
  }
}
