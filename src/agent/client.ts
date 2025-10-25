/**
 * AI Agent client (provider-agnostic)
 * MVP: Logs to output channel, shows formatted prompt to user
 */

import * as vscode from 'vscode';
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

      // Look for existing Commentary → Claude terminal
      const existingTerminal = vscode.window.terminals.find(
        t => t.name === 'Commentary → Claude'
      );

      let terminal: vscode.Terminal;
      let isReusedTerminal = false;

      if (existingTerminal) {
        terminal = existingTerminal;
        isReusedTerminal = true;
        console.log('[Commentary] Reusing existing Claude terminal');

        // Interrupt any running Claude session cleanly
        terminal.sendText('\x03'); // Send Ctrl+C

        // Wait a moment for the interrupt to process
        await new Promise(resolve => setTimeout(resolve, 300));

        // Clear the terminal for a clean slate
        terminal.sendText('clear');

        // Wait for clear to complete
        await new Promise(resolve => setTimeout(resolve, 100));
      } else {
        terminal = vscode.window.createTerminal({
          name: 'Commentary → Claude',
          hideFromUser: false,
        });
        console.log('[Commentary] Created new Claude terminal');
      }

      terminal.show();

      // Get the file being commented on
      const firstNote = request.contexts[0]?.note;
      if (!firstNote) {
        return false;
      }

      const fileUri = vscode.Uri.parse(firstNote.file);
      const filePath = fileUri.fsPath;

      // Build the prompt with file context
      const promptWithFile = `I have comments on the file: ${filePath}\n\n${prompt}\n\nPlease review the comments and suggest edits.`;

      // Copy prompt to clipboard
      await vscode.env.clipboard.writeText(promptWithFile);

      // Launch Claude Code interactively with the file
      // Don't pipe content - causes "Raw mode not supported" error with Ink UI
      terminal.sendText(`${claudeCommand} ${filePath}`);

      const terminalStatus = isReusedTerminal ? '(reusing terminal)' : '(new terminal)';
      vscode.window.showInformationMessage(
        `📋 Prompt copied! Claude Code opening ${terminalStatus} - paste to send ${request.contexts.length} comment(s)`,
        'View Terminal'
      ).then((action) => {
        if (action === 'View Terminal') {
          terminal.show();
        }
      });

      // No longer using temp file, so no cleanup needed

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
