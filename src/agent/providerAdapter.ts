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

/**
 * Adapter that bridges pure provider logic with VS Code APIs
 */
export class ProviderAdapter {
  private providers: Map<string, ProviderStrategy>;
  private terminals: Map<string, vscode.Terminal>;

  constructor(private context: vscode.ExtensionContext) {
    this.providers = new Map();
    this.terminals = new Map();
    
    // Register all providers
    this.providers.set('claude', new ClaudeProvider());
    this.providers.set('cursor', new CursorProvider());
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
      claudeCliPath: config.get<string>('claudeCliPath', '/usr/local/bin/claude'),
      
      // Cursor
      cursorCliPath: config.get<string>('cursorCliPath', '/usr/local/bin/cursor'),
      cursorInteractive: config.get<boolean>('cursorInteractive', true),
      
      // OpenAI
      openaiApiKey: config.get<string>('openaiApiKey'),
      openaiModel: config.get<string>('openaiModel'),
      
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
    
    // Execute command
    await this.executeTerminalCommand(terminal, command);

    // Show success message
    const message = provider.getSuccessMessage(request, 'cli');
    const action = await vscode.window.showInformationMessage(message, 'View Terminal');
    if (action === 'View Terminal') {
      terminal.show();
    }

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
    _prompt: string,
    request: AgentRequest,
    _config: ProviderConfig,
    _providerName: string
  ): Promise<SendResult> {
    const message = provider.getSuccessMessage(request, 'api');
    vscode.window.showInformationMessage(message + ' (API integration coming soon)');

    return {
      success: true,
      method: 'api',
      message
    };
  }

  /**
   * Get or create terminal for provider
   */
  private async getOrCreateTerminal(providerId: string, providerName: string): Promise<vscode.Terminal> {
    // Check if existing terminal is still alive
    const existingTerminal = this.terminals.get(providerId);
    if (existingTerminal) {
      const allTerminals = vscode.window.terminals;
      if (allTerminals.includes(existingTerminal)) {
        // Terminal exists and is alive - clean it up for reuse
        existingTerminal.sendText('\x03'); // Ctrl+C
        await new Promise(resolve => setTimeout(resolve, 300));
        existingTerminal.sendText('clear');
        await new Promise(resolve => setTimeout(resolve, 100));
        return existingTerminal;
      }
    }

    // Create new terminal
    const terminal = vscode.window.createTerminal({
      name: `Commentary ? ${providerName}`,
      hideFromUser: false
    });

    this.terminals.set(providerId, terminal);
    return terminal;
  }

  /**
   * Execute command in terminal
   */
  private async executeTerminalCommand(terminal: vscode.Terminal, command: TerminalCommand): Promise<void> {
    terminal.show();

    // Change working directory if specified
    if (command.workingDirectory) {
      terminal.sendText(`cd "${command.workingDirectory}"`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Build command string
    const args = command.args.map(arg => `"${arg}"`).join(' ');
    const fullCommand = `${command.command} ${args}`;

    terminal.sendText(fullCommand);
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
