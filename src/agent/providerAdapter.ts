/**
 * Thin adapter layer between pure provider logic and VS Code APIs
 * Handles all VS Code integration (terminal, clipboard, notifications, etc.)
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { AgentRequest } from '../types';
import { 
  ProviderStrategy, 
  ProviderConfig, 
  TerminalCommand,
  SendResult,
  getProviderDisplayName
} from './providers/types';
import { ClaudeProvider } from './providers/claude';
import { CursorProvider, getCursorChatCommands } from './providers/cursor';
import { OpenAIProvider } from './providers/openai';

/**
 * Adapter that bridges pure provider logic with VS Code APIs
 */
export class ProviderAdapter {
  private providers: Map<string, ProviderStrategy>;
  private terminals: Map<string, vscode.Terminal>;
  private terminalCounter: number;

  constructor(private context: vscode.ExtensionContext) {
    this.providers = new Map();
    this.terminals = new Map();
    this.terminalCounter = 0;

    // Register all providers
    this.providers.set('claude', new ClaudeProvider());
    this.providers.set('cursor', new CursorProvider());
    this.providers.set('openai', new OpenAIProvider());
  }

  /**
   * Get provider configuration from VS Code settings
   */
  private getConfig(): ProviderConfig {
    const config = vscode.workspace.getConfiguration('commentary.agent');
    
    return {
      provider: config.get<'claude' | 'cursor' | 'openai' | 'vscode' | 'custom'>('provider', 'cursor'),
      enabled: config.get<boolean>('enabled', true),
      model: config.get<string>('model'),

      // Claude
      claudeApiKey: config.get<string>('claudeApiKey'),
      claudeCliPath: config.get<string>('claudeCliPath', 'claude'),

      // Cursor
      cursorCliPath: config.get<string>('cursorCliPath'), // No default - must be explicitly configured
      cursorInteractive: config.get<boolean>('cursorInteractive', true),

      // OpenAI
      openaiApiKey: config.get<string>('openaiApiKey'),
      openaiModel: config.get<string>('openaiModel', 'gpt-4'),

      // Custom
      customEndpoint: config.get<string>('customEndpoint'),
      customApiKey: config.get<string>('customApiKey')
    };
  }

  /**
   * Send request using appropriate provider
   */
  async send(prompt: string, request: AgentRequest): Promise<SendResult> {
    const config = this.getConfig();
    
    if (!config.enabled) {
      throw new Error('Agent integration is disabled in settings');
    }

    const provider = this.providers.get(config.provider);
    if (!provider) {
      throw new Error(`Unknown provider: ${config.provider}`);
    }

    if (!provider.canUse(config)) {
      throw new Error(`Provider ${config.provider} is not properly configured`);
    }

    const method = provider.getPreferredMethod(config);
    const providerName = getProviderDisplayName(config.provider);

    try {
      switch (method) {
        case 'cli':
          return await this.sendViaCli(provider, prompt, request, config, providerName);
        
        case 'clipboard':
          return await this.sendViaClipboard(provider, prompt, request, config, providerName);
        
        case 'chat':
          return await this.sendViaChat(provider, prompt, request, config, providerName);
        
        case 'api':
          return await this.sendViaApi(provider, prompt, request, config, providerName);
        
        default:
          throw new Error(`Unsupported method: ${method}`);
      }
    } catch (error) {
      return {
        success: false,
        method,
        message: `Failed to send to ${providerName}: ${error}`
      };
    }
  }

  /**
   * Send via CLI (terminal)
   */
  private async sendViaCli(
    provider: ProviderStrategy,
    prompt: string,
    request: AgentRequest,
    config: ProviderConfig,
    providerName: string
  ): Promise<SendResult> {
    const command = provider.buildTerminalCommand(prompt, request, config);
    if (!command) {
      throw new Error('Failed to build terminal command');
    }

    // Write temp file if needed
    if (command.env?.commentaryTempFile && command.env?.commentaryPrompt) {
      fs.writeFileSync(command.env.commentaryTempFile, command.env.commentaryPrompt, 'utf-8');
    }

    // Get or create terminal
    const terminal = await this.getOrCreateTerminal(config.provider, providerName);
    
    // Execute command (this will show the terminal after sending the command)
    await this.executeTerminalCommand(terminal, command);

    // Show success message (don't await - let progress dismiss immediately)
    const message = provider.getSuccessMessage(request, 'cli');
    // Terminal is already shown by executeTerminalCommand, so just show the message
    vscode.window.showInformationMessage(message);

    // Schedule cleanup of temp file
    if (command.env?.commentaryTempFile) {
      this.scheduleCleanup(command.env.commentaryTempFile);
    }

    return {
      success: true,
      method: 'cli',
      message,
      command
    };
  }

  /**
   * Send via clipboard
   */
  private async sendViaClipboard(
    provider: ProviderStrategy,
    prompt: string,
    request: AgentRequest,
    config: ProviderConfig,
    _providerName: string
  ): Promise<SendResult> {
    const text = provider.getClipboardText(prompt, request, config);
    await vscode.env.clipboard.writeText(text);

    // Try to open chat if provider supports it
    const chatCommand = provider.getChatCommand(config);
    if (chatCommand) {
      await this.tryOpenChat(chatCommand, config.provider);
    }

    const message = provider.getSuccessMessage(request, 'clipboard');
    vscode.window.showInformationMessage(message);

    return {
      success: true,
      method: 'clipboard',
      message,
      clipboardText: text
    };
  }

  /**
   * Send via chat (VS Code command)
   */
  private async sendViaChat(
    provider: ProviderStrategy,
    prompt: string,
    request: AgentRequest,
    config: ProviderConfig,
    _providerName: string
  ): Promise<SendResult> {
    // Copy to clipboard first
    const text = provider.getClipboardText(prompt, request, config);
    await vscode.env.clipboard.writeText(text);

    // Open chat
    const chatCommand = provider.getChatCommand(config);
    if (chatCommand) {
      await this.tryOpenChat(chatCommand, config.provider);
    }

    const message = provider.getSuccessMessage(request, 'chat');
    vscode.window.showInformationMessage(message);

    return {
      success: true,
      method: 'chat',
      message,
      clipboardText: text
    };
  }

  /**
   * Send via API (future implementation)
   */
  private async sendViaApi(
    provider: ProviderStrategy,
    prompt: string,
    request: AgentRequest,
    config: ProviderConfig,
    providerName: string
  ): Promise<SendResult> {
    try {
      // Call the provider's API method if it exists
      let response: string | undefined;

      if (provider instanceof OpenAIProvider) {
        response = await provider.callApi(prompt, config);
      }
      // Add Claude API support here in future
      // else if (provider instanceof ClaudeProvider) {
      //   response = await provider.callApi(prompt, config);
      // }

      if (response) {
        // Show response in output channel
        const outputChannel = vscode.window.createOutputChannel(`Commentary → ${providerName} Response (Preview)`);
        outputChannel.clear();
        outputChannel.appendLine(`=== ${providerName} AI Response (Manual Application Required) ===\n`);
        outputChannel.appendLine(`📝 Review the response below and manually apply changes to your document.\n`);
        outputChannel.appendLine(`⚠️  Unlike CLI tools (Claude Code, Cursor Agent), API responses do not auto-edit files.\n`);
        outputChannel.appendLine(`---\n`);
        outputChannel.appendLine(response);
        outputChannel.show(true);
      }

      const message = provider.getSuccessMessage(request, 'api');
      vscode.window.showInformationMessage(message, 'View Response').then((action) => {
        if (action === 'View Response' && response) {
          // Re-show output channel if user clicks button
          const outputChannel = vscode.window.createOutputChannel(`Commentary → ${providerName} Response (Preview)`);
          outputChannel.show(true);
        }
      });

      return {
        success: true,
        method: 'api',
        message
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`${providerName} API error: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Create a new terminal for each command
   * Multiple commands can run in parallel without interfering
   */
  private async getOrCreateTerminal(providerId: string, providerName: string): Promise<vscode.Terminal> {
    // Increment counter for unique terminal ID
    this.terminalCounter++;
    const terminalId = `${providerId}-${this.terminalCounter}`;
    const terminalName = `Commentary → ${providerName} #${this.terminalCounter}`;

    // Create a new terminal with explicit name
    // Use shellPath to ensure proper terminal initialization
    // Determine shell path based on platform
    const getShellPath = (): string | undefined => {
      if (process.env.SHELL) {
        return process.env.SHELL;
      }
      // Let VS Code use its default shell on Windows
      if (process.platform === 'win32') {
        return undefined; // VS Code will use default
      }
      // Unix-like systems: prefer zsh, fall back to bash
      return '/bin/zsh';
    };

    const terminal = vscode.window.createTerminal({
      name: terminalName,
      hideFromUser: false,
      shellPath: getShellPath()
    });

    this.terminals.set(terminalId, terminal);
    
    // Ensure terminal name is set (sometimes needs to be set after creation)
    if (terminal.name !== terminalName) {
      // Terminal name should be set via createTerminal options, but log if it's not
      console.log(`[ProviderAdapter] Terminal created but name mismatch. Expected: ${terminalName}, Got: ${terminal.name || 'undefined'}`);
    }
    
    return terminal;
  }

  /**
   * Execute command in terminal
   */
  private async executeTerminalCommand(terminal: vscode.Terminal, command: TerminalCommand): Promise<void> {
    // Show terminal first to ensure name is visible
    terminal.show();
    
    // Small delay to let terminal initialize and display name
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Change working directory if specified
    if (command.workingDirectory) {
      terminal.sendText(`cd "${command.workingDirectory}"`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    // Build command string
    // Claude CLI: --print with pipe from cat (avoids command length limits)
    // Cursor-agent: --print --approve-mcps with file path as argument
    const isClaude = command.command.includes('claude') && command.args.includes('--print');
    const hasTempFile = isClaude && command.env?.commentaryTempFile;
    
    if (hasTempFile && command.env) {
      // Use pipe from cat to avoid command length limits and shell escaping issues
      // This is more reliable than stdin redirection or command substitution
      const tempFilePath = command.env.commentaryTempFile;
      const fullCommand = `cat "${tempFilePath}" | ${command.command} ${command.args.join(' ')}`;
      terminal.sendText(fullCommand);
    } else {
      // Build command string normally for cursor-agent
      const args = command.args.map(arg => `"${arg.replace(/"/g, '\\"')}"`).join(' ');
      const fullCommand = `${command.command} ${args}`;
      terminal.sendText(fullCommand);
    }
  }

  /**
   * Try to open chat using various commands
   */
  private async tryOpenChat(primaryCommand: string, providerId: string): Promise<boolean> {
    const commands = await vscode.commands.getCommands();
    
    // Build list of commands to try
    const commandsToTry = providerId === 'cursor'
      ? getCursorChatCommands()
      : [primaryCommand];

    for (const cmd of commandsToTry) {
      if (commands.includes(cmd)) {
        try {
          await vscode.commands.executeCommand(cmd);
          // Give chat time to open
          await new Promise(resolve => setTimeout(resolve, 100));
          return true;
        } catch (error) {
          console.log(`[Commentary] Failed to execute ${cmd}:`, error);
        }
      }
    }

    return false;
  }

  /**
   * Schedule cleanup of temp file
   */
  private scheduleCleanup(filePath: string): void {
    setTimeout(() => {
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (error) {
        // Ignore cleanup errors
        console.log('[Commentary] Failed to cleanup temp file:', error);
      }
    }, 30000); // 30 seconds
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    // Terminals will be disposed automatically by VS Code
    this.terminals.clear();
  }
}
