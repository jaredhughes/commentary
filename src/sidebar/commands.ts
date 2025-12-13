/**
 * Command handlers for Commentary extension
 */

import * as vscode from 'vscode';
import { StorageManager } from '../storage';
import { OverlayHost } from '../preview/overlayHost';
import { AgentClient } from '../agent/client';
import { CommentsViewProvider, CommentTreeItem } from './commentsView';
import { MarkdownWebviewProvider } from '../preview/markdownWebview';
import { Note, NotesChangedEvent } from '../types';
import { DocumentNavigationService } from './documentNavigation';
import { CommentaryFileDecorationProvider } from '../decorations/fileDecorationProvider';

export class CommandManager {
  private navigationService: DocumentNavigationService;

  constructor(
    private context: vscode.ExtensionContext,
    private storage: StorageManager,
    private overlayHost: OverlayHost,
    private commentsView: CommentsViewProvider,
    private agentClient: AgentClient,
    private webviewProvider: MarkdownWebviewProvider,
    private fileDecorationProvider?: CommentaryFileDecorationProvider
  ) {
    // Initialize navigation service with default timing
    this.navigationService = new DocumentNavigationService(webviewProvider, overlayHost);
  }

  registerCommands(): void {
    // Edit comment from sidebar (click behavior)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.editCommentFromSidebar', async (note: CommentTreeItem) => {
        if (!note || !note.note) {
          return;
        }
        
        // Use the navigation service to handle all the complexity
        await this.navigationService.navigateToComment(note.note, true);
      })
    );

    // Open/focus document from sidebar (click on file item)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.openDocument', async (fileUri: string) => {
        await this.navigationService.openDocument(fileUri);
      })
    );


    // Delete specific comment
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.deleteComment', async (item: CommentTreeItem) => {
        if (!item || !item.note) {
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Delete comment "${item.note.text}"?`,
          { modal: true },
          'Delete'
        );

        if (confirm === 'Delete') {
          await this.storage.deleteNote(item.note.id, item.note.file);
          await this.overlayHost.refreshPreview();
          const event: NotesChangedEvent = {
            type: 'deleted',
            noteId: item.note.id,
            documentUri: item.note.file
          };
          this.commentsView.refresh(event);
          // Refresh file decoration to update comment count badge
          const fileUri = vscode.Uri.parse(item.note.file);
          await this.fileDecorationProvider?.refresh(fileUri);
        }
      })
    );

    // Delete all comments across all documents
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.deleteAllComments', async () => {
        // Get all notes across all documents
        const allNotes = await this.storage.getAllNotes();
        const totalComments = Array.from(allNotes.values()).reduce((sum, notes) => sum + notes.length, 0);

        if (totalComments === 0) {
          vscode.window.showInformationMessage('No comments to delete');
          return;
        }

        const confirm = await vscode.window.showWarningMessage(
          `Delete all ${totalComments} comment${totalComments === 1 ? '' : 's'} across all documents?`,
          { modal: true },
          'Delete All'
        );

        if (confirm === 'Delete All') {
          // Delete notes for each file
          for (const fileUri of allNotes.keys()) {
            await this.storage.deleteAllNotes(fileUri);
          }

          await this.overlayHost.clearAllHighlights();
          this.commentsView.refresh();
          vscode.window.showInformationMessage(`Deleted ${totalComments} comment${totalComments === 1 ? '' : 's'}`);
        }
      })
    );

    // Send comment to agent (shared logic for all provider variants)
    const sendToAgentHandler = async (item: CommentTreeItem | { note: Note }) => {
      // Handle both CommentTreeItem (from sidebar) and plain { note } object (from overlay)
      const note = item instanceof CommentTreeItem ? item.note : item.note;

      if (!note) {
        return;
      }

      try {
        let method: 'cli' | 'api' | 'clipboard' | 'chat' | undefined;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Commentary',
            cancellable: false
          },
          async (progress) => {
            progress.report({ message: 'Sending comment to agent...' });
            method = await this.agentClient.sendSingleComment(note);
          }
        );

        // Only auto-delete if method applies changes automatically (CLI or API)
        // Keep comment for manual methods (clipboard, chat) so user can track what to apply
        if (method === 'cli' || method === 'api') {
          await this.storage.deleteNote(note.id, note.file);
          await this.overlayHost.refreshPreview();
          const event: NotesChangedEvent = {
            type: 'deleted',
            noteId: note.id,
            documentUri: note.file
          };
          this.commentsView.refresh(event);
          // Refresh file decoration to update comment count badge
          const fileUri = vscode.Uri.parse(note.file);
          await this.fileDecorationProvider?.refresh(fileUri);
          // Note: Webview will refresh automatically when cursor-agent saves changes
          // via onDidChangeTextDocument handler in extension.ts
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to send comment: ${message}`);
      }
    };

    // Send comment to agent (generic)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendToAgent', sendToAgentHandler)
    );

    // Send comment to agent (Claude-specific)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendToAgentClaude', sendToAgentHandler)
    );

    // Send comment to agent (Cursor-specific - clipboard fallback)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendToAgentCursor', sendToAgentHandler)
    );

    // Send comment to agent (Cursor CLI-specific - terminal)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendToAgentCursorCli', sendToAgentHandler)
    );

    // Send comment to agent (VS Code-specific)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendToAgentVSCode', sendToAgentHandler)
    );

    // Send to agent (Codex-specific)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendToAgentCodex', sendToAgentHandler)
    );

    // Send to agent (Gemini-specific)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendToAgentGemini', sendToAgentHandler)
    );

    // Send all comments to agent (across all documents) - shared handler
    const sendAllToAgentHandler = async () => {
      // Get all comments across all documents
      const allNotes = await this.storage.getAllNotes();
      const notes: Note[] = [];

      for (const fileNotes of allNotes.values()) {
        notes.push(...fileNotes);
      }

      if (notes.length === 0) {
        vscode.window.showInformationMessage('No comments to send');
        return;
      }

      try {
        let method: 'cli' | 'api' | 'clipboard' | 'chat' | undefined;

        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Commentary',
            cancellable: false
          },
          async (progress) => {
            progress.report({
              message: `Sending ${notes.length} comment${notes.length === 1 ? '' : 's'} to agent...`
            });
            method = await this.agentClient.sendMultipleComments(notes);
          }
        );

        // Only auto-delete if method applies changes automatically (CLI or API)
        // Keep comments for manual methods (clipboard, chat) so user can track what to apply
        if (method === 'cli' || method === 'api') {
          // Delete all comments that were sent
          const fileUris = new Set<string>();
          for (const note of notes) {
            await this.storage.deleteNote(note.id, note.file);
            fileUris.add(note.file);
          }
          await this.overlayHost.refreshPreview();
          this.commentsView.refresh();
          // Refresh file decorations for all affected files
          for (const fileUri of fileUris) {
            await this.fileDecorationProvider?.refresh(vscode.Uri.parse(fileUri));
          }
          // Note: Webview will refresh automatically when cursor-agent saves changes
          // via onDidChangeTextDocument handler in extension.ts
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        vscode.window.showErrorMessage(`Failed to send comments: ${message}`);
      }
    };

    // Generic command (for command palette)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendAllToAgent', sendAllToAgentHandler)
    );

    // Send all comments to agent (Claude-specific)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendAllToAgentClaude', sendAllToAgentHandler)
    );

    // Send all comments to agent (Cursor-specific - clipboard fallback)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendAllToAgentCursor', sendAllToAgentHandler)
    );

    // Send all comments to agent (Cursor CLI-specific - terminal)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendAllToAgentCursorCli', sendAllToAgentHandler)
    );

    // Send all comments to agent (VS Code-specific)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendAllToAgentVSCode', sendAllToAgentHandler)
    );

    // Send all comments to agent (Codex-specific)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendAllToAgentCodex', sendAllToAgentHandler)
    );

    // Send all comments to agent (Gemini-specific)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.sendAllToAgentGemini', sendAllToAgentHandler)
    );


    // Configure AI agent (new unified command)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.configureAgent', async () => {
        const config = vscode.workspace.getConfiguration('commentary.agent');
        const currentProvider = config.get<string>('provider', 'cursor');

        // Step 1: Choose provider
        interface ProviderOption {
          label: string;
          value: string;
          description: string;
        }

        const providers: ProviderOption[] = [
          {
            label: '$(sparkle) Claude',
            value: 'claude',
            description: '✨ API (auto-edit) → CLI (terminal)',
          },
          {
            label: '$(comment-discussion) Cursor',
            value: 'cursor',
            description: '🔧 CLI (cursor-agent, auto-edit)',
          },
          {
            label: '$(symbol-keyword) Codex',
            value: 'codex',
            description: '🤖 CLI (terminal with full-auto mode)',
          },
          {
            label: '$(telescope) Gemini',
            value: 'gemini',
            description: '🔮 CLI (terminal)',
          },
          {
            label: '$(code) VS Code Chat',
            value: 'vscode',
            description: '💬 VS Code built-in chat',
          },
          {
            label: '$(tools) Custom',
            value: 'custom',
            description: 'Custom API endpoint',
          },
        ];

        const items = providers.map((p) => ({
          ...p,
          label: p.value === currentProvider ? `${p.label} $(check)` : p.label,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Current: ${currentProvider} - Select AI agent provider`,
          title: 'Commentary: Configure AI Agent',
        });

        if (!selected) {
          return;
        }

        const newProvider = selected.value;

        // Step 2: Provider-specific configuration
        if (newProvider === 'claude') {
          // Set provider to Claude (global, but workspace can override)
          await config.update('provider', 'claude', vscode.ConfigurationTarget.Global);

          // Show configuration menu (allows configuring both CLI and API)
          let configuring = true;
          while (configuring) {
            const currentCommand = config.get<string>('claudeCommand', 'claude');
            const hasApiKey = !!(config.get<string>('apiKey') || process.env.ANTHROPIC_API_KEY);

            const claudeOption = await vscode.window.showQuickPick([
              {
                label: '$(terminal) Configure CLI Command',
                value: 'cli',
                description: hasApiKey ? 'Fallback method' : 'Primary method',
                detail: `Current: "${currentCommand}" ${hasApiKey ? '(API key takes priority)' : ''}`
              },
              {
                label: '$(key) Configure API Key',
                value: 'api',
                description: hasApiKey ? 'Currently configured' : 'Not configured',
                detail: hasApiKey ? 'Primary method - provides automatic editing' : 'Enables automatic document editing'
              },
              {
                label: '$(check) Done',
                value: 'done',
                description: 'Finish configuration',
                detail: ''
              }
            ], {
              placeHolder: 'Configure Claude integration (you can set up both CLI and API)',
              title: 'Commentary: Configure Claude',
            });

            if (!claudeOption || claudeOption.value === 'done') {
              configuring = false;
              const status = hasApiKey ? 'API key configured (primary)' : `CLI configured: "${currentCommand}"`;
              vscode.window.showInformationMessage(`✓ Claude configured! ${status}`);
              break;
            }

            if (claudeOption.value === 'cli') {
              // Configure Claude CLI command
              const command = await vscode.window.showInputBox({
                prompt: 'Enter the command to invoke Claude Code',
                placeHolder: 'claude',
                value: currentCommand,
                ignoreFocusOut: true,
                validateInput: (value) => {
                  if (!value || value.trim().length === 0) {
                    return 'Command cannot be empty';
                  }
                  return null;
                }
              });

              if (command) {
                await config.update('claudeCommand', command, vscode.ConfigurationTarget.Global);

                // Ask about CLI mode
                const modeOption = await vscode.window.showQuickPick([
                  {
                    label: '$(terminal) Interactive',
                    value: 'interactive',
                    description: 'Recommended',
                    detail: 'Keep Claude Code session open in terminal after each comment'
                  },
                  {
                    label: '$(run) Batch',
                    value: 'batch',
                    description: 'Advanced',
                    detail: 'Execute and close terminal after each comment'
                  }
                ], {
                  placeHolder: 'How should Claude Code CLI behave after processing each comment?',
                  title: 'Claude CLI Mode',
                  ignoreFocusOut: true
                });

                if (modeOption) {
                  await config.update('claudeMode', modeOption.value, vscode.ConfigurationTarget.Global);
                }

                vscode.window.showInformationMessage(
                  `✓ Claude CLI configured: "${command}" (${modeOption?.value || 'interactive'} mode)`
                );
              }

            } else if (claudeOption.value === 'api') {
              // Configure Claude API key
              const existingKey = config.get<string>('apiKey') || process.env.ANTHROPIC_API_KEY;

              if (existingKey) {
                const action = await vscode.window.showInformationMessage(
                  `Claude API key is already configured. What would you like to do?`,
                  'Keep Current',
                  'Update Key',
                  'Remove Key'
                );

                if (action === 'Remove Key') {
                  await config.update('apiKey', undefined, vscode.ConfigurationTarget.Global);
                  vscode.window.showInformationMessage('Claude API key removed. CLI will be used as fallback.');
                  continue;
                } else if (action !== 'Update Key') {
                  continue;
                }
              }

              // Prompt for API key
              const apiKey = await vscode.window.showInputBox({
                prompt: 'Enter your Anthropic API key (starts with sk-ant-)',
                placeHolder: 'sk-ant-api03-...',
                password: true,
                ignoreFocusOut: true,
                validateInput: (value) => {
                  if (!value || value.trim().length === 0) {
                    return 'API key cannot be empty';
                  }
                  if (!value.startsWith('sk-ant-')) {
                    return 'Anthropic API keys start with sk-ant-';
                  }
                  return null;
                }
              });

              if (apiKey) {
                await config.update('apiKey', apiKey, vscode.ConfigurationTarget.Global);
                vscode.window.showInformationMessage(
                  '✓ Claude API key configured! This will be the primary method (CLI as fallback).'
                );
              }
            }
          }

        } else if (newProvider === 'codex') {
          // Set provider to Codex (global, but workspace can override)
          await config.update('provider', 'codex', vscode.ConfigurationTarget.Global);

          // Configure Codex CLI command
          const currentCommand = config.get<string>('codexCliPath', 'codex');
          const command = await vscode.window.showInputBox({
            prompt: 'Enter the command to invoke Codex CLI',
            placeHolder: 'codex',
            value: currentCommand,
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return 'Command cannot be empty';
              }
              return null;
            }
          });

          if (command) {
            await config.update('codexCliPath', command, vscode.ConfigurationTarget.Global);

            // Ask about CLI mode
            const modeOption = await vscode.window.showQuickPick([
              {
                label: '$(terminal) Interactive',
                value: 'interactive',
                description: 'Recommended',
                detail: 'Keep Codex session open in terminal after each comment'
              },
              {
                label: '$(run) Batch',
                value: 'batch',
                description: 'Advanced',
                detail: 'Execute and close terminal after each comment'
              }
            ], {
              placeHolder: 'How should Codex CLI behave after processing each comment?',
              title: 'Codex CLI Mode',
              ignoreFocusOut: true
            });

            if (modeOption) {
              await config.update('codexMode', modeOption.value, vscode.ConfigurationTarget.Global);
            }

            vscode.window.showInformationMessage(
              `✓ Codex configured! CLI command: "${command}" (${modeOption?.value || 'interactive'} mode)`
            );
          } else {
            // User cancelled, keep current command
            vscode.window.showInformationMessage(
              `✓ Codex configured! Using command: "${currentCommand}"`
            );
          }

        } else if (newProvider === 'gemini') {
          // Set provider to Gemini (global, but workspace can override)
          await config.update('provider', 'gemini', vscode.ConfigurationTarget.Global);

          // Configure Gemini CLI command
          const currentCommand = config.get<string>('geminiCliPath', 'gemini');
          const command = await vscode.window.showInputBox({
            prompt: 'Enter the command to invoke Gemini CLI',
            placeHolder: 'gemini',
            value: currentCommand,
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return 'Command cannot be empty';
              }
              return null;
            }
          });

          if (command) {
            await config.update('geminiCliPath', command, vscode.ConfigurationTarget.Global);

            // Ask about CLI mode
            const modeOption = await vscode.window.showQuickPick([
              {
                label: '$(terminal) Interactive',
                value: 'interactive',
                description: 'Recommended',
                detail: 'Keep Gemini session open in terminal after each comment'
              },
              {
                label: '$(run) Batch',
                value: 'batch',
                description: 'Advanced',
                detail: 'Execute and close terminal after each comment'
              }
            ], {
              placeHolder: 'How should Gemini CLI behave after processing each comment?',
              title: 'Gemini CLI Mode',
              ignoreFocusOut: true
            });

            if (modeOption) {
              await config.update('geminiMode', modeOption.value, vscode.ConfigurationTarget.Global);
            }

            vscode.window.showInformationMessage(
              `✓ Gemini configured! CLI command: "${command}" (${modeOption?.value || 'interactive'} mode)`
            );
          } else {
            // User cancelled, keep current command
            vscode.window.showInformationMessage(
              `✓ Gemini configured! Using command: "${currentCommand}"`
            );
          }

        } else if (newProvider === 'cursor') {
          // Set provider to Cursor (global, but workspace can override)
          await config.update('provider', 'cursor', vscode.ConfigurationTarget.Global);

          // Configure Cursor Agent CLI path
          const currentCliPath = config.get<string>('cursorCliPath', 'cursor-agent');
          const cliPath = await vscode.window.showInputBox({
            prompt: 'Enter the path to cursor-agent command',
            placeHolder: 'cursor-agent (or full path like /usr/local/bin/cursor-agent)',
            value: currentCliPath,
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return 'Path cannot be empty';
              }
              return null;
            }
          });

          if (cliPath) {
            // Ask about interactive mode
            const interactive = await vscode.window.showQuickPick([
              {
                label: 'Interactive Mode (Recommended)',
                value: true,
                description: 'Opens Cursor agent in terminal for conversational sessions'
              },
              {
                label: 'Non-Interactive Mode',
                value: false,
                description: 'Single-shot execution, returns response immediately'
              }
            ], {
              placeHolder: 'Select cursor-agent mode',
              title: 'Cursor Agent Interaction Mode'
            });

            if (interactive !== undefined) {
              await config.update('cursorCliPath', cliPath, vscode.ConfigurationTarget.Global);
              await config.update('cursorInteractive', interactive.value, vscode.ConfigurationTarget.Global);
              vscode.window.showInformationMessage(
                `✓ Cursor configured! CLI: "${cliPath}" (${interactive.value ? 'interactive' : 'non-interactive'})`
              );
            }
          } else {
            // User cancelled, keep current command
            vscode.window.showInformationMessage(
              `✓ Cursor configured! Using command: "${currentCliPath}"`
            );
          }

        } else if (newProvider === 'custom') {
          // Prompt for custom endpoint
          const endpoint = await vscode.window.showInputBox({
            prompt: 'Enter custom API endpoint URL',
            placeHolder: 'https://api.example.com/v1/chat',
            ignoreFocusOut: true,
            validateInput: (value) => {
              if (!value || value.trim().length === 0) {
                return 'Endpoint cannot be empty';
              }
              try {
                new URL(value);
                return null;
              } catch {
                return 'Invalid URL';
              }
            }
          });

          if (!endpoint) {
            return;
          }

          await config.update('endpoint', endpoint, vscode.ConfigurationTarget.Global);
          await config.update('provider', 'custom', vscode.ConfigurationTarget.Global);

          vscode.window.showInformationMessage(
            '✓ Custom endpoint configured!'
          );
        } else if (newProvider === 'vscode') {
          // VS Code Chat requires no additional config (global, but workspace can override)
          await config.update('provider', 'vscode', vscode.ConfigurationTarget.Global);

          vscode.window.showInformationMessage(
            '✓ VS Code Chat configured! Comments will open in VS Code\'s built-in chat (requires manual paste).'
          );
        }
      })
    );


    // Edit comment
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.editComment', async (item: CommentTreeItem) => {
        if (!item || !item.note) {
          return;
        }

        const newText = await vscode.window.showInputBox({
          prompt: 'Edit comment',
          value: item.note.text,
          placeHolder: 'Enter comment text...',
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Comment cannot be empty';
            }
            return null;
          }
        });

        if (newText !== undefined && newText.trim() !== item.note.text) {
          // Update the note
          const updatedNote = {
            ...item.note,
            text: newText.trim()
          };

          await this.storage.saveNote(updatedNote);
          const event: NotesChangedEvent = { type: 'updated', note: updatedNote };
          this.commentsView.refresh(event);
          vscode.window.showInformationMessage('Comment updated');
        }
      })
    );

    // Add document-level comment
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.addDocumentComment', async (documentUri?: string) => {
        // Try to get document URI from parameter, fall back to active editor
        let targetUri: string | undefined = documentUri;
        let documentText: string;
        let lineCount: number;

        if (targetUri) {
          // URI provided (from preview button) - load document directly
          try {
            const doc = await vscode.workspace.openTextDocument(vscode.Uri.parse(targetUri));
            documentText = doc.getText();
            lineCount = doc.lineCount;
          } catch (error) {
            vscode.window.showErrorMessage(`Failed to open document: ${error}`);
            return;
          }
        } else {
          // No URI provided (from command palette) - use active editor
          const activeEditor = vscode.window.activeTextEditor;
          if (!activeEditor || activeEditor.document.languageId !== 'markdown') {
            vscode.window.showWarningMessage('Please open a Markdown file to add a document comment');
            return;
          }
          targetUri = activeEditor.document.uri.toString();
          documentText = activeEditor.document.getText();
          lineCount = activeEditor.document.lineCount;
        }

        const commentText = await vscode.window.showInputBox({
          prompt: 'Add comment for entire document',
          placeHolder: 'Enter comment text...',
          ignoreFocusOut: true,
          validateInput: (value) => {
            if (!value || value.trim().length === 0) {
              return 'Comment cannot be empty';
            }
            return null;
          }
        });

        if (!commentText) {
          return;
        }

        // Create a document-level note
        const note = {
          id: `doc-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          file: targetUri,
          quote: {
            exact: '[Entire Document]',
            prefix: '',
            suffix: ''
          },
          position: {
            start: 0,
            end: documentText.length
          },
          lines: {
            start: 1,
            end: lineCount
          },
          text: commentText.trim(),
          createdAt: new Date().toISOString(),
          isDocumentLevel: true
        };

        await this.storage.saveNote(note);
        const event: NotesChangedEvent = { type: 'added', note };
        this.commentsView.refresh(event);
        vscode.window.showInformationMessage('Document comment added');
      })
    );

    // Debug: List available commands (helps find Cursor chat command)
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.listAvailableCommands', async () => {
        const allCommands = await vscode.commands.getCommands(true);

        // Filter for potentially relevant commands
        const relevantCommands = allCommands.filter(cmd =>
          cmd.includes('chat') ||
          cmd.includes('cursor') ||
          cmd.includes('ai') ||
          cmd.includes('composer') ||
          cmd.includes('copilot')
        );

        const outputChannel = vscode.window.createOutputChannel('Commentary Debug');
        outputChannel.clear();
        outputChannel.appendLine('=== Available Chat/AI Commands ===');
        outputChannel.appendLine('');

        if (relevantCommands.length > 0) {
          relevantCommands.forEach(cmd => {
            outputChannel.appendLine(`✓ ${cmd}`);
          });
        } else {
          outputChannel.appendLine('No chat/AI commands found');
          outputChannel.appendLine('');
          outputChannel.appendLine('All available commands:');
          allCommands.slice(0, 50).forEach(cmd => {
            outputChannel.appendLine(`✓ ${cmd}`);
          });
          outputChannel.appendLine(`... and ${allCommands.length - 50} more`);
        }

        outputChannel.show();
        vscode.window.showInformationMessage(
          `Found ${relevantCommands.length} chat/AI commands - check Output panel`,
          'OK'
        );
      })
    );

    // Select theme
    this.context.subscriptions.push(
      vscode.commands.registerCommand('commentary.selectTheme', async () => {
        const config = vscode.workspace.getConfiguration('commentary.theme');
        const currentTheme = config.get<string>('name', 'simple');

        // Define theme options organized by package
        interface ThemeOption {
          label: string;
          value: string;
          description: string;
          detail?: string;
        }

        const themes: ThemeOption[] = [
          // Water.css
          { label: 'Water Light', value: 'water-light', description: 'Modern, clean, excellent contrast', detail: 'Water.css' },
          { label: 'Water Dark', value: 'water-dark', description: 'Modern dark mode', detail: 'Water.css' },

          // Sakura
          { label: 'Sakura Light', value: 'sakura-light', description: 'Elegant default light', detail: 'Sakura' },
          { label: 'Sakura Dark', value: 'sakura-dark', description: 'Elegant dark mode', detail: 'Sakura' },
          { label: 'Sakura Vader', value: 'sakura-vader', description: 'Dark with personality', detail: 'Sakura' },
          { label: 'Sakura Pink', value: 'sakura-pink', description: 'Soft pink accents', detail: 'Sakura' },
          { label: 'Sakura Earthly', value: 'sakura-earthly', description: 'Natural earth tones', detail: 'Sakura' },

          // Pico CSS (auto-adapts to system light/dark mode)
          { label: 'Pico Amber', value: 'pico-amber', description: 'Professional with amber accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Blue', value: 'pico-blue', description: 'Professional with blue accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Cyan', value: 'pico-cyan', description: 'Professional with cyan accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Green', value: 'pico-green', description: 'Professional with green accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Grey', value: 'pico-grey', description: 'Professional neutral grey (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Pink', value: 'pico-pink', description: 'Professional with pink accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Purple', value: 'pico-purple', description: 'Professional with purple accents (adapts to system theme)', detail: 'Pico CSS' },
          { label: 'Pico Red', value: 'pico-red', description: 'Professional with red accents (adapts to system theme)', detail: 'Pico CSS' },

          // Simple.css (auto-adapts to system light/dark mode)
          { label: 'Simple', value: 'simple', description: 'Minimalist and clean (adapts to system theme)', detail: 'Simple.css' },

          // Matcha
          { label: 'Matcha', value: 'matcha', description: 'Code-focused with excellent syntax highlighting', detail: 'Matcha' },

          // LaTeX.css
          { label: 'LaTeX', value: 'latex', description: 'Academic paper styling inspired by LaTeX', detail: 'LaTeX.css' },

          // Tufte CSS
          { label: 'Tufte', value: 'tufte', description: 'Inspired by Edward Tufte\'s design principles', detail: 'Tufte CSS' },

          // New.css
          { label: 'New', value: 'new', description: 'Modern minimal design (4k+ GitHub stars)', detail: 'New.css' }
        ];

        // Mark current theme
        const items = themes.map((t) => ({
          ...t,
          label: t.value === currentTheme ? `${t.label} $(check)` : t.label,
        }));

        const selected = await vscode.window.showQuickPick(items, {
          placeHolder: `Current: ${currentTheme} - Select a theme`,
          title: 'Commentary: Select Theme',
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (selected) {
          // Check if there's a workspace setting that would override global
          const inspectConfig = vscode.workspace.getConfiguration('commentary');
          const themeInspect = inspectConfig.inspect<string>('theme.name');

          // If workspace value exists, update workspace (to avoid override confusion)
          // Otherwise update global
          const target = themeInspect?.workspaceValue !== undefined
            ? vscode.ConfigurationTarget.Workspace
            : vscode.ConfigurationTarget.Global;

          // Update configuration
          await config.update('name', selected.value, target);

          // Wait for config to propagate
          await new Promise(resolve => setTimeout(resolve, 50));

          // Explicitly refresh webviews to ensure theme change is applied
          // (Config listener should also trigger refresh, but this ensures immediate update)
          await this.webviewProvider.refreshAllWebviews();

          vscode.window.showInformationMessage(`Theme switched to: ${selected.label.replace(' $(check)', '')}`);
        }
      })
    );
  }
}
