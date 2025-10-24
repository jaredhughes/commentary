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
import { ApiIntegration } from './apiIntegration';

export class AgentClient {
  private outputChannel: vscode.OutputChannel;
  private apiIntegration: ApiIntegration;

  constructor(private context: vscode.ExtensionContext) {
    this.outputChannel = vscode.window.createOutputChannel('Commentary Agent');
    this.apiIntegration = new ApiIntegration(context);
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

    // FIRST: Try direct API integration (Claude API)
    if (provider === 'claude' && this.apiIntegration.isAvailable()) {
      const success = await this.apiIntegration.sendAndApply(request, prompt);
      if (success) {
        return this.mockAgentResponse(request);
      }
      // If API fails, fall through to CLI/clipboard methods
    }

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
      // Get configured Claude command
      const config = vscode.workspace.getConfiguration('commentary.agent');
      const claudeCommand = config.get<string>('claudeCommand', 'claude');

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

      // Execute: cat prompt.md | <claude-command> --output-file original.md
      // This will send the prompt to Claude and save the response back to the original file
      const command = `cat "${tempPromptPath}" | ${claudeCommand} --output-file "${filePath}"`;

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
   * Send prompt via Cursor chat (opens chat directly with prompt)
   */
  private async sendViaCursorCLI(prompt: string, request: AgentRequest): Promise<boolean> {
    try {
      // Copy to clipboard first
      await vscode.env.clipboard.writeText(prompt);

      const commentCount = request.contexts.length;

      // Try to find and execute Cursor chat command
      const commands = await vscode.commands.getCommands();

      // Look for Cursor-specific chat commands (in order of preference)
      const chatCommandPatterns = [
        'aichat.newchataction',
        'aichat.openaichat',
        'workbench.action.chat.open',
        'workbench.action.quickchat.toggle'
      ];

      let chatOpened = false;

      for (const pattern of chatCommandPatterns) {
        const matchingCommand = commands.find(cmd =>
          cmd === pattern || cmd.includes(pattern)
        );

        if (matchingCommand) {
          try {
            await vscode.commands.executeCommand(matchingCommand);
            chatOpened = true;
            console.log('[Commentary] Opened Cursor chat with command:', matchingCommand);
            break;
          } catch (error) {
            console.log('[Commentary] Failed to execute command:', matchingCommand, error);
          }
        }
      }

      if (chatOpened) {
        // Give chat a moment to fully open and focus
        await new Promise(resolve => setTimeout(resolve, 100));

        // Try to focus the input field (this may or may not work depending on Cursor's implementation)
        try {
          await vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
        } catch (error) {
          // Silently fail - not critical
        }

        // Show brief status bar message instead of intrusive notification
        vscode.window.setStatusBarMessage(
          `$(comment-discussion) Chat ready - paste (⌘V) to send ${commentCount} comment${commentCount > 1 ? 's' : ''}`,
          5000
        );
      } else {
        // Fallback: show status bar message with manual instruction
        vscode.window.setStatusBarMessage(
          `$(clippy) Prompt copied - open Cursor chat (⌘L) and paste`,
          5000
        );
      }

      return true;
    } catch (error) {
      console.error('Failed to prepare prompt for Cursor:', error);
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
